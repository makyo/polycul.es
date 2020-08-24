'use strict';

class D3EventObject {
  /* 
    Do not define an events static member, because the static 
    variable would be inhereted and shared by the subclasses.
    Instead, we define a events variable on each subclass.
  */

  static addEvent(name, func) {
    this.events[name] = func
  }

  static addEvents(obj) {
    Object.entries(obj).forEach(
      ([name, f]) => this.addEvent(name, f)
    )
  }

  static attach_events(data_binding) {
    Object.entries(this.events).forEach(
      ([name, f]) => (data_binding.on(name, f))
    )
  }
}

class Node extends D3EventObject {
  static events = {}

  constructor(id, point) {
    super();
    this.id = id;
    this.name = 'New ' + id;
    if (point) {
      this.x = point[0];
      this.y = point[1];
    } else {
      this.x = width / 2;
      this.y = height / 2;
    }
    this.r = 12;
  }

  static from(json) {
    let node = Object.assign(new Node(0), json);
    return node;
  }

  selected() { return this === selected_node }

  under_label_point() { return [this.x, this.y + this.r * 2]; }

  toString() { return `${this.name}[${this.x},${this.y}]`; }

  setScale(amount) {
    if (amount != 1) {
      this.scale = amount;
    } else {
      delete this.scale;
    }
    console.log(`${this}.setScale(${amount}) -> ${this.scale}`);
  }

  // Draw Functions
  static set_radius(node) { return node.r; }
  static set_stroke(node) { return node.selected() ? '#00FFFF' : '#888'; }
  static set_style(node) { return node.dashed ? 'fill:#ccc!important' : null; }
  static set_stroke_dash(node) { return node.dashed ? `${node.r / 4}, ${node.r / 4}` : null; }

  static set_text_y(node) { return - node.r - 2; }
  static set_text(node) { return node.name; }

  static transform(node) {
    let xform = `translate(${node.x}, ${node.y})`;
    if (node.scale) {
      xform += ` scale(${node.scale})`;
    }
    return xform;
  }

  static update_svg(data_binding) {
    data_binding.attr('transform', Node.transform)
    data_binding.select('text')
      .attr('y', Node.set_text_y)
      .text(Node.set_text);
    data_binding.select('circle')
      .attr('r', Node.set_radius)
      .attr('stroke', Node.set_stroke)
      .attr('style', Node.set_style)
      .attr('stroke-dasharray', Node.set_stroke_dash);
  }

  static create_svg(data_binding) {
    let node_elements = data_binding.enter()
      .append('g')
      .classed('node', true);

    // circle (node) group
    node_elements.append('circle')
      .attr('r', Node.set_radius)
      .attr('stroke', Node.set_stroke)
      .attr('style', Node.set_style)
      .attr('stroke-dasharray', Node.set_stroke_dash);

    // show node IDs
    node_elements.append('text')
      .attr('class', 'node-name')
      .attr('text-anchor', 'middle')
      .attr('x', 0)
      .attr('y', Node.set_text_y)
      .text(Node.set_text);

    return node_elements;
  }
}

class Link extends D3EventObject {
  static events = {}

  constructor(source, target) {
    super();
    this.source = source;
    this.target = target;
    this.strength = 10;
    this.dashed = false;
    this.targetText = "";
    this.sourceText = "";
    this.centerText = "";
  }

  selected() {
    return this == selected_link;
  }

  name() {
    return `[${this.source.name}]->[${this.target.name}]`;
  }

  toString() { return this.name(); }

  static search_index(index, source, target) {
    var link = index.filter(function (l) {
      return (l.source === source && l.target === target) ||
        (l.source === target && l.target === source);
    });

    if (link.length) {
      return link[0];
    }

    return null;
  }

  static from(json) {
    return Object.assign(new Link(null, null), json);
  }

  // position setters
  static source_x(link) { return link.source.x; }
  static source_y(link) { return link.source.y; }
  static target_x(link) { return link.target.x; }
  static target_y(link) { return link.target.y; }
  static midpoint_x(link) { return (link.source.x + ((link.target.x - link.source.x) / 2)); }
  static midpoint_y(link) { return (link.source.y + ((link.target.y - link.source.y) / 2)); }
  static source_text_x(link) { return link.source.under_label_point()[0]; }
  static source_text_y(link) { return link.source.under_label_point()[1]; }
  static target_text_x(link) { return link.target.under_label_point()[0]; }
  static target_text_y(link) { return link.target.under_label_point()[1]; }

  // style setters
  static stroke(link) { return link.selected() ? '#00FFFF' : 'rgba(0,0,0,0.25)'; }
  static stroke_width(link) { return link.strength; }
  static stroke_dash(link) { return link.dashed ? `${link.strength / 1.5}, ${link.strength / 1.5}` : null; }

  static update_line(data_binding) {
    data_binding
      .attr('x1', Link.source_x)
      .attr('y1', Link.source_y)
      .attr('x2', Link.target_x)
      .attr('y2', Link.target_y)
      .attr('stroke', Link.stroke)
      .attr('stroke-width', Link.stroke_width)
      .attr('stroke-dasharray', Link.stroke_dash);
  }

  static update_text(data_binding) {
    data_binding.select('.center-text')
      .attr('dx', Link.midpoint_x)
      .attr('dy', Link.midpoint_y)
      .text(function (d) { return d.centerText; });
    data_binding.select('.source-text')
      .attr('dx', Link.source_text_x)
      .attr('dy', Link.source_text_y)
      .text(function (d) { return d.sourceText; });
    data_binding.select('.target-text')
      .attr('dx', Link.target_text_x)
      .attr('dy', Link.target_text_y)
      .text(function (d) { return d.targetText; });
  }

  static update_svg(data_binding) {
    Link.update_line(data_binding.select('line'));
    Link.update_text(data_binding);
  }

  static create_svg(data_binding) {
    var path_elements = data_binding.enter()
      .append('g')
      .classed('link', true);

    Link.update_line(path_elements.append('line'));

    path_elements.append('text').attr('class', 'center-text meaning hidden');
    path_elements.append('text').attr('class', 'source-text meaning hidden');
    path_elements.append('text').attr('class', 'target-text meaning hidden');

    Link.update_text(path_elements);
  }
}

Link.addEvents({
  mouseover: function () {
    d3.select(this).selectAll('.meaning').classed('hidden', false);
  },
  mouseout: function () {
    d3.select(this).selectAll('.meaning').classed('hidden', true);
  }
})

// set up SVG for D3
const repaint_delay = 0;
var width = 960,
  height = 500,
  repaint_soon = null,
  full_repaint = true,
  node_props_updated_by_tick = ['x', 'y', 'px', 'py'],
  selected_node = null,
  selected_link = null,
  mousedown_link = null,
  mousedown_node = null,
  mouseup_node = null,
  mouse_over_link = false,
  editing = false,
  scale = window.graph.scale || 1,
  translate = window.graph.translate || [0, 0];

// View management functions

var panel = d3.select('#panel')
  .attr('oncontextmenu', 'return false;')
  .attr('width', width)
  .attr('height', height);
var translateContainer = panel.append('g')
  .attr('transform', 'translate(' + translate + ')');
var scaleContainer = translateContainer.append('g')
  .attr('transform', 'scale(' + scale + ')');
var svg = scaleContainer.append('g');

function zoom(newScale) {
  var oldscale = scale;
  scale += newScale;
  window.graph.scale = scale;
  scaleContainer.attr('transform', 'scale(' + scale + ')');

  translate = [
    translate[0] + ((width * oldscale) - (width * scale)),
    translate[1] + ((height * oldscale) - (height * scale))
  ];
  window.graph.translate = translate;
  translateContainer.attr('transform', 'translate(' + translate + ')');

  try {
    writeGraph();
  } catch (e) {
    //
  }
}

function pan(vert, horiz) {
  translate = [
    translate[0] + horiz,
    translate[1] + vert
  ];
  window.graph.translate = translate;
  translateContainer.attr('transform', 'translate(' + translate + ')');

  try {
    writeGraph();
  } catch (e) {
    //
  }
}

d3.select('#in')
  .on('click', function () {
    zoom(0.1);
  });
d3.select('#out')
  .on('click', function () {
    zoom(-0.1);
  });
d3.select('#up')
  .on('click', function () {
    pan(10, 0);
  });
d3.select('#down')
  .on('click', function () {
    pan(-10, 0);
  });
d3.select('#left')
  .on('click', function () {
    pan(0, 10);
  });
d3.select('#right')
  .on('click', function () {
    pan(0, -10);
  });

// Drawing management functions

function simUpdate() {
  Link.update_svg(path);
  Node.update_svg(node);
}

// update force layout (called automatically each iteration)
function repaint() {
  if (full_repaint) {
    path = path.data(window.graph.links);
    // NB: the function arg is crucial here! nodes are known by id, not by index!
    node = node.data(window.graph.nodes, function (d) { return d.id; });

    // paint any new nodes
    Link.create_svg(path);
    Node.create_svg(node);

    // attach d3 events to nodes and links
    Link.attach_events(path);
    Node.attach_events(node);

    // remove old elements
    node.exit().remove();
    path.exit().remove();

    // save changes if needed
    if (typeof writeGraph != 'undefined') {
      writeGraph();
    }
    // (re)start the graph moving
    force.start();
  } else {
    // d3js is running a physics 'sim' on the nodes and edges, 
    // but we need to issue the draw commands
    Link.update_svg(path);
    Node.update_svg(node);
  }

  // mini-repaint housekeeping
  full_repaint = false;
  // avoid double calls
  clearTimeout(repaint_soon);
  repaint_soon = null;
}

function trigger_repaint_style() {
  if (repaint_soon === null) {
    repaint_soon = setTimeout(repaint, repaint_delay);
  }
}

function trigger_full_repaint() {
  // called when we add or remove elements
  full_repaint = true;
  trigger_repaint_style();
}

// Use proxy objects to trigger a draw call if needed
function style_repaint_on_set(object, props_to_ignore) {
  if (typeof props_to_ignore === 'undefined') {
    props_to_ignore = [];
  }

  return new Proxy(object, {
    set: function (obj, prop, value) {
      if (!props_to_ignore.includes(prop)) {
        trigger_repaint_style();
      }
      obj[prop] = value;
      return true;
    },
    deleteProperty: function (o, k) {
      delete o[k];
      if (!props_to_ignore.includes(prop)) {
        trigger_repaint_style();
      }
      return true;
    }
  });
}


function loadNode(json) { return style_repaint_on_set(Node.from(json), node_props_updated_by_tick); }
function loadLink(json) {
  // we're restaring from stored JSON
  let link = Link.from(json);

  // stored version will have a deep copy, find proper references
  window.graph.nodes.forEach(function (node) {
    if (node.id === link.source.id) {
      link.source = node;
    }
    if (node.id === link.target.id) {
      link.target = node;
    }
  });

  return style_repaint_on_set(link);
}

console.log(`loading graph items`);
window.graph.nodes = window.graph.nodes.map(loadNode);
window.graph.links = window.graph.links.map(loadLink);

console.log(`creating force - full_repaint:${full_repaint}`);
// init D3 force layout
var force = d3.layout.force()
  .nodes(window.graph.nodes)
  .links(window.graph.links)
  .size([width / scale, height / scale])
  .linkDistance(function (d) { return Math.log(3 / d.strength * 10) * 50; })
  .charge(-500)
  .on('tick', simUpdate);

// line displayed when dragging new nodes
var drag_line = svg.append('line')
  .attr('class', 'link dragline hidden');

// handles to link and node element groups
var path = svg.append('g').selectAll('.link'),
  node = svg.append('g').selectAll('.node');

function startGraphAnimation() {
  console.log('startGraphAnimation');
  // rebuild nodes and links
  trigger_full_repaint();
  // don't wait 
  repaint();

  try {
    writeGraph();
  } catch (e) {
    // Start dragging behavior if we are not editing the graph
    node.call(force.drag);
  }
}

function panzoom() {
  d3.event.preventDefault()
  switch (d3.event.key) {
    case 'ArrowUp':
    case 'w':
    case 'k':
      pan(10, 0);
      break;
    case 'ArrowDown':
    case 's':
    case 'j':
      pan(-10, 0);
      break;
    case 'ArrowLeft':
    case 'a':
    case 'h':
      pan(0, 10);
      break;
    case 'ArrowRight':
    case 'd':
    case 'l':
      pan(0, -10);
      break;
    case '+':
      zoom(0.1);
      break;
    case '-':
      zoom(-0.1);
      break;
  }
}

d3.select(window)
  .on('keydown', panzoom);

console.log(`Calling base start`);
// app starts here
startGraphAnimation();