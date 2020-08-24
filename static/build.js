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

function selectElement(target) {
  trigger_repaint_style();
  if (target === selected_link || target === selected_node) {
    // de-select
    closeEditMenu();
  } else {
    editing = true;
    if (target instanceof Node) { // selecting a node
      selected_link = null;
      selected_node = target;
      editNode(target);
    } else {
      selected_link = target;
      selected_node = null;
      editLink(target);
    }
  }
}

function resetMouseVars() {
  mousedown_node = null;
}

// d3 events
Link.addEvents({
  mousedown: function (l) {
    if (d3.event.ctrlKey) {
      return;
    }

    // select link
    selectElement(l);
    resetMouseVars();
  }
});

Node.addEvents({
  mouseover: function (d) {
    // enlarge target node for link
    if (mousedown_node && d != mousedown_node) {
      d.setScale(1.1);
    }

  },
  mouseout: function (d) {
    if (mousedown_node && d != mousedown_node) {
      // unenlarge target node for link
      d.setScale(1);
    }
  },
  mousedown: function (d) {
    if (d3.event.ctrlKey) {
      return;
    }

    // save mousedown_node for later handling on mouseup and
    mousedown_node = d;

    // reset drag line to be centered on mousedown_node
    drag_line
      .classed('hidden', false)
      .attr({
        'x1': mousedown_node.x,
        'y1': mousedown_node.y,
        'x2': mousedown_node.x,
        'y2': mousedown_node.y
      });

  },
  mouseup: function (d) {
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
      d.setScale(1);
      // create and then select new link
      selectElement(createLink(mousedown_node, d));
    }

    resetMouseVars();
    startGraphAnimation();
  }
});


function editNode(d) {
  // hide link menu
  d3.select('#link-menu').style('display', 'none');
  var nodeMenu = d3.select('#node-menu');
  nodeMenu.style('display', 'block');
  // We wish we could use arrow functions here but they don't have a semantic this
  nodeMenu.select('#edit-node-name')
    .property('value', d.name)
    .on('keyup', function () { d.name = this.value; });
  nodeMenu.select('#edit-node-r')
    .property('value', d.r)
    .on('input', function () { d.r = this.value; });
  nodeMenu.select('#edit-node-dashed')
    .property('value', d.dashed)
    .on('change', function () { d.dashed = d3.select(this).property('checked') });
  nodeMenu.select('#delete-node')
    .on('click', function () {
      if (selected_node) {
        removeNode(selected_node);
      }
      closeEditMenu();
    });
}

function editLink(d) {
  d3.select('#node-menu').style('display', 'none');
  var linkMenu = d3.select('#link-menu');
  linkMenu.style('display', 'block');
  linkMenu.select('#link-name').text(d.name());
  linkMenu.select('#source-name').text(d.source.name);
  linkMenu.select('#target-name').text(d.target.name);
  linkMenu.select('#edit-center-text')
    .property('value', d.centerText)
    .on('keyup', function () { d.centerText = this.value; });
  linkMenu.select('#edit-source-text')
    .property('value', d.sourceText)
    .on('keyup', function () { d.sourceText = this.value; });
  linkMenu.select('#edit-target-text')
    .property('value', d.targetText)
    .on('keyup', function () { d.targetText = this.value; });
  linkMenu.select('#edit-strength')
    .property('value', d.strength)
    .on('input', function () { d.strength = this.value; });
  linkMenu.select('#edit-link-dashed')
    .property('checked', d.dashed)
    .on('click', function () {
      d.dashed = d3.select(this).property('checked');
    });
  linkMenu.select('#delete-link')
    .on('click', function () {
      if (selected_link) {
        removeLink(selected_link);
      }
      closeEditMenu();
    });
}

// Node and Link creation and destruction methods

function createNode(point) {
  let node = style_repaint_on_set(new Node(++window.graph.lastId, point), node_props_updated_by_tick);
  window.graph.nodes.push(node);
  trigger_full_repaint();
  return node;
}

function createLink(source, target) {
  let existing = Link.search_index(window.graph.links, source, target);

  if (existing) {
    // Don't create dupliacte links
    return existing;
  }

  let link = style_repaint_on_set(new Link(source, target))
  window.graph.links.push(link);
  trigger_full_repaint();
  return link;
}

function removeLink(link) {
  let was_inserted = window.graph.links.indexOf(link);
  if (was_inserted >= 0) {
    window.graph.links.splice(was_inserted, 1);
  }

  trigger_full_repaint();
  return link;
}

function removeNode(node) {
  let was_inserted = window.graph.nodes.indexOf(node);
  if (was_inserted >= 0) {
    // remove from node list
    window.graph.nodes.splice(was_inserted, 1);
    // remove all references from links
    window.graph.links
      .filter((l) => (l.source === node || l.target === node)).
      forEach((link) => removeLink(link));
  }
  // alaways decrement, even if the node wasn't inserted for some reason
  window.graph.lastId--;

  trigger_full_repaint();
  return node;
}


function writeGraph() {
  d3.select('#graph-field').html(JSON.stringify(window.graph));
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
  selectElement(createNode(point));
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
    builtNodes[d] = createNode(null);
  });
  links.forEach(function (d) {
    var linkParts = d.split('-');
    createLink(builtNodes[linkParts[0]], builtNodes[linkParts[1]]);
  })
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

console.log(`Calling base start`);
// call again, which will disable dragging behavior
startGraphAnimation();