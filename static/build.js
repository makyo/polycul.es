'use strict';

function resetMenus() {
  d3.select('#node-menu').style('display', 'none');
  d3.select('#link-menu').style('display', 'none');
}

function closeEditMenu() {
  selected_link = null;
  selected_node = null;
  editing = false;
  resetMenus();
}

function linkName(link) {
  return `[${link.source.name}]->[${link.target.name}]`;
}

function changeElement(target_list, target_element, f) {
  var elements = target_list.filter(function (element) {
    return element === target_element;
  });

  if (elements.length === 1) {
    f(elements[0]);
  }

  startGraphAnimation();
  return elements.length === 1;
}

function changeNode(target_node, f) {
  var success = changeElement(window.graph.nodes, target_node, f)
  if (!success) {
    console.log(`Failed to find node ${target_node.name}!`);
  }
}

function changeLink(target_link, f) {
  var success = changeElement(window.graph.links, target_link, f)
  if (!success) {
    console.log(`Failed to find link ${linkName(target_link)}!`);
  }
}

function editNode(d) {
  d3.select('#link-menu').style('display', 'none');
  var nodeMenu = d3.select('#node-menu');
  nodeMenu.style('display', 'block');
  document.getElementById('edit-node-name').value = d.name;
  nodeMenu.select('#edit-node-name')
    .on('keyup', function () {
      changeNode(d, (n) => n.name = this.value);
    });
  document.getElementById('edit-node-r').value = d.r;
  nodeMenu.select('#edit-node-r')
    .on('input', function () {
      changeNode(d, (n) => n.r = this.value);
    });
  document.getElementById('edit-node-dashed').checked = d.dashed;
  nodeMenu.select('#edit-node-dashed')
    .on('change', function () {
      changeNode(d, (n) => n.dashed = d3.select(this).property('checked'));
    });
  nodeMenu.select('#delete-node')
    .on('click', function () {
      if (selected_node) {
        window.graph.nodes
          .splice(window.graph.nodes.indexOf(selected_node), 1);
        spliceLinksForNode(selected_node);
      }
      closeEditMenu();
      startGraphAnimation();
    });
}

function editLink(d) {
  d3.select('#node-menu').style('display', 'none');
  var linkMenu = d3.select('#link-menu');
  linkMenu.style('display', 'block');
  linkMenu.select('#link-name').text(linkName(d));
  linkMenu.select('#source-name').text(d.source.name);
  linkMenu.select('#target-name').text(d.target.name);
  linkMenu.select('#edit-center-text')
    .attr('value', d.centerText ? d.centerText : '')
    .on('keyup', function () {
      changeLink(d, (l) => l.centerText = this.value);
    });
  linkMenu.select('#edit-source-text')
    .attr('value', d.sourceText ? d.sourceText : '')
    .on('keyup', function () {
      changeLink(d, (l) => l.sourceText = this.value);
    });
  linkMenu.select('#edit-target-text')
    .attr('value', d.targetText ? d.targetText : '')
    .on('keyup', function () {
      changeLink(d, (l) => l.targetText = this.value);
    });
  linkMenu.select('#edit-strength')
    .attr('value', d.strength)
    .on('input', function () {
      changeLink(d, (l) => l.strength = this.value);
    });
  linkMenu.select('#edit-link-dashed')
    .property('checked', d.dashed)
    .on('change', function () {
      changeLink(d, (l) => l.dashed = d3.select(this).property('checked'));
    });
  linkMenu.select('#delete-link')
    .on('click', function () {
      if (selected_link) {
        window.graph.links
          .splice(window.graph.links.indexOf(selected_link), 1);
      }
      closeEditMenu();
      startGraphAnimation();
    });
}

function selectElement(target) {
  if (target === selected_link || target === selected_node) {
    // de-select
    closeEditMenu();
    return;
  }

  editing = true;
  if ('name' in target) { // selecting a node
    selected_link = null;
    selected_node = target;
    editNode(target);
  } else {
    selected_link = target;
    selected_node = null;
    editLink(target);
  }
}

function attachEvents() {
  node
    .on('mouseover', function (d) {
      // enlarge target node for link
      if (mousedown_node) {
        if (d === mousedown_node) {
          return;
        }
        d3.select(this)
          .attr('transform', d3.select(this).attr('transform') + ' scale(1.1)');
      }

    })
    .on('mouseout', function (d) {
      if (mousedown_node) {
        if (d === mousedown_node) {
          return;
        }
        // unenlarge target node for link
        d3.select(this)
          .attr('transform',
            d3.select(this).attr('transform').replace(' scale(1.1)', ''));
      }
    })
    .on('mousedown', function (d) {
      if (d3.event.ctrlKey) {
        return;
      }

      // save mousedown_node for later handling on mouseup and
      mousedown_node = d;

      // stop graph moving while we are dragging
      stopGraphAnimation();
      // reset drag line to be centered on mousedown_node
      drag_line
        .classed('hidden', false)
        .attr({
          'x1': mousedown_node.x,
          'y1': mousedown_node.y,
          'x2': mousedown_node.x,
          'y2': mousedown_node.y
        });

      // restart();
      // attachEvents()
    })
    .on('mouseup', function (d) {
      if (!mousedown_node) {
        return;
      }

      // needed by FF
      drag_line
        .classed('hidden', true)
        .style('marker-end', '');

      // are we making a new link or clicking on a new node?
      if (d === mousedown_node) {
        // we clicked on a node to edit it
        selectElement(d);
      } else {
        // shrink down the node we just moused over
        d3.select(this).attr('transform', '');
        // NB: links are strictly source < target; arrows separately specified by booleans
        // create and then select new link
        selectElement(addLink(mousedown_node, d));
      }

      resetMouseVars();
      startGraphAnimation();
    });

  path
    .on('mousedown', function (l) {
      if (d3.event.ctrlKey) {
        return;
      }

      // select link
      selectElement(l);
      resetMouseVars();
    })
    .on('mouseover', function (l) {
      console.log(`mouseover${linkName(l)}`);
      mouse_over_link = true;
    })
    .on('mouseout', function (l) {
      console.log(`mouseout${linkName(l)}`);
      mouse_over_link = false;
    });
}

function resetMouseVars() {
  mousedown_node = null;
  mouseup_node = null;
  mousedown_link = null;
}



function writeGraph() {
  d3.select('#graph-field').html(JSON.stringify(window.graph));
}

function spliceLinksForNode(node) {
  var toSplice = window.graph.links.filter(function (l) {
    return (l.source === node || l.target === node);
  });
  toSplice.map(function (l) {
    window.graph.links.splice(window.graph.links.indexOf(l), 1);
  });
}

function mousedown() {
  // prevent I-bar on drag
  //d3.event.preventDefault();

  // because :active only works in WebKit?
  svg.classed('active', true);

  if (d3.event.ctrlKey || d3.event.target.nodeName !== 'svg' || mouse_over_link) {
    return;
  }

  // insert new node at point
  var point = d3.mouse(this)
  selectElement(addNode(point));

  startGraphAnimation();
}

function addNode(point) {
  var newNode = {
    id: ++window.graph.lastId,
    name: 'New ' + window.graph.lastId,
    x: width / 2,
    y: height / 2,
    r: 12
  };
  if (point) {
    newNode.x = point[0];
    newNode.y = point[1];
  }
  window.graph.nodes.push(newNode);

  indexNodesAndLinks();
  attachEvents();
  return newNode;
}

function addLink(source, target) {
  console.log(`addLink(${source.name}, ${target.name})`)
  var link = window.graph.links.filter(function (l) {
    return (l.source === source && l.target === target) ||
      (l.source === target && l.target === source);
  })[0];

  if (!link) {
    link = {
      source: source,
      target: target,
      strength: 10,
      dashed: false,
      targetText: "",
      sourceText: "",
      centerText: ""
    };
    window.graph.links.push(link);

    indexNodesAndLinks();
    attachEvents();
  }

  return link;
}

function mousemove() {
  if (!mousedown_node) {
    return;
  }

  // update drag line
  var point = d3.mouse(this);
  drag_line
    .attr({
      'x1': mousedown_node.x,
      'y1': mousedown_node.y,
      'x2': point[0],
      'y2': point[1]
    });
}

function mouseup() {
  if (mousedown_node) {
    // hide drag line
    drag_line
      .classed('hidden', true)
      .style('marker-end', '');
  }
  if (editing) {
    return;
  }

  // because :active only works in WebKit?
  svg.classed('active', false);

  // clear mouse event vars
  resetMouseVars();
  startGraphAnimation();
}

// only respond once per keydown
var lastKeyDown = -1;

function keydown() {
  if (lastKeyDown !== -1) {
    return;
  }
  lastKeyDown = d3.event.keyCode;

  // ctrl
  if (d3.event.keyCode === 17) {
    node.call(force.drag);
    svg.classed('ctrl', true);
  }
}

function keyup() {
  lastKeyDown = -1;

  // ctrl
  if (d3.event.keyCode === 17) {
    node
      .on('mousedown.drag', null)
      .on('touchstart.drag', null);
    svg.classed('ctrl', false);
  }
}


function addTemplate(template) {
  var parts = template.split(';');
  var nodes = parts[0].split(',');
  var links = parts[1].split(',');
  var builtNodes = {};
  nodes.forEach(function (d) {
    builtNodes[d] = addNode(null);
  });
  links.forEach(function (d) {
    var linkParts = d.split('-');
    addLink(builtNodes[linkParts[0]], builtNodes[linkParts[1]]);
  })

  startGraphAnimation();
  attachEvents();
}

panel.on('mousedown', mousedown)
  .on('mousemove', mousemove)
  .on('mouseup', mouseup);
d3.select(window)
  .on('keydown', keydown)
  .on('keyup', keyup);
d3.select('.expand-help').on('click', function (e) {
  d3.event.preventDefault();
  var body = d3.select('.instructions .body');
  body.classed('hidden', !body.classed('hidden'));
});
attachEvents();