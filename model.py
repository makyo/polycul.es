import bcrypt
import hashlib
import json
import markdown
import subprocess
import tempfile


class Polycule(object):
    def __init__(
        self,
        db=None,
        id=None,
        graph=None,
        view_pass=None,
        edit_pass=None,
        graph_hash=None,
    ):
        self._db = db
        self.id = id
        self.graph = graph
        self.view_pass = view_pass
        self.edit_pass = edit_pass
        self.graph_hash = graph_hash

    @classmethod
    def get(cls, db, graph_hash, password, force=False):
        if len(graph_hash) < 7:
            return None
        graph_hash = graph_hash + "_" * (40 - len(graph_hash))
        result = db.execute(
            """select id, graph, view_pass, delete_pass, hash
            from polycules where hash like ?""",
            [graph_hash],
        )
        graph = result.fetchall()
        if len(graph) != 1:
            return None
        graph = graph[0]
        polycule = Polycule(
            db=db,
            id=graph[0],
            graph=graph[1],
            view_pass=graph[2],
            edit_pass=graph[3],
            graph_hash=graph[4],
        )
        if not force and (
            polycule.view_pass is not None
            and not bcrypt.checkpw(
                password.encode("utf-8"), polycule.view_pass.encode("utf-8")
            )
        ):
            raise Polycule.PermissionDenied
        return polycule

    @classmethod
    def create(cls, db, graph, raw_view_pass, raw_edit_pass):
        if raw_view_pass is not None:
            view_pass = bcrypt.hashpw(raw_view_pass.encode(), bcrypt.gensalt()).decode()
        else:
            view_pass = None
        if raw_edit_pass is not None:
            edit_pass = bcrypt.hashpw(raw_edit_pass.encode(), bcrypt.gensalt()).decode()
        else:
            edit_pass = None
        result = db.execute("select count(*) from polycules where graph = ?", [graph])
        existing = result.fetchone()[0]
        if existing != 0:
            raise Polycule.IdenticalGraph
        cur = db.cursor()
        result = cur.execute(
            """insert into polycules
            (graph, view_pass, delete_pass, hash) values (?, ?, ?, ?)""",
            [
                graph,
                view_pass,
                edit_pass,
                hashlib.sha1(graph.encode("utf-8")).hexdigest(),
            ],
        )
        db.commit()
        new_hash = db.execute(
            "select hash from polycules where id = ?", [result.lastrowid]
        ).fetchone()[0]
        return Polycule.get(db, new_hash, None, force=True)

    def can_save(self, edit_pass):
        result = bcrypt.checkpw(
            edit_pass.encode("utf-8"), self.edit_pass.encode("utf-8")
        )
        if result and len(edit_pass) == 0:
            raise Polycule.NoPassword
        if not result:
            raise Polycule.PermissionDenied

    def save(
        self,
        graph,
        raw_view_pass,
        raw_edit_pass,
        force=False,
        remove_view_pass=False,
        remove_edit_pass=False,
    ):
        if remove_view_pass:
            view_pass = None
        else:
            if raw_view_pass:
                view_pass = bcrypt.hashpw(
                    raw_view_pass.encode(), bcrypt.gensalt()
                ).decode()
            else:
                view_pass = self.view_pass
        if remove_edit_pass:
            edit_pass = None
        else:
            if raw_edit_pass:
                edit_pass = bcrypt.hashpw(
                    raw_edit_pass.encode(), bcrypt.gensalt()
                ).decode()
            else:
                edit_pass = self.edit_pass
        cur = self._db.cursor()
        cur.execute(
            """update polycules
        set graph = ?, view_pass = ?, delete_pass = ?
        where id = ?""",
            [graph, view_pass, edit_pass, self.id],
        )
        self._db.commit()
        self.graph = graph
        self.view_pass = view_pass
        self.edit_pass = edit_pass

    def delete(self, password, force=False):
        if not force and not bcrypt.checkpw(
            password.encode("utf-8"), self.edit_pass.encode("utf-8")
        ):
            raise Polycule.PermissionDenied
        cur = self._db.cursor()
        cur.execute("delete from polycules where id = ?", [self.id])
        self._db.commit()

    def as_text(self):
        text = """# Polycule

This is our relationship graph. You can see a visual representation of it
online at <https://polycul.es/{}>.

""".format(
            self.graph_hash
        )
        parsed = json.loads(self.graph)
        for edge in parsed["links"]:
            text += "* _{}_{} is in a {}relationship{} with _{}_{}\n".format(
                edge["source"]["name"].encode("utf-8"),
                " ({})".format(edge["sourceText"].encode("utf-8"))
                if "sourceText" in edge
                else "",
                "loosely defined " if "dashed" in edge else "",
                " ({})".format(edge["centerText"].encode("utf-8"))
                if "centerText" in edge
                else "",
                edge["target"]["name"].encode("utf-8"),
                " ({})".format(edge["targetText"].encode("utf-8"))
                if "targetText" in edge
                else "",
            )
        return text

    def as_html(self):
        return markdown.markdown(self.as_text().decode("utf-8"))

    def as_dot(self, edge_labels=False):
        dot = "graph polycule {\n"
        parsed = json.loads(self.graph)
        for node in parsed["nodes"]:
            dot += '\tnode{id} [label="{label}"]\n'.format(
                id=node["id"], label=node["name"].replace('"', '\\"')
            )
        dot += "\n"
        for edge in parsed["links"]:
            dot += "\tnode{id1} -- node{id2} [len={len}".format(
                id1=edge["source"]["id"],
                id2=edge["target"]["id"],
                len=1 / float(edge["strength"]) * 10
                + (1 / float(len(parsed["links"]))),
            )
            if edge_labels:
                dot += ',label="{label}"'.format(label=edge.get("centerText", ""))
            if "dashed" in edge:
                dot += ",style=dashed"
            elif int(edge["strength"]) > 5:
                dot += ",style=bold"
            dot += "]\n"
        dot += "}"
        return dot

    def as_png_from_dot(self, edge_labels=False):
        source = tempfile.NamedTemporaryFile()
        dest = tempfile.NamedTemporaryFile()
        source.write(self.as_dot(edge_labels=edge_labels).encode())
        source.flush()
        subprocess.check_call(["neato", "-Tpng", "-o", dest.name, source.name])
        png = dest.read()
        source.close()
        dest.close()
        return png

    def as_svg(
        self,
        edge_labels=False,
        include_style=False,
        embed=False,
        labels_by_default=False,
    ):
        svg = """{header}
        <svg width="{width}" height="{height}" viewbox="0 0 {width} {height}"
            xmlns="http://www.w3.org/2000/svg">
            {style}
            <g transform="translate({translate})">
                <g transform="scale({scale})">
                    <g class="polycul_es-links">
                        {links}
                    </g>
                    <g class="polycul_es-nodes">
                        {nodes}
                    </g>
                    <g class="polycul_es-meanings">
                        {meanings}
                    </g>
                </g>
            </g>
        </svg>
        """

        header = """<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
          "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">"""

        style = """
        <style>
        @import url('https://fonts.googleapis.com/css?family=Ubuntu+Mono');
        .polycul_es-nodes .node circle {
            fill: #888;
        }
        .polycul_es-nodes .node text {
            font: 10px "Ubuntu Mono", monospace;
        }
        .polycul_es-links .link line {
            stroke: #ccc;
        }

        .polycul_es-meanings text {
            fill: #55F;
            font: 10px "Ubuntu Mono", monospace;
            text-anchor: middle;
            %s
        }

        .polycul_es-meanings text:hover {
            %s
        }
        </style>
        """ % (
            "" if labels_by_default else "opacity: 0;",
            "" if labels_by_default else "opacity: 1;",
        )

        parsed = json.loads(self.graph)
        nodes_el = ""
        for node in parsed["nodes"]:
            nodes_el += """
            <g class="node">
                <circle cx="{x}" cy="{y}" r="{r}" />
                <text x="{textx}" y="{texty}" text-anchor="middle">
                    {name}
                </text>
            </g>
            """.format(
                x=node["x"],
                y=node["y"],
                r=node["r"],
                textx=node["x"],
                texty=int(node["y"]) - int(node["r"]) - 5,
                name=node["name"].encode("utf-8"),
            )
        links_el = ""
        meanings_el = ""
        for edge in parsed["links"]:
            if edge_labels and "centerText" in edge:
                meanings_el += """
                <text x="{x}" y="{y}" text-anchor="middle">{meaning}</text>
                """.format(
                    x=(edge["source"]["x"] + edge["target"]["x"]) / 2,
                    y=(edge["source"]["y"] + edge["target"]["y"]) / 2,
                    meaning=edge["centerText"],
                )
            links_el += """
            <g class="link">
                <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"
                    stroke-width="{width}"{dasharray} />
            </g>
            """.format(
                x1=edge["source"]["x"],
                y1=edge["source"]["y"],
                x2=edge["target"]["x"],
                y2=edge["target"]["y"],
                width=edge["strength"],
                dasharray=' stroke-dasharray="{s} {s}"'.format(s=edge["strength"])
                if "dashed" in edge
                else "",
            )
        return svg.format(
            header="" if embed else header,
            style=style if include_style else "",
            width=1000,
            height=540,
            translate=parsed.get("translate", "0, 0"),
            scale=parsed.get("scale", 1),
            nodes=nodes_el,
            links=links_el,
            meanings=meanings_el if edge_labels else "",
        )

    def as_png_from_svg(self, edge_labels=False, include_style=False, embed=False):
        source = tempfile.NamedTemporaryFile()
        dest = tempfile.NamedTemporaryFile()
        source.write(
            self.as_svg(
                edge_labels=edge_labels,
                include_style=True,
                labels_by_default=edge_labels,
            )
        )
        source.flush()
        subprocess.check_call(
            ["convert", "svg:{}".format(source.name), "png:{}".format(dest.name)]
        )
        png = dest.read()
        source.close()
        dest.close()
        return png

    class NoPassword(Exception):
        pass

    class PermissionDenied(Exception):
        pass

    class IdenticalGraph(Exception):
        pass
