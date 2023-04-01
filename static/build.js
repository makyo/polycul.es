'use strict';

function attachEvents() {
  node
    .on('mouseover', function(d) {
      if (!mousedown_node || d === mousedown_node) {
        return;
      }
      // enlarge target node
      d3.select(this)
        .attr('transform', d3.select(this).attr('transform') + ' scale(1.1)');
    })
    .on('mouseout', function(d) {
      if (!mousedown_node || d === mousedown_node) {
        return;
      }
      // unenlarge target node
      d3.select(this)
        .attr('transform',
          d3.select(this).attr('transform').replace(' scale(1.1)', ''));
    })
    .on('mousedown', function(d) {
      if (d3.event.ctrlKey) {
        return;
      }

      // select node
      mousedown_node = d;
      if (mousedown_node === selected_node) {
        selected_node = null;
      }
      else selected_node = mousedown_node;
      selected_link = null;

      // reposition drag line
      drag_line
        .classed('hidden', false)
        .attr({
          'x1': mousedown_node.x,
          'y1': mousedown_node.y,
          'x2': mousedown_node.x,
          'y2': mousedown_node.y
        });

      restart();
      attachEvents()
    })
    .on('mouseup', function(d) {
      if (!mousedown_node) {
        return;
      }

      // needed by FF
      drag_line
        .classed('hidden', true)
        .style('marker-end', '');

      // check for drag-to-self
      mouseup_node = d;
      if (mouseup_node === mousedown_node) {
        editing = true;
        editNode(d);
        resetMouseVars();
        return;
      }

      // unenlarge target node
      d3.select(this).attr('transform', '');

      // add link to graph (update if exists)
      // NB: links are strictly source < target; arrows separately specified by booleans
      var source, target,
          source = mousedown_node;
          target = mouseup_node;

      var link = addLink(source, target)

      // select new link
      selected_link = link;
      selected_node = null;
      restart();
      attachEvents();
    });

  path
    .on('mousedown', function(d) {
      if (d3.event.ctrlKey) {
        return;
      }

      // select link
      mousedown_link = d;
      if (mousedown_link === selected_link) {
        selected_link = null;
      } else {
        selected_link = mousedown_link;
      }
      selected_node = null;
      editLink(d);
      resetMouseVars();
      restart();
    });
}

function resetMouseVars() {
  mousedown_node = null;
  mouseup_node = null;
  mousedown_link = null;
}

function resetMenus() {
  d3.select('#node-menu').style('display', 'none');
  d3.select('#link-menu').style('display', 'none');
}

function writeGraph() {
  d3.select('#graph-field').html(JSON.stringify(window.graph));
}

function spliceLinksForNode(node) {
  var toSplice = window.graph.links.filter(function(l) {
    return (l.source === node || l.target === node);
  });
  toSplice.map(function(l) {
    window.graph.links.splice(window.graph.links.indexOf(l), 1);
  });
}

function mousedown() {
  // prevent I-bar on drag
  //d3.event.preventDefault();

  // because :active only works in WebKit?
  svg.classed('active', true);

  if (d3.event.ctrlKey || d3.event.target.nodeName !== 'svg') {
    return;
  }

  // insert new node at point
  var point = d3.mouse(this)
  addNode(point);

  restart();
  attachEvents();
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
  return newNode;
}

function addLink(source, target) {
  var link = window.graph.links.filter(function(l) {
    return (l.source === source && l.target === target) ||
      (l.source === target && l.target === source);
  })[0];

  if (link) {
    return link;
  } else {
    link = {
      source: source,
      target: target,
      strength: 10
    };
    window.graph.links.push(link);
  }
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

  attachEvents();
  restart();
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
  if(d3.event.keyCode === 17) {
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

function editNode(d) {
  d3.select('#link-menu').style('display', 'none');
  var nodeMenu = d3.select('#node-menu');
  nodeMenu.style('display', 'block');
  document.getElementById('edit-node-name').value = d.name;
  nodeMenu.select('#edit-node-name')
    .on('keyup', function() {
      window.graph.nodes.filter(function(node) {
        return node === d;
      })[0].name = this.value;
      restart();
    });
  document.getElementById('edit-node-r').value = d.r;
  nodeMenu.select('#edit-node-r')
    .on('input', function() {
      window.graph.nodes.filter(function(node) {
        return node.id === d.id;
      })[0].r = this.value;
      restart();
    });
  document.getElementById('edit-node-dashed').checked = d.dashed;
  nodeMenu.select('#edit-node-dashed')
    .on('change', function() {
      window.graph.nodes.filter(function(link) {
        return link === d;
      })[0].dashed = d3.select(this).property('checked');
      restart();
    });
  document.getElementById('edit-node-color').value = d.color || "#888888";
  nodeMenu.select('#edit-node-color')
    .on('input', function() {
      window.graph.nodes.filter(function(link) {
        return link === d;
      })[0].color = d3.select(this).property('value');
      restart();
    });
  nodeMenu.select('#delete-node')
    .on('click', function() {
      if (selected_node) {
        window.graph.nodes
          .splice(window.graph.nodes.indexOf(selected_node), 1);
        spliceLinksForNode(selected_node);
      }
      selected_link = null;
      selected_node = null;
      restart();
      attachEvents();
      nodeMenu.style('display', 'none');
    });
  
  // Refresh the Coloris thumbnail
  document.querySelector('#edit-node-color').dispatchEvent(new Event('input', { bubbles: true }));
}

function editLink(d) {
  d3.select('#node-menu').style('display', 'none');
  var linkMenu = d3.select('#link-menu');
  linkMenu.style('display', 'block');
  linkMenu.select('#source-name').text(d.source.name);
  linkMenu.select('#target-name').text(d.target.name);
  linkMenu.select('#edit-center-text')
    .attr('value', d.centerText ? d.centerText : '')
    .on('keyup', function() {
      window.graph.links.filter(function(link) {
        return link === d;
      })[0].centerText = this.value;
      restart();
    });
  linkMenu.select('#edit-source-text')
    .attr('value', d.sourceText ? d.sourceText : '')
    .on('keyup', function() {
      window.graph.links.filter(function(link) {
        return link === d;
      })[0].sourceText = this.value;
      restart();
    });
  linkMenu.select('#edit-target-text')
    .attr('value', d.targetText ? d.targetText : '')
    .on('keyup', function() {
      window.graph.links.filter(function(link) {
        return link === d;
      })[0].targetText = this.value;
      restart();
    });
  linkMenu.select('#edit-strength')
    .attr('value', d.strength)
    .on('input', function() {
      window.graph.links.filter(function(link) {
        return link === d;
      })[0].strength = this.value;
      restart();
    });
  document.getElementById('edit-link-color').value = d.color || "rgba(0,0,0,0.25)";
  linkMenu.select('#edit-link-color')
    .property('value', d.color)
    .on('input', function() {
      window.graph.links.filter(function(link) {
        return link === d;
      })[0].color = d3.select(this).property('value');
      restart();
    });
  linkMenu.select('#edit-link-dashed')
    .property('checked', d.dashed)
    .on('change', function() {
      window.graph.links.filter(function(link) {
        return link === d;
      })[0].dashed = d3.select(this).property('checked');
      restart();
    });
  linkMenu.select('#delete-link')
    .on('click', function() {
      if (selected_link) {
        window.graph.links
          .splice(window.graph.links.indexOf(selected_link), 1);
      }
      selected_link = null;
      selected_node = null;
      restart();
      attachEvents();
      linkMenu.style('display', 'none');
    });
  
  // Refresh the Coloris thumbnail
  document.querySelector('#edit-link-color').dispatchEvent(new Event('input', { bubbles: true }));
}

function addTemplate(template) {
  var parts = template.split(';');
  var nodes = parts[0].split(',');
  var links = parts[1].split(',');
  var builtNodes = {};
  nodes.forEach(function(d) {
    builtNodes[d] = addNode(null);
  });
  links.forEach(function(d) {
    var linkParts = d.split('-');
    addLink(builtNodes[linkParts[0]], builtNodes[linkParts[1]]);
  })

  restart();
  attachEvents();
}


// Initial Coloris config
Coloris({
  theme: 'polaroid',
  formatToggle: true
})
// Remember previously used colors
let swatches = new Set();  // Use a Set to prevent duplicates
function addColor(event) {
  swatches.add(event.target.value);
  Coloris({
    swatches: Array.from(swatches)
  })
}
document.getElementById('edit-node-color').addEventListener('close', addColor);
document.getElementById('edit-link-color').addEventListener('close', addColor);

panel.on('mousedown', mousedown)
  .on('mousemove', mousemove)
  .on('mouseup', mouseup);
d3.select(window)
  .on('keydown', keydown)
  .on('keyup', keyup);
d3.select('.expand-help').on('click', function(e) {
  d3.event.preventDefault();
  var body = d3.select('.instructions .body');
  body.classed('hidden', !body.classed('hidden'));
});
