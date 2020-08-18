'use strict';

// set up SVG for D3
var width = 960,
  height = 500,
  selected_node = null,
  selected_link = null,
  mousedown_link = null,
  mousedown_node = null,
  mouseup_node = null,
  mouse_over_link = false,
  editing = false,
  scale = window.graph.scale || 1,
  translate = window.graph.translate || [0, 0];

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


window.graph.links.forEach(function (link) {
  window.graph.nodes.forEach(function (node) {
    if (node.id === link.source.id) {
      link.source = node;
    }
    if (node.id === link.target.id) {
      link.target = node;
    }
  });
});

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

// init D3 force layout
var force = d3.layout.force()
  .nodes(window.graph.nodes)
  .links(window.graph.links)
  .size([width / scale, height / scale])
  .linkDistance(function (d) { return Math.log(3 / d.strength * 10) * 50; })
  .charge(-500)
  .on('tick', tick)


// line displayed when dragging new nodes
var drag_line = svg.append('line')
  .attr('class', 'link dragline hidden');

// handles to link and node element groups
var path = svg.append('g').selectAll('.link'),
  node = svg.append('g').selectAll('.node');

// update force layout (called automatically each iteration)
function tick() {
  if (!drag_line.classed('hidden')) {
    return;
  }
  path.select('line')
    .attr('x1', function (d) { return d.source.x; })
    .attr('y1', function (d) { return d.source.y; })
    .attr('x2', function (d) { return d.target.x; })
    .attr('y2', function (d) { return d.target.y; })
  path.select('.source-text')
    .attr('dx', function (d) { return d.source.x })
    .attr('dy', function (d) { return d.source.y + d.source.r * 2 });
  path.select('.target-text')
    .attr('dx', function (d) { return d.target.x })
    .attr('dy', function (d) { return d.target.y + d.target.r * 2 });
  path.select('.center-text')
    .attr('dx', function (d) {
      return (d.source.x + ((d.target.x - d.source.x) / 2));
    })
    .attr('dy', function (d) {
      return (d.source.y + ((d.target.y - d.source.y) / 2)) - 10;
    });
  node.attr('transform', function (d) {
    return 'translate(' + d.x + ',' + d.y + ')';
  });
}

// (re)build graph (called when needed)
function indexNodesAndLinks() {
  // path (link) group
  path = path.data(window.graph.links);

  // update existing links
  path.classed('selected', function (d) { return d === selected_link; });


  // add new links
  var pathG = path.enter()
    .append('g')
    .classed('link', true)
    .classed('selected', function (d) { return d === selected_link; });
  pathG.append('line')
    .attr('x1', function (d) { return d.source.x; })
    .attr('y1', function (d) { return d.source.y; })
    .attr('x2', function (d) { return d.target.x; })
    .attr('y2', function (d) { return d.target.y; })
    .attr('stroke-width', function (d) { return d.strength; })
    .attr('stroke-dasharray', function (d) {
      if (d.dashed) {
        return '' + [d.strength / 1.5, d.strength / 1.5];
      }
    });
  pathG.append('text')
    .attr('class', 'center-text meaning hidden');
  pathG.append('text')
    .attr('class', 'source-text meaning hidden');
  pathG.append('text')
    .attr('class', 'target-text meaning hidden');
  // remove old links
  path.exit().remove();

  path.select('line')
    .attr('stroke-width', function (d) { return d.strength; })
    .attr('stroke-dasharray', function (d) {
      if (d.dashed) {
        return '' + [d.strength / 1.5, d.strength / 1.5];
      }
    });
  path.select('.center-text')
    .text(function (d) { return d.centerText; });
  path.select('.source-text')
    .text(function (d) { return d.sourceText; });
  path.select('.target-text')
    .text(function (d) { return d.targetText; });
  path.on('mouseover', function (d) {
    d3.select(this).selectAll('.meaning')
      .classed('hidden', false);
  })
    .on('mouseout', function (d) {
      d3.select(this).selectAll('.meaning')
        .classed('hidden', true);
    });

  // circle (node) group
  // NB: the function arg is crucial here! nodes are known by id, not by index!
  node = node.data(window.graph.nodes, function (d) { return d.id; });

  // add new nodes
  var nodeG = node.enter()
    .append('g')
    .classed('node', true);

  nodeG.append('circle')
    .attr('class', 'node')
    .attr('r', function (d) { return d.r; })
    .attr('style', function (d) {
      if (d.dashed) {
        return 'fill:#ccc!important';
      }
    })
    .attr('stroke-dasharray', function (d) {
      if (d.dashed) {
        return '' + [d.r / 4, d.r / 4];
      }
    });

  // show node IDs
  nodeG.append('text')
    .attr('x', 0)
    .attr('y', function (d) { return -d.r - 2; })
    .attr('class', 'id')
    .attr('text-anchor', 'middle')
    .text(function (d) { return d.name; });

  node.select('circle')
    .attr('r', function (d) { return d.r; })
    .attr('style', function (d) {
      if (d.dashed) {
        return 'fill:#ccc!important';
      }
    })
    .attr('stroke-dasharray', function (d) {
      if (d.dashed) {
        return '' + [d.r / 4, d.r / 4];
      }
    });

  node.select('.id')
    .attr('y', function (d) { return -d.r - 2; })
    .text(function (d) { return d.name; });

  // remove old nodes
  node.exit().remove();
}

function startGraphAnimation() {
  // rebuild nodes and links
  indexNodesAndLinks();

  // set the graph in motion
  force.start();
  try {
    writeGraph();
  } catch (e) {
    node.call(force.drag);
  }
}

// stop graph moving automatically
function stopGraphAnimation() {
  force.stop();
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

// app starts here
startGraphAnimation();