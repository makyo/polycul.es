import base64
import os
import sqlite3
import json
from contextlib import closing
from jsonschema import validate

from flask import (
    Flask,
    Response,
    g,
    redirect,
    render_template,
    request,
    session,
)

from migrations import hashify
from model import Polycule

# Config
IP = os.environ.get("ip", None)
DATABASE = os.getenv('DATABASE', 'dev.db')
DEBUG = True
SECRET_KEY = os.getenv('SECRET_KEY', 'SET ME PLEASE')

# App initialization
app = Flask(__name__)
app.config.from_object(__name__)


# Database initialization
def connect_db():
    return sqlite3.connect(app.config["DATABASE"])


def migrate():
    migrations_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "migrations"
    )
    with closing(connect_db()) as db:
        try:
            current_migration = db.execute(
                """
                select * from migrations
            """
            ).fetchall()[0][0]
        except sqlite3.OperationalError:
            # If there was no migrations table, the DB does not exist yet.
            current_migration = -1
        for filename in sorted(os.listdir(migrations_dir)):
            if filename[-3:] != "sql":
                continue
            migration_number = int(filename[:3])
            if migration_number <= current_migration:
                print("migration {} already applied".format(migration_number))
                continue
            with open(os.path.join(migrations_dir, filename), "r", encoding="utf-8") as f:
                try:
                    db.cursor().executescript(f.read())
                except Exception as e:
                    print("Got {} - maybe already applied?".format(e))
                finally:
                    pass
            if filename[:3] == "003":
                hashify.migrate(db)


def generate_csrf_token():
    if "_csrf_token" not in session:
        session["_csrf_token"] = base64.b64encode(os.urandom(12)).decode("utf-8")
    return session["_csrf_token"]


app.jinja_env.globals["csrf_token"] = generate_csrf_token


@app.before_request
def before_request():
    if request.method == "POST":
        token = session.pop("_csrf_token", None)
        if not token or token != request.form.get("_csrf_token"):
            return render_template("error.jinja2", error="Token expired :(")
    g.db = connect_db()


@app.teardown_request
def teardown_request(exception):
    db = getattr(g, "db", None)
    if db is not None:
        db.close()


# Views
@app.route("/")
def front():
    """ Render the front page. """
    return render_template("front.jinja2")


@app.route("/example")
def example():
    """ View an example polycule. """
    result = g.db.execute("select * from polycules where id = 1")
    graph = result.fetchone()[1]
    return render_template("embed_polycule.jinja2", graph=graph)


@app.route("/<string:polycule_id>", methods=["GET", "POST"])
def view_polycule(polycule_id):
    """ View a polycule. """
    try:
        polycule = Polycule.get(g.db, polycule_id, request.form.get("view_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("view_auth.jinja2")
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    return render_template("view_polycule.jinja2", polycule=polycule)


@app.route("/<string:polycule_id>.html", methods=["GET", "POST"])
def view_text_only(polycule_id):
    """ View a polycule. """
    try:
        polycule = Polycule.get(g.db, polycule_id, request.form.get("view_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("view_auth.jinja2")
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    return render_template("text_only.jinja2", content=polycule.as_html())


@app.route("/embed/<string:polycule_id>")
def embed_polycule(polycule_id):
    """ View just a polycule for embedding in an iframe. """
    polycule = Polycule.get(g.db, polycule_id, request.form.get("view_pass", ""))
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    return render_template("embed_polycule.jinja2", graph=polycule.graph)


@app.route("/inherit/<string:polycule_id>", methods=["GET", "POST"])
def inherit_polycule(polycule_id):
    """
    Take a given polycule and enter create mode, with that polycule's contents
    already in place
    """
    try:
        polycule = Polycule.get(g.db, polycule_id, request.form.get("view_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("view_auth.jinja2")
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    return render_template("edit_polycule.jinja2", inherited=polycule.graph, creating=True)


@app.route("/create")
def create_polycule():
    """ Create a new, blank polycule. """
    graph = """{
        "lastId": 0,
        "nodes": [],
        "links": []
    }"""
    return render_template("edit_polycule.jinja2", inherited=graph, creating=True)


@app.route("/edit/<polycule_id>", methods=["GET", "POST"])
def edit_polycule(polycule_id):
    # Force, as we're relying on edit pass instead of view pass
    polycule = Polycule.get(g.db, polycule_id, "", force=True)
    if request.method == "GET":
        return render_template("edit_auth.jinja2")
    try:
        polycule.can_save(request.form.get("edit_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("edit_auth.jinja2")
    except Polycule.NoPassword:
        return render_template(
            "error.jinja2",
            error="This polycule has no password and thus cannot be edited :(",
        )
    session["currently_editing"] = polycule_id
    return render_template(
        "edit_polycule.jinja2", polycule_id=polycule_id, graph=polycule.graph, creating=False
    )


@app.route("/edit/save", methods=["POST"])
def save_existing_polycule():
    polycule = Polycule.get(g.db, session["currently_editing"], "", force=True)
    polycule.save(
        request.form.get("graph"),
        request.form.get("view_pass"),
        request.form.get("edit_pass"),
        remove_view_pass=request.form.get("remove_view_pass"),
        remove_edit_pass=request.form.get("remove_edit_pass"),
    )
    return redirect("/{}".format(session.pop("currently_editing")))


@app.route("/save", methods=["POST"])
def save_new_polycule():
    """ Save a created polycule. """
    try:
        with open("schema.json") as json_data:
            schema = json.load(json_data)
        validate(json.loads(request.form["graph"]), schema)
    except Exception:
        return render_template(
            "error.jinja2", error="The submitted graph could not be parsed"
        )
    try:
        polycule = Polycule.create(
            g.db,
            request.form["graph"],
            request.form.get("view_pass", ""),
            request.form.get("edit_pass", ""),
        )
    except Polycule.IdenticalGraph:
        return render_template(
            "error.jinja2",
            error="An identical polycule " "to the one you submitted already exists!",
        )
    return redirect("/{}".format(polycule.graph_hash))


@app.route("/delete/<string:polycule_id>", methods=["POST"])
def delete_polycule(polycule_id):
    polycule = Polycule.get(g.db, polycule_id, None, force=True)
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    try:
        polycule.delete(request.form.get("delete_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("view_auth.jinja2", polycule_id=polycule_id)
    return redirect("/")


@app.route("/export/<string:polycule_id>", methods=["GET", "POST"])
def choose_export(polycule_id):
    try:
        polycule = Polycule.get(g.db, polycule_id, request.form.get("view_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("view_auth.jinja2")
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    return render_template("choose_export.jinja2", polycule=polycule)


@app.route("/export/<string:polycule_id>/polycule.txt", methods=["GET", "POST"])
def export_text(polycule_id):
    try:
        polycule = Polycule.get(g.db, polycule_id, request.form.get("view_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("view_auth.jinja2")
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    return Response(polycule.as_text(), mimetype="text/plain")


@app.route("/export/<string:polycule_id>/polycule.dot", methods=["GET", "POST"])
def export_dot(polycule_id):
    try:
        polycule = Polycule.get(g.db, polycule_id, request.form.get("view_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("view_auth.jinja2")
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    labels = request.args.get("link-labels", "") != ""
    return Response(polycule.as_dot(edge_labels=labels), mimetype="text/plain")


@app.route("/export/<string:polycule_id>/polycule.svg", methods=["GET", "POST"])
def export_svg(polycule_id):
    try:
        polycule = Polycule.get(g.db, polycule_id, request.form.get("view_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("view_auth.jinja2")
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    labels = request.args.get("link-labels", "") != ""
    style = request.args.get("style", "") != ""
    embed = request.args.get("embed", "") != ""
    return Response(
        polycule.as_svg(edge_labels=labels, include_style=style, embed=embed),
        mimetype="image/svg+xml",
    )


@app.route("/export/<string:polycule_id>/polycule.png", methods=["GET", "POST"])
def export_png(polycule_id):
    try:
        polycule = Polycule.get(g.db, polycule_id, request.form.get("view_pass", ""))
    except Polycule.PermissionDenied:
        return render_template("view_auth.jinja2")
    if polycule is None:
        return render_template("error.jinja2", error="Polycule not found :(")
    labels = request.args.get("link-labels", "") != ""
    source = request.args.get("from", "dot")
    if source == "dot":
        png = polycule.as_png_from_dot(edge_labels=labels)
    elif source == "svg":
        style = request.args.get("style", "") != ""
        embed = request.args.get("embed", "") != ""
        png = polycule.as_png_from_svg(
            edge_labels=labels, include_style=style, embed=embed
        )
    return Response(png, mimetype="image/png")



run_directly = __name__ == "__main__"
run_gunicorn = __name__ == "polycules"

if run_directly or run_gunicorn:
    migrate()

    if run_directly:
        app.run(host=IP)
