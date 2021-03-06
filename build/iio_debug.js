/*
iio.js
Version 1.4beta

iio.js is licensed under the BSD 2-clause Open Source license

Copyright (c) 2014, Sebastian Bierman-Lytle
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, 
are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list 
of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this
list of conditions and the following disclaimer in the documentation and/or other 
materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. 
IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, 
INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT 
NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, 
OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, 
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) 
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE 
POSSIBILITY OF SUCH DAMAGE.
*/
iio = {};
iio.apps = [];
iio.scripts = iio.scripts || {};

//INITIALIZATION
iio.start = function(app, id, d) {
  
  var c = iio.canvas.prep(id, d);

  //initialize application with settings
  if (app instanceof Array)
    return new iio.App(c, app[0], app[1]);

  //run iio file
  /*else if (iio.is.string(app) && app.substring(app.length - 4) == '.iio')
    return iio.read(app, iio.start);*/

  //initialize application without settings
  return new iio.App(c, app);

  /*preppedApp = function() {
    var c = iio.canvas.prep(id, d);

    //initialize application with settings
    if (app instanceof Array)
      return new iio.App(c, app[0], app[1]);

    //initialize application without settings
    return new iio.App(c, app);
  }

  var event;
  if (app instanceof Array)
    app = app[0];
  if (typeof(app) === "string")
    event = "iioscript:" + app;

  if (window.addEventListener) {
    event = event || 'DOMContentLoaded';
    window.addEventListener(event, preppedApp, false);
  } else {
    event = event || 'onload';
    window.attachEvent(event, preppedApp);
  }*/
}
iio.stop = function( app ){
  if(!app)
    for(var i=0; i<iio.apps.length; i++)
      iio.cancelLoops(iio.apps[i]);
}

iio.script = function() {
  if (typeof CoffeeScript == 'undefined') return;
  var scripts = Array.prototype.slice.call(document.getElementsByTagName('script'));
  var iioScripts = scripts.filter(function(s) {
    return s.type === 'text/iioscript';
  });
  iioScripts.forEach(function(script) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", script.src, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status == 0)){
        var appName = script.src.split("/").pop().replace(/\.[^/.]+$/, "");
        iio.scripts[appName] = eval("(function() {\nreturn function(app, settings) {\n" + 
									   CoffeeScript.compile(xhr.responseText, {bare: true}) + 
									   "}\n})()");
        window.dispatchEvent(new Event("iioscript:" + appName));
      }
    }
    xhr.send(null);
  });
}

// Listen for window load, both in decent browsers and in IE
if (window.addEventListener)
  window.addEventListener('DOMContentLoaded', iio.script, false);
else
  window.attachEvent('onload', iio.script);

//JS ADDITIONS
Array.prototype.insert = function(index, item) {
  this.splice(index, 0, item);
  return this;
}
if (Function.prototype.name === undefined){
  // Add a custom property to all function values
  // that actually invokes a method to get the value
  Object.defineProperty(Function.prototype,'name',{
    get:function(){
      return /function ([^(]*)/.exec( this+"" )[1];
    }
  });
}

//UTIL FUNCTIONS
function emptyFn() {};
iio.inherit = function(child, parent) {
  var tmp = child;
  emptyFn.prototype = parent.prototype;
  child.prototype = new emptyFn();
  child.prototype.constructor = tmp;
}
iio.merge = function(o1,o2){
  for(var p in o2)
    o1[p] = o2[p];
  return o1;
}
iio.merge_args = function(o1){
  if(o1){
    var o2 = {};
    for(var i=0; i<o1.length; i++)
      o2 = iio.merge(o2,o1[i]);
    return o2;
  }
  return o1;
}
iio.addEvent = function(obj, evt, fn, capt) {
  if (obj.addEventListener) {
    obj.addEventListener(evt, fn, capt);
    return true;
  } else if (obj.attachEvent) {
    obj.attachEvent('on' + evt, fn);
    return true;
  } else return false;
}
iio.set = function(os, p) {
  os.forEach(function(o) {
    o.set(p);
  });
}
iio.random = function(min, max) {
  min = min || 0;
  max = (max === 0 || typeof(max) != 'undefined') ? max : 1;
  return Math.random() * (max - min) + min;
}
iio.randomInt = function(min, max) {
  return Math.floor(iio.random(min, max));
}
iio.centroid = function(vs){
  var cX,cY;
  for (var i=0;i<vs.length;i++){
     cX+=vs[i].x;
     cY+=vs[i].y;
  } return new iio.Vector(cX/vs.length,cY/vs.length);
}
iio.specVec = function(vs,comparator){
  var v = vs[0];
  for (var i=0;i<vs.length;i++)
     if (comparator(v,vs[i]))
        v=vs[i];
  return v;
}

//IO
iio.load = function(src, onload) {
  var img = new Image();
  img.src = src;
  img.onload = onload;
  return img;
}
iio.read = function(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status == 0))
      return callback(xhr.responseText);
  }
  xhr.send(null);
}

//LOOPING
iio.loop = function(fps, caller, fn) {

  // LOOP USING setTimeout
  if (iio.is.number(fps) || typeof window.requestAnimationFrame == 'undefined' || !fps.af) {
    if (typeof(fps.af) != 'undefined' && typeof(fps.fps) == 'undefined') {
      fn = caller;
      caller = fps;
      fps = 60;
    } else if (!iio.is.number(fps)) {
      caller = fps;
      fps = fps.fps;
    }

    function loop() {
      var n = new Date().getTime();
      if (typeof caller.last == 'undefined') var first = true;
      var correctedFPS = Math.floor(Math.max(0, 1000 / fps - (n - (caller.last || fps))));
      caller.last = n + correctedFPS;
      var nufps;
      if (typeof first == 'undefined') {
        if (typeof caller.fn == 'undefined')
          nufps = caller.o._update(caller.o, correctedFPS);
        else if (iio.is.fn(caller.fn))
          nufps = caller.fn(caller.o, caller, correctedFPS);
        else nufps = caller.fn._update(caller, correctedFPS);
        caller.o.app.draw();
      }
      if (typeof nufps == 'undefined')
        caller.id = window.setTimeout(loop, correctedFPS);
      else {
        fps = nufps;
        caller.id = window.setTimeout(loop, 1000 / nufps);
      }
      //if(fn)fn(caller,correctedFPS/(1000/fps));
    };
    caller.id = window.setTimeout(loop, 1000 / fps);
    return caller.id;
  } 

  // LOOP USING requestAnimationFrame
  else {
    fn = caller;
    caller = fps;

    function animloop() {
      if (typeof caller.fn == 'undefined') caller.o.draw();
      else if (iio.is.fn(caller.fn)) caller.fn(caller.o);
      else {
        caller.fn._update();
        caller.fn.draw();
      }
      caller.o.app.draw();
      caller.id = window.requestAnimationFrame(animloop);
    }
    caller.id = window.requestAnimationFrame(animloop);
    return caller.id;
  }
}
iio.cancelLoop = function(l) {
  window.clearTimeout(l);
  window.cancelAnimationFrame(l);
}
iio.cancelLoops = function(o, c) {
  if( o.loops ) o.loops.forEach(function(loop) {
    iio.cancelLoop(loop.id);
  });
  if ( o.mainLoop ) 
    iio.cancelLoop(o.mainLoop.id);
  if ( typeof c == 'undefined' && o.objs )
    o.objs.forEach(function(obj) {
      iio.cancelLoops(obj);
    });
}

//INPUT LISTENERS
iio.resize = function() {
  iio.apps.forEach(function(app) {
    if (app.canvas.fullscreen) {
      if (window.jQuery) {
        app.canvas.width = $(window).width();
        app.canvas.height = $(window).height();
      } else {
        app.canvas.width = window.innerWidth;
        app.canvas.height = window.innerHeight;
      }
    }
    app.width = app.canvas.width;
    app.height = app.canvas.height;
    app.center.x = app.canvas.width / 2;
    app.center.y = app.canvas.height / 2;
    if (app.script && app.script.resize) app.script.resize();
    app.draw();
  });
}
iio.prep_input = function() {
  window.onresize = iio.resize;
  iio.addEvent(window, 'keydown', function(e) {
    var k = iio.key.string(e);
    iio.apps.forEach(function(app) {
      if (app.script && app.script.keyDown)
        app.script.keyDown(e, k);
    });
  });
  iio.addEvent(window, 'keyup', function(e) {
    var k = iio.key.string(e);
    iio.apps.forEach(function(app) {
      if (app.script&& app.script.keyUp)
        app.script.keyUp(e, k);
    });
  });
  iio.addEvent(window, 'scroll', function(event) {
    iio.apps.forEach(function(app) {
      var p = app.canvas.getBoundingClientRect();
      app.pos = {
        x: p.left,
        y: p.top
      };
    });
  });
}
iio.prep_input();

//DEPRECATED
iio.createGradient = function(ctx, g) {
  var gradient;
  var p = g.split(':');
  var ps = p[1].split(',');
  if (ps.length == 4)
    gradient = ctx.createLinearGradient(ps[0], ps[1], ps[2], ps[3]);
  else gradient = ctx.createRadialGradient(ps[0], ps[1], ps[2], ps[3], ps[4], ps[5]);
  var c;
  p.forEach(function(_p) {
    c = _p.indexOf(',');
    var a = parseFloat(_p.substring(0, c));
    var b = _p.substring(c + 1);
    gradient.addColorStop(a, b);
  });
  return gradient;
}

;
//UTIL LIBRARIES
iio.is = {
  fn: function(fn) {
    return typeof fn === 'function'
  },
  number: function(o) {
    if (typeof o === 'number') return true;
    //return (o - 0) == o && o.length > 0;
  },
  string: function(s) {
    return typeof s == 'string' || s instanceof String
  },
  filetype: function(file, extensions) {
    return extensions.some(function(ext) {
      return (file.indexOf('.' + ext) != -1)
    });
  },
  image: function(file) {
    return this.filetype(file, ['png', 'jpg', 'gif', 'tiff']);
  },
  sound: function(file) {
    return this.filetype(file, ['wav', 'mp3', 'aac', 'ogg']);
  },
  between: function(val, min, max) {
    if (max < min) {
      var tmp = min;
      min = max;
      max = tmp;
    }
    return (val >= min && val <= max);
  }
}

iio.convert = {
  property: {
    color: function(o,c){
      if(o[c] && iio.is.string(o[c])) o[c] = iio.convert.color(o[c]);
    },
    vector: function(o,v){
      if(o[v]) o[v] = iio.convert.vector(o[v]);
    },
    vectors: function(o,v){
      if(o[v]) o[v] = iio.convert.vectors(o[v]);
    }
  },
  color: function(c){
    return iio.Color[c.toLowerCase()]();
  },
  vector: function(v){
    if(v instanceof Array)
      return new iio.Vector(v);
    else if( !(v instanceof iio.Vector) )
      return new iio.Vector(v,v);
    else return v;
  },
  vectors: function(vs){
    for(var i=0; i<vs.length; i++)
      vs[i] = iio.convert.vector( vs[i] );
    return vs;
  }
}

iio.point = {
  rotate: function(x, y, r) {
    if (typeof x.x != 'undefined') {
      r = y;
      y = x.y;
      x = x.x;
    }
    if (typeof r == 'undefined' || r == 0) return {
      x: x,
      y: y
    }
    var newX = x * Math.cos(r) - y * Math.sin(r);
    var newY = y * Math.cos(r) + x * Math.sin(r);
    return {
      x: newX,
      y: newY
    };
  },
  vector: function(points) {
    var vecs = [];
    if (!(points instanceof Array)) points = [points];
    for (var i = 0; i < points.length; i++) {
      if (typeof points[i].x != 'undefined')
        vecs.push(points[i]);
      else {
        vecs.push({
          x: points[i],
          y: points[i + 1]
        });
        i++;
      }
    }
    return vecs;
  }
}

iio.keys = {
      8: 'backspace',
      9: 'tab',
      13: 'enter',
      16: 'shift',
      17: 'ctrl',
      18: 'alt',
      19: 'pause',
      20: 'caps lock',
      27: 'escape',
      32: 'space',
      33: 'page up',
      34: 'page down',
      35: 'end',
      36: 'home',
      37: 'left arrow',
      38: 'up arrow',
      39: 'right arrow',
      40: 'down arrow',
      45: 'insert',
      46: 'delete',
      48: '0',
      49: '1',
      50: '2',
      51: '3',
      52: '4',
      53: '5',
      54: '6',
      55: '7',
      56: '8',
      57: '9',
      65: 'a',
      66: 'b',
      67: 'c',
      68: 'd',
      69: 'e',
      70: 'f',
      71: 'g',
      72: 'h',
      73: 'i',
      74: 'j',
      75: 'k',
      76: 'l',
      77: 'm',
      78: 'n',
      79: 'o',
      80: 'p',
      81: 'q',
      82: 'r',
      83: 's',
      84: 't',
      85: 'u',
      86: 'v',
      87: 'w',
      88: 'x',
      89: 'y',
      90: 'z',
      91: 'left window',
      92: 'right window',
      93: 'select key',
      96: 'n0',
      97: 'n1',
      98: 'n2',
      99: 'n3',
      100: 'n4',
      101: 'n5',
      102: 'n6',
      103: 'n7',
      104: 'n8',
      105: 'n9',
      106: 'multiply',
      107: 'add',
      109: 'subtract',
      110: 'dec',
      111: 'divide',
      112: 'f1',
      113: 'f2',
      114: 'f3',
      115: 'f4',
      116: 'f5',
      117: 'f6',
      118: 'f7',
      119: 'f8',
      120: 'f9',
      121: 'f10',
      122: 'f11',
      123: 'f12',
      144: 'num lock',
      156: 'scroll lock',
      186: 'semi-colon',
      187: 'equal',
      188: 'comma',
      189: 'dash',
      190: 'period',
      191: 'forward slash',
      192: 'grave accent',
      219: 'open bracket',
      220: 'back slash',
      221: 'close bracket',
      222: 'single quote'
}

iio.key = {
  string: function(e) {
    return iio.keys[e.keyCode];
  },
  code_is: function(keys, event) {
    if (!(keys instanceof Array)) keys = [keys];
    var str = iio.key.string(event);
    return keys.some(function(key) {
      return key === str;
    });
  }
}

iio.canvas = {
  create: function(w, h) {
    var c = document.createElement('canvas');

    //create with size
    if (w) {
      c.width = w;
      c.height = h;
    }

    //create fullscreen
    else {
      c.margin = 0;
      c.padding = 0;
      c.style.position = 'fixed';
      c.style.left = 0;
      c.style.top = 0;
      c.fullscreen = true;
      if (window.jQuery) {
        c.width = $(document).width();
        c.height = $(document).height();
      } else {
        c.width = window.innerWidth;
        c.height = window.innerHeight;
      }
    }

    return c;
  },
  prep: function(id, d) {
    var c;

    //create with element id
    if (id) {
      c = document.getElementById(id);
      if (!c) {

        //create with existing canvas
        if (id.tagName == 'CANVAS') c = id;

        //create in existing element
        else if (iio.is.number(id) || id.x) {
          c = iio.canvas.create(id.x || id, id.y || id);
          if (d) d.appendChild(c);
          else document.body.appendChild(c);
        }
      }
      //create fullscreen
    } else {
      iio.canvas.prep_fullscreen();
      c = iio.canvas.create();
      document.body.appendChild(c);
    }
    return c;
  },
  prep_fullscreen: function() {
    document.body.style.margin = 0;
    document.body.style.padding = 0;
  },
  prep_input: function(o) {
    function route_input(caller, e, handler){
      // orient click position to canvas 0,0
      var ep = caller.parent.convert_event_pos(e);
      // App.handler
      if (caller.parent[handler]) 
        caller.parent[handler](caller.parent, e, ep);
      // App.objs.handler
      caller.parent.objs.forEach(function(obj, i) {
        if (i !== 0) ep = caller.parent.convert_event_pos(e);
        if (obj.contains && obj.contains(ep))
          if (obj[handler]) {
            if (obj.cellAt) {
              var c = obj.cellAt(ep);
              obj[handler](obj, e, ep, c, obj.cellCenter(c.c, c.r));
            } else obj[handler](obj, e, ep);
          }
      }, caller)
    }
    function attach_input_hook(callback, router) {
      if(o[callback]) {
        o['_'+callback] = o[callback];
        o[callback] = function(e){ router(e); this['_'+callback](e) }
      } else o[callback] = router;
    }
    attach_input_hook('onclick', function(e){ route_input(o, e, 'onClick') });
    attach_input_hook('onmousedown', function(e){ route_input(o, e, 'onMouseDown') });
    attach_input_hook('onmouseup', function(e){ route_input(o, e, 'onMouseUp') });
  }
}

iio.collision = {
  check: function(o1, o2) {
    if (typeof(o1) == 'undefined' || typeof(o2) == 'undefined') return false;
    if ( o1 instanceof iio.Rectangle && o2 instanceof iio.Rectangle ) {
      
      /*if (o1.simple) {
        if (o2.simple) return iio.collision.rectXrect(
          o1.pos.x - o1.bbx[0], o1.pos.x + o1.bbx[0], o1.pos.y - (o1.bbx[1] || o1.bbx[0]), o1.pos.y + (o1.bbx[1] || o1.bbx[0]),
          o2.pos.x - o2.bbx[0], o2.pos.x + o2.bbx[0], o2.pos.y - (o2.bbx[1] || o2.bbx[0]), o2.pos.y + (o2.bbx[1] || o2.bbx[0]));
        else return iio.collision.rectXrect(
          o1.pos.x - o1.bbx[0], o1.pos.x + o1.bbx[0], o1.pos.y - (o1.bbx[1] || o1.bbx[0]), o1.pos.y + (o1.bbx[1] || o1.bbx[0]),
          o2.left, o2.right, o2.top, o2.bottom);
      } else if (o2.simple) return iio.collision.rectXrect(o1.left, o1.right, o1.top, o1.bottom,
        o2.pos.x - o2.bbx[0], o2.pos.x + o2.bbx[0], o2.pos.y - (o2.bbx[1] || o2.bbx[0]), o2.pos.y + (o2.bbx[1] || o2.bbx[0]));
      else */return iio.collision.rectXrect(o1.left(), o1.right(), o1.top(), o1.bottom(), o2.left(), o2.right(), o2.top(), o2.bottom())
    }
  },
  rectXrect: function(r1L, r1R, r1T, r1B, r2L, r2R, r2T, r2B) {
    if (r1L < r2R && r1R > r2L && r1T < r2B && r1B > r2T) return true;
    return false;
  }
}

iio.draw = {
  line: function( ctx, x1, y1, x2, y2 ){
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.stroke();
  }
};
/* Interface
------------------
iio.js version 1.4
--------------------------------------------------------------
iio.js is licensed under the BSD 2-clause Open Source license
*/

// DEFINITION
iio.Interface = function(){ this.Interface.apply(this, arguments) }

// CONSTRUCTOR
iio.Interface.prototype.Interface = function() {
  this.set(arguments[0], true);
}

// FUNCTIONS
//-------------------------------------------------------------------
iio.Interface.prototype.set = function() {
  for (var p in arguments[0]) this[p] = arguments[0][p];
  if( this.convert_props ) this.convert_props();
}
iio.Interface.prototype.clone = function() {
	return new this.constructor( this );
}
iio.Interface.prototype.toString = function() {
	var str = '';
  for (var p in this) {
  	/*if( typeof this[p] === 'function')
  		str += p + ' = function\n ';
  	else str += p + ' = ' + this[p] + '\n';*/
  	if (this[p] instanceof Array)
  		str += p + ' = Array['+this[p].length+']\n'
  	else if( typeof this[p] !== 'function' 
  		&& p != '_super' )
  		str += p + ' = ' + this[p] + '\n';
  }
  return str;
};
/* Vector
------------------
iio.js version 1.4
--------------------------------------------------------------
iio.js is licensed under the BSD 2-clause Open Source license
*/

//DEFINITION
iio.Vector = function(){ this.Vector.apply(this, arguments) };
iio.inherit(iio.Vector, iio.Interface);
iio.Vector.prototype._super = iio.Interface.prototype;

//CONSTRUCTOR
iio.Vector.prototype.Vector = function(v,y) {
	if(v instanceof Array){
		this.x = v[0] || 0;
		this.y = v[1] || 0;
	} else if( v && v.x ) {
		this.x = v.x || 0;
		this.y = v.y || 0;
	} else {
		this.x = v || 0;
		this.y = y || 0;
	}
}

//STATIC FUNCTIONS
//------------------------------------------------------------
iio.Vector.add = function(v1, v2) {
	for (var p in v2)
	  if (v1[p]) v1[p] += v2[p];
	return v1
}
iio.Vector.sub = function(v1, v2) {
	for (var p in v2)
	  if (v1[p]) v1[p] -= v2[p];
	return v1
}
iio.Vector.mult = function(v1, v2) {
	for (var p in v2)
	  if (v1[p]) v1[p] *= v2[p];
	return v1
}
iio.Vector.div = function(v1, v2) {
	for (var p in v2)
	  if (v1[p]) v1[p] /= v2[p];
	return v1
}
iio.Vector.dist = function(v1, v2) {
	return Math.sqrt(Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2))
}

// MEMBER FUNCTIONS
//------------------------------------------------------------
iio.Vector.prototype.clone = function(){
	return new iio.Vector(this.x,this.y)
}
iio.Vector.prototype.sub = function( x, y ){
	y = y || x.y;
	x = x.x || x;
	this.x -= x;
	this.y -= y;
	return this;
}
iio.Vector.prototype.equals = function( x, y ){
	if( x.x ) return this.x === x.x && this.y === x.y;
	else return this.x === x && this.y === y;
};
/* Color
------------------
iio.js version 1.4
--------------------------------------------------------------
iio.js is licensed under the BSD 2-clause Open Source license
*/

// DEFINITION
iio.Color = function(){ this.Color.apply(this, arguments) };
iio.inherit(iio.Color, iio.Interface);
iio.Color.prototype._super = iio.Interface.prototype;

// CONSTRUCTOR
iio.Color.prototype.Color = function(r,g,b,a) {
	// Input of hex color: new iio.Color("#FFF", 0.5)
	if (typeof(r)==='string' && b === undefined && a === undefined) {
		var hex = iio.Color.hexToRgb(r);
		a = g;
		r = hex.r;
		g = hex.g;
		b = hex.b;
	}

	// Input of RGBA color: new iio.Color(255, 255, 255, 1)
	this.r = r || 0;
	this.g = g || 0;
	this.b = b || 0;
	this.a = a || 1;

	return this;
}

// STATIC FUNCTIONS
//------------------------------------------------------------
iio.Color.random = function(){
	return new iio.Color(iio.randomInt(0,255),iio.randomInt(0,255),iio.randomInt(0,255))
}
iio.Color.invert = function(c){ return new iio.Color(255-c.r,255-c.g,255-c.b,c.a) }
iio.Color.hexToRgb = function(hex) {
	// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
	var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
	hex = hex.replace(shorthandRegex, function(m, r, g, b) {
		return r + r + g + g + b + b;
	});

	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}
iio.Color.rgbToHex = function(r, g, b) {
	// TODO https://drafts.csswg.org/css-color/#hex-notation CSS4 will support 8 digit hex string (#RRGGBBAA)
	function componentToHex(c) {
		var hex = c.toString(16);
		return hex.length == 1 ? "0" + hex : hex;
	}

	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

// MEMBER FUNCTIONS
//------------------------------------------------------------
iio.Color.prototype.clone = function() {
	return new iio.Color( this.r, this.g, this.b, this.a );
}
iio.Color.prototype.rgbaString = function(){
	return 'rgba('+this.r+','+this.g+','+this.b+','+this.a+')';
}
iio.Color.prototype.hexString = function() {
	return iio.Color.rgbToHex(this.r, this.g, this.b);
}
iio.Color.prototype.invert = function(){
	this.r = 255-this.r;
	this.g = 255-this.g;
	this.b = 255-this.b;
	return this;
}
iio.Color.prototype.randomize = function(alpha){
	this.r = iio.randomInt(0,255);
	this.g = iio.randomInt(0,255);
	this.b = iio.randomInt(0,255);
	if(alpha) this.a = iio.random();
	return this;
}

// COLOR CONSTANTS
//------------------------------------------------------------
iio.Color.iioblue = function(){ return new iio.Color(0,186,255) }
iio.Color.transparent = function(){ return new iio.Color(0,0,0,0) }
iio.Color.black = function(){ return new iio.Color(0,0,0,1) }
iio.Color.white = function(){ return new iio.Color(255,255,255,1) }
iio.Color.gray = function(){ return new iio.Color(128,128,128,1) }
iio.Color.red = function(){ return new iio.Color(255,0,0,1) }
iio.Color.green = function(){ return new iio.Color(0,128,0,1) }
iio.Color.blue = function(){ return new iio.Color(0,0,255,1) }
iio.Color.lime = function(){ return new iio.Color(0,255,0,1) }
iio.Color.aqua = function(){ return new iio.Color(0,255,255,1) }
iio.Color.fuchsia = function(){ return new iio.Color(255,0,255,1) }
iio.Color.maroon = function(){ return new iio.Color(128,0,0,1) }
iio.Color.navy = function(){ return new iio.Color(0,0,128,1) }
iio.Color.olive = function(){ return new iio.Color(128,128,0,1) };
/* Gradient
------------------
iio.js version 1.4
--------------------------------------------------------------
iio.js is licensed under the BSD 2-clause Open Source license
*/

//DEFINITION
iio.Gradient = function(){ this.Gradient.apply(this, arguments) };
iio.inherit(iio.Gradient, iio.Interface);
iio.Gradient.prototype._super = iio.Interface.prototype;

//CONSTRUCTOR
iio.Gradient.prototype.Gradient = function() {
  this._super.Interface.call(this,iio.merge_args(arguments));
}

// MEMBER FUNCTIONS
//------------------------------------------------------------
iio.Gradient.prototype.convert_props = function(){
	iio.convert.property.vector(this, "start");
  iio.convert.property.vector(this, "end");
  for(var i=0; i<this.stops.length; i++)
  	if(iio.is.string(this.stops[i][1]))
  		this.stops[i][1] = iio.convert.color(this.stops[i][1]);
}
iio.Gradient.prototype.canvasGradient = function(ctx){
	var gradient;
	if(this.startRadius)
		gradient = ctx.createRadialGradient(this.start.x,this.start.y,this.startRadius,
											 this.end.x,this.end.y,this.endRadius);
	else gradient = ctx.createLinearGradient(this.start.x,this.start.y,this.end.x,this.end.y);
	for(var i=0; i<this.stops.length; i++)
		gradient.addColorStop(this.stops[i][0],this.stops[i][1].rgbaString());
	return gradient;
};
/* Drawable
------------------
iio.js version 1.4
--------------------------------------------------------------
iio.js is licensed under the BSD 2-clause Open Source license
*/

// DEFINITION
iio.Drawable = function(){ this.Drawable.apply(this, arguments) }
iio.inherit(iio.Drawable, iio.Interface);
iio.Drawable.prototype._super = iio.Interface.prototype;

// CONSTRUCTOR
iio.Drawable.prototype.Drawable = function() {
  iio.Drawable.prototype._super.Interface.call(this, arguments[0]);
  this.objs = [];
  this.collisions = [];
  this.loops = [];
}

// OVERRIDE FUNCTIONS
//-------------------------------------------------------------------
iio.Drawable.prototype.set = function() {
  iio.Drawable.prototype._super.set.call(this, arguments[0]);
  if (arguments[arguments.length-1] === true);
  else if(this.app) this.app.draw();
}
iio.Drawable.prototype.convert_props = function(){
  iio.convert.property.color(this,"color");
}


// DATA MANAGEMENT FUNCTIONS
//-------------------------------------------------------------------
iio.Drawable.prototype.localFrameVector = function(v){
  return new iio.Vector( 
    v.x - this.pos.x, 
    v.y - this.pos.y
  )
}
iio.Drawable.prototype.localize = function(v,y){
  if (typeof(y) !== 'undefined') v = { x:v, y:y }
  if (this.pos){
    v.x -= this.pos.x;
    v.y -= this.pos.y;
  }
  if (this.rotation) {
    if (this.origin){
      v.x -= this.origin.x;
      v.y -= this.origin.y;
    }
    v = iio.point.rotate(v.x, v.y, -this.rotation);
    if (this.origin){
      v.x += this.origin.x;
      v.y += this.origin.y;
    }
  }
  return v;
}

// OBJECT MANAGMENT FUNCTIONS
//-------------------------------------------------------------------
iio.Drawable.prototype.clear = function( noDraw ) {
  for(var i=0; i<this.objs.length; i++)
    iio.cancelLoops(this.objs[i]);
  this.objs = [];
  if ( noDraw );
  else if(this.app) this.app.draw();
  return this;
}
iio.Drawable.prototype.add = function() {

  // if input is Array
  if (arguments[0] instanceof Array)
    for(var i=0; i<arguments[0].length; i++)
      this.add(arguments[0][i], true);

  // else input is singular object
  else {

    // set hierarchy properties
    arguments[0].parent = this;

    // set app & ctx refs for object
    arguments[0].app = this.app;
    arguments[0].ctx = this.ctx;

    // set app & ctx refs for object children
    if(arguments[0].objs && arguments[0].objs.length>0)
      for(var i=0; i<arguments[0].objs.length; i++){
        arguments[0].objs[i].app = this.app;
        arguments[0].objs[i].ctx = this.ctx; 
      }

    // infer size if Text object
    if (arguments[0] instanceof iio.Text)
      arguments[0].inferSize();

    // set default z index
    if (typeof(arguments[0].z) == 'undefined') 
      arguments[0].z = 0;

    // insert into objs in order of z index
    var i = 0;
    while ( i < this.objs.length 
      && typeof(this.objs[i].z) != 'undefined' 
      && arguments[0].z >= this.objs[i].z) i++;
    this.objs.insert(i, arguments[0]);

    // set loop if neccessary
    if ( arguments[0].app && 
        (  arguments[0].vel 
        || arguments[0].vels 
        || arguments[0].rVel 
        || arguments[0].bezierVels 
        || arguments[0].bezierAccs
        || arguments[0].acc
        || arguments[0].accs 
        || arguments[0].rAcc 
        || arguments[0].onUpdate 
        || arguments[0].shrink 
        || arguments[0].fade 
        ) && !arguments[0].app.looping )
      arguments[0].app.loop();
  }

  // redraw unless suppressed
  if (arguments[arguments.length-1] === true);
  else if(this.app) this.app.draw();

  // return given object
  return arguments[0];
}
iio.Drawable.prototype.rmv = function() {

  // if input is Array
  if (arguments[0] instanceof Array)
    for(var i=0; i<arguments[0].length; i++)
      this.rmv(arguments[0][i], true);

  // input is a singular object
  else {

    var _argument = arguments[0];

    remove = function(c, i, arr) {
      if (c == _argument) {
        arr.splice(i, 1);
        return true;
      } else return false;
    }

    // remove object at index
    if ( iio.is.number( arguments[0] ) ){
      if( arguments[0] < this.objs.length )
        _argument = this.objs.splice( arguments[0], 1 );

      // passed index out of bounds
      else return false;

    // remove passed object
    } else if (this.objs) 
      this.objs.some(remove);

    // return false if parent has no children
    else return false;

    // removed associated collisions
    if (this.collisions) this.collisions.forEach(function(collision, i) {

      // remove collision referring only to removed object
      if ( collision[0] == _argument || collision[1] == _argument )
        this.collisions.splice(i, 1);
      else {
        // remove reference to removed object from collision arrays
        if (collision[0] instanceof Array)
          collision[0].some(remove)
        if (collision[1] instanceof Array)
          collision[1].some(remove)
      }
    })
  }

  // redraw unless suppressed
  if (arguments[arguments.length-1] === true);
  else if(this.app) this.app.draw();

  // return removed object(s)
  return arguments[0];
}
iio.Drawable.prototype.create = function(){
  var props = {};
  for(var i=0; i<arguments.length; i++){
    if(arguments[i] === null) continue;

    // given string
    if( iio.is.string(arguments[i]) ){
      var c = iio.Color[ arguments[i] ];
      // infer color
      if(c) props.color = c;
      // infer text
      else props.text = arguments[i]
    }

    // given Color
    else if(arguments[i] instanceof iio.Color)
      // infer color
      props.color = arguments[i];

    // given Vector
    else if( arguments[i] instanceof iio.Vector )
      // infer position
      props.pos = arguments[i];

    // given Array
    else if( arguments[i] instanceof Array )
      // infer position
      props.pos = iio.convert.vector(arguments[i]);

    //given Object
    else if(typeof arguments[i] === 'object')
      // merge objects
      props = iio.merge(props,arguments[i]);

    // given number
    else if(iio.is.number(arguments[i]))
      // infer width
      props.width = arguments[i];
  }

  if(props.vs){
    // infer Line
    if(props.vs.length == 2)
      return this.add(new iio.Line(props));
    // infer Polygon
    else return this.add(new iio.Polygon(props));
  } 
  // infer Ellipse
  else if(props.radius)
    return this.add(new iio.Ellipse(props));
  // infer Text
  else if(props.text)
    return this.add(new iio.Text(props));
  // infer Grid
  else if(props.res || props.R || props.C)
    return this.add(new iio.Grid(props));
  // infer Rectangle
  else if(props.width)
    return this.add(new iio.Rectangle(props));
  // infer Color
  else if(props.color)
    return props.color;
  // infer Vector
  else if(props.pos)
    return props.pos
  return false;
}
iio.Drawable.prototype.collision = function(o1, o2, fn) {
  this.collisions.push( [o1, o2, fn] );
  return this.collisions.length-1;
}
iio.Drawable.prototype.cCollisions = function(o1, o2, fn) {
  if (o1 instanceof Array) {
    if (o2 instanceof Array) {
      if (o2.length == 0) return;
      o1.forEach(function(_o1) {
        o2.forEach(function(_o2) {
          if (iio.collision.check(_o1, _o2)) fn(_o1, _o2);
        });
      });
    } else {
      o1.forEach(function(_o1) {
        if (iio.collision.check(_o1, o2)) fn(_o1, o2);
      });
    }
  } else {
    if (o2 instanceof Array) {
      o2.forEach(function(_o2) {
        if (iio.collision.check(o1, _o2)) fn(o1, _o2);
      });
    } else if (iio.collision.check(o1, o2)) fn(o1, o2);
  }
}
iio.Drawable.prototype._update = function(o,dt){
  var nuFPS;
  if (this.update)
    nuFPS = this.update(dt);
  if (this.objs && this.objs.length > 0)
    this.objs.forEach(function(obj) {
      if (obj.update && obj.update(o, dt)) this.rmv(obj);
    }, this);
  if (this.collisions && this.collisions.length > 0) {
    this.collisions.forEach(function(collision) {
      this.cCollisions(collision[0], collision[1], collision[2]);
    }, this);
  }
  //this.draw();
  return nuFPS;
}

// LOOP MANAGMENT FUNCTIONS
//-------------------------------------------------------------------
iio.Drawable.prototype.loop = function(fps, callback) {

  // set looping flag
  this.looping = true;

  // create loop object
  var loop;

  if (typeof callback == 'undefined') {

    // replace mainLoop: 60fps with no callback
    if (typeof fps == 'undefined') {

      // cancel old mainLoop if it exists
      if (this.app.mainLoop) iio.cancelLoop(this.app.mainLoop.id);

      // define new mainLoop
      loop = this.app.mainLoop = {
        fps: 60,
        fn: this,
        af: this.rqAnimFrame,
        o: this.app
      }

      // set new mainLoop and app fps
      this.app.fps = loop.fps;
      loop.id = this.app.mainLoop.id = iio.loop(this.app.mainLoop);

    } else {
      // loop given callback at 60fps
      if (!iio.is.number(fps)) {
        loop = {
          fps: 60,
          fn: fps,
          af: this.rqAnimFrame
        }
        loop.id = iio.loop(loop, fps);
      } 
      // replace mainLoop: given fps with callback
      else {

        // cancel old mainLoop if it exists
        if (this.app.mainLoop) iio.cancelLoop(this.app.mainLoop.id);
        
        // define new mainLoop
        loop = this.app.mainLoop = {
          fps: fps,
          o: this.app,
          af: false
        }

        // set new mainLoop and app fps
        this.app.fps = fps;
        loop.id = this.app.mainLoop.id = iio.loop(this.app.mainLoop);
      }
    }
  } 

  // loop callback at given framerate
  else {
    loop = {
      fps: fps,
      fn: callback,
      o: this,
      af: this.rqAnimFrame
    }
    loop.id = iio.loop(fps, loop);
  }

  // add new loop to array
  this.loops.push(loop);

  /*if(typeof o.app.fps=='undefined'||o.app.fps<fps){
     if(o.app.mainLoop) iio.cancelLoop(o.app.mainLoop.id);
     o.app.mainLoop={fps:fps,o:o.app,af:o.app.rqAnimFrame}
     o.app.fps=fps;
     o.app.mainLoop.id=iio.loop(o.app.mainLoop);
  }*/
  
  // return id of new loop
  return loop.id;
}
iio.Drawable.prototype.togglePause = function(c) {
  if(this.paused) this.unpause(c);
  else this.pause(c);
}
iio.Drawable.prototype.pause = function(c) {
  if (!this.paused) {
    iio.cancelLoops(this);
    iio.cancelLoop(this.mainLoop.id);
    this.paused = true;
  }
  return this;
}
iio.Drawable.prototype.unpause = function(c) {
  if (this.paused) {
    this.paused = false;
    var drawable = this;
    this.loops.forEach(function(loop) {
      if (drawable.mainLoop && loop.id === drawable.mainLoop.id) {
        iio.loop(drawable.mainLoop);
      } else {
        iio.loop(loop);
      }
    });
    if (typeof c == 'undefined')
      this.objs.forEach(function(o) {
        o.loops.forEach(function(loop) {
          iio.loop(loop);
        });
      });
  }
}
;

//DEFINITION
iio.SpriteMap = function() {this.SpriteMap.apply(this, arguments) }

//CONSTRUCTOR
iio.SpriteMap.prototype.SpriteMap = function(src, p) {
  this.img = new Image();
  this.img.src = src;
  this.img.onload = p.onload;
  return this;
}

//FUNCTIONS
iio.SpriteMap.prototype.sprite = function() {
  var args = iio.merge_args(arguments);
  var anim = {};
  anim.name = args.name;
  args.origin = iio.convert.vector(args.origin);
  if (!args.frames) {
    anim.frames = [];
    for (var i = 0; i < args.numFrames; i++)
      anim.frames[i] = {
        x: args.origin.x + args.width * i,
        y: args.origin.y,
        w: args.width,
        h: args.height,
      };
  } else anim.frames = args.frames;
  anim.frames.forEach(function(frame) {
    if (typeof(frame.src) == 'undefined') frame.src = this.img;
    if (typeof(frame.w) == 'undefined') frame.w = args.width;
    if (typeof(frame.h) == 'undefined') frame.h = args.height;
  }, this);
  return anim;
}
;
/* Drawable
------------------
iio.js version 1.4
--------------------------------------------------------------
iio.js is licensed under the BSD 2-clause Open Source license
*/

//DEFINITION
iio.Shape = function(){ this.Shape.apply(this, arguments) }
iio.inherit(iio.Shape, iio.Drawable);
iio.Shape.prototype._super = iio.Drawable.prototype;

//CONSTRUCTOR
iio.Shape.prototype.Shape = function() {
  iio.Shape.prototype._super.Drawable.call(this,arguments[0]);
}

//OVERRIDE FUNCTIONS
//-------------------------------------------------------------------
iio.Shape.prototype.convert_props = function(){
  iio.Shape.prototype._super.convert_props.call(this, iio.merge_args(arguments));

  // convert string colors to iio.Color
  iio.convert.property.color(this,"outline");
  iio.convert.property.color(this,"shadow");

  // convert values to arrays
  if(this.dash && !(this.dash instanceof Array))
    this.dash = [this.dash];

  // arrays to iio.Vector
  iio.convert.property.vector(this,"pos");
  iio.convert.property.vector(this,"origin");
  iio.convert.property.vector(this,"vel");
  iio.convert.property.vector(this,"acc");
  iio.convert.property.vector(this,"shadowOffset");
  iio.convert.property.vector(this,"res");
  iio.convert.property.vectors(this,"vs");
  iio.convert.property.vectors(this,"vels");
  iio.convert.property.vectors(this,"accs");
  iio.convert.property.vectors(this,"bezier");
  iio.convert.property.vectors(this,"bezierVels");
  iio.convert.property.vectors(this,"bezierAccs");

  // set required properties
  if(typeof this.fade != 'undefined' && typeof this.alpha == 'undefined')
    this.alpha = 1;
  if(typeof this.rAcc != 'undefined' && !this.rVel) 
    this.rVel = 0;
  if(typeof this.rVel != 'undefined' && !this.rotation) 
    this.rotation = 0;
  if(typeof this.bezierAccs != 'undefined' && !this.bezierVels){
    this.bezierVels = [];
    for(var i=0; i<this.bezierAccs.length; i++)
      this.bezierVels.push(new iio.Vector);
  }
  if(typeof this.bezierVels != 'undefined' && !this.bezier){
    this.bezier = [];
    for(var i=0; i<this.bezierVels.length; i++)
      this.bezier.push(new iio.Vector);
  }

  // handle image attachment
  if (this.img){
    if(iio.is.string(this.img)) {
      var src = this.img;
      this.img = new Image();
      this.img.src = src;
      this.img.parent = this;
      var o = this;
      if (!this.size()){
        this.img.onload = function(e) {
          o.setSize(o.img.width || 0, o.img.height || 0);
          if(o.app) o.app.draw()
        }
      } else this.img.onload = function(e) {
        if(o.app) o.app.draw()
      }
    } else {
      if (!this.size()) {
        this.setSize(this.img.width || 0, this.img.height || 0);
        if(this.app) this.app.draw()
      }
    }
  }

  // handle anim attachment
  if(this.anims){
    this.animFrame = this.animFrame || 0;
  }
}

//BOUNDS FUNCTIONS
//-------------------------------------------------------------------
iio.Shape.prototype.left = function(){ if(this.pos) return this.pos.x; else return 0 }
iio.Shape.prototype.right = function(){ if(this.pos) return this.pos.x; else return 0 }
iio.Shape.prototype.top = function(){ if(this.pos) return this.pos.y; else return 0 }
iio.Shape.prototype.bottom = function(){ if(this.pos) return this.pos.y; else return 0 }
iio.Shape.prototype.resolve = function(b, c) {
  if (b.callback) return b.callback(c);
  return true;
}
iio.Shape.prototype.over_upper_limit = function(bnd, val, c) {
  if (iio.is.number(bnd) && val > bnd || typeof bnd.bound != 'undefined' && val > bnd.bound ) 
    return this.resolve(bnd, c);
  return false;
}
iio.Shape.prototype.below_lower_limit = function(bnd, val, c) {
  if (iio.is.number(bnd) && val < bnd || typeof bnd.bound != 'undefined' && val < bnd.bound ) 
    return this.resolve(bnd, c);
  return false;
}

//UPDATE FUNCTIONS
iio.Shape.prototype.update = function() {

  // transform and remove Shapeect if necessary
  var remove = false;
  if(this.bounds) remove = this.past_bounds();
  if (this.shrink) remove = this.update_shrink();
  if (this.fade) remove = this.update_fade();
  if (remove) return remove;

  // update position
  if (this.acc) this.update_acc();
  if (this.vel) this.update_vel();
  if (this.rAcc) this.rVel += this.rAcc;
  if (this.rVel) this.update_rotation();
  if (this.accs) this.update_accs();
  if (this.vels) this.update_vels();
  if (this.bezierAccs) this.update_bezier_accs();
  if (this.bezierVels) this.update_bezier_vels();

  if (this.onUpdate) this.onUpdate();

  /*if (this.objs && this.objs.length > 0)
      this.objs.forEach(function(obj) {
        if (obj.update && obj.update()) this.rmv(obj);
      }, this);*/
}
iio.Shape.prototype.update_vel = function(){
  if(this.pos){
    if (this.vel.x) this.pos.x += this.vel.x;
    if (this.vel.y) this.pos.y += this.vel.y;
  } else if(this.vs) {
    for(var i=0; i<this.vs.length; i++){
      if (this.vel.x) this.vs[i].x += this.vel.x;
      if (this.vel.y) this.vs[i].y += this.vel.y;
    }
  }
}
iio.Shape.prototype.update_vels = function(){
  if(this.vs){
    for(var i=0; i<this.vels.length; i++){
      if (this.vels[i].x) this.vs[i].x += this.vels[i].x;
      if (this.vels[i].y) this.vs[i].y += this.vels[i].y;
    }
  }
}
iio.Shape.prototype.update_bezier_vels = function(){
  if(this.bezier){
    for(var i=0; i<this.bezierVels.length; i++){
      if (this.bezierVels[i].x) this.bezier[i].x += this.bezierVels[i].x;
      if (this.bezierVels[i].y) this.bezier[i].y += this.bezierVels[i].y;
    }
  }
}
iio.Shape.prototype.update_bezier_accs = function(){
  if(this.bezierVels){
    for(var i=0; i<this.bezierAccs.length; i++){
      if (this.bezierAccs[i].x) this.bezierVels[i].x += this.bezierAccs[i].x;
      if (this.bezierAccs[i].y) this.bezierVels[i].y += this.bezierAccs[i].y;
    }
  }
}
iio.Shape.prototype.update_rotation = function(){
  this.rotation += this.rVel;
  if(this.rotation > 6283 || this.rotation < -6283) this.rotation = 0;
}
iio.Shape.prototype.update_acc = function(){
  this.vel.x += this.acc.x;
  this.vel.y += this.acc.y;
}
iio.Shape.prototype.update_accs = function(){
  if(this.vels){
    for(var i=0; i<this.accs.length; i++){
      if (this.accs[i].x) this.vels[i].x += this.accs[i].x;
      if (this.accs[i].y) this.vels[i].y += this.accs[i].y;
    }
  }
}
iio.Shape.prototype.update_shrink = function(){
  if (this.shrink.speed)
    return this._shrink(this.shrink.speed, this.shrink.callback);
  else return this._shrink(this.shrink);
}
iio.Shape.prototype.update_fade = function(){
  if (this.fade.speed)
    return this._fade(this.fade.speed, this.fade.callback);
  else return this._fade(this.fade);
}
iio.Shape.prototype.past_bounds = function(){
  if (this.bounds.right && this.over_upper_limit(this.bounds.right, this.right(), this)) return true;
  if (this.bounds.left && this.below_lower_limit(this.bounds.left, this.left(), this)) return true;
  if (this.bounds.top && this.below_lower_limit(this.bounds.top, this.top(), this)) return true;
  if (this.bounds.bottom && this.over_upper_limit(this.bounds.bottom, this.bottom(), this)) return true;
  if (this.bounds.rightRotation && this.over_upper_limit(this.bounds.rightRotation, this.rotation, this)) return true;
  if (this.bounds.leftRotation && this.below_lower_limit(this.bounds.leftRotation, this.rotation, this)) return true;
  return false;
}
iio.Shape.prototype.update_properties_deprecated = function(){
  if (o.simple) {
    if (!(o.bbx instanceof Array)) {
      o.bbx = [o.bbx, o.bbx];
    } else if (typeof(o.bbx[1] == 'undefined'))
      o.bbx[1] = o.bbx[0];
  }
  if (o.anims) {
    o.animKey = 0;
    o.animFrame = 0;
    if (!o.width) o.width = o.anims[o.animKey].frames[o.animFrame].w;
    if (!o.height) o.height = o.anims[o.animKey].frames[o.animFrame].h;
  }
  if (o.bezier)
    o.bezier.forEach(function(b, i) {
      if (b === 'n') o.bezier[i] = undefined;
    });
  if (o.img && iio.is.string(o.img)) {
    nd = false;
    var src = o.img;
    o.img = new Image();
    o.img.src = src;
    o.img.parent = o;
    if ((typeof o.width == 'undefined' && typeof o.radius == 'undefined') || o.radius == 0)
      o.img.onload = function(e) {
        if (o.radius == 0) o.radius = o.width / 2;
        else {
          o.width = o.width || 0;
          o.height = o.height || 0;
        }
        if (nd);
        else o.app.draw();
      }
  } else if (o.img) {
    if ((typeof o.width == 'undefined' && typeof o.radius == 'undefined') || o.radius == 0) {
      if (o.radius == 0) o.radius = o.img.width / 2;
      else {
        o.width = o.img.width || 0;
        o.height = o.img.height || 0;
      }
      if (nd);
      else o.app.draw();
    }
  }
}

//ANIMATION FUNCTIONS
iio.Shape.prototype.playAnim = function() {
  var args = iio.merge_args(arguments);
  if (args.name) {
    var o = this;
    this.anims.some(function(anim, i) {
      if (anim.name == args.name) {
        o.animKey = i;
        o.width = anim.frames[o.animFrame].w;
        o.height = anim.frames[o.animFrame].h;
        return true;
      }
      return false;
    });
  }
  this.animFrame = args.startFrame || 0;
  this.animRepeat = args.repeat;
  this.onAnimStop = args.onAnimStop;
  var loop;
  if (args.fps > 0) loop = this.loop(args.fps, this.nextFrame);
  else if (args.fps < 0) loop = this.loop(args.fps * -1, this.prevFrame);
  else this.app.draw();
  return loop;
}
iio.Shape.prototype.nextFrame = function(o) {
  o.animFrame++;
  if (o.animFrame >= o.anims[o.animKey].frames.length) {
    o.animFrame = 0;
    if (typeof(o.animRepeat) != 'undefined') {
      if (o.animRepeat <= 1) {
        window.cancelAnimationFrame(id);
        window.clearTimeout(id);
        if (o.onAnimStop) o.onAnimStop(id, o);
        return;
      } else o.animRepeat--;
    }
  }
}
iio.Shape.prototype.prevFrame = function(o) {
  o.animFrame--;
  if (o.animFrame < 0)
    o.animFrame = o.anims[o.animKey].frames.length - 1;
  o.app.draw();
}
iio.Shape.prototype._shrink = function(s, r) {
  this.width *= 1 - s;
  this.height *= 1 - s;
  if (this.width < .02 
    || this.width < this.shrink.lowerBound 
    || this.width > this.shrink.upperBound) {
    if (r) return r(this);
    else return true;
  }
}
iio.Shape.prototype._fade = function(s, r) {
  this.alpha *= 1 - s;
  if (this.alpha < s || this.alpha > 1-s
    ||this.alpha > this.fade.upperBound
    ||this.alpha < this.fade.lowerBound) {
    if(this.alpha > 1) this.alpha = 1;
    else if(this.alpha < 0) this.alpha = 0;
    if (r) return r(this);
    else return true;
  }
}

//DRAW FUNCTIONS
iio.Shape.prototype.orient_ctx = function(ctx){
  ctx = ctx || this.app.ctx;
  ctx.save();

  //translate & rotate
  if (this.pos) ctx.translate(this.pos.x, this.pos.y);
  if(this.rotation){
    if (this.origin) ctx.translate(this.origin.x, this.origin.y);
    ctx.rotate(this.rotation);
    if (this.origin) ctx.translate(-this.origin.x, -this.origin.y);
  }
  if(this.flip){
    if(this.flip.indexOf('x') > -1)
      ctx.scale(-1, 1);
    if(this.flip.indexOf('y') > -1)
      ctx.scale(1, -1);
  }
  return ctx;
}
iio.Shape.prototype.prep_ctx_color = function(ctx){
  if(this.color instanceof iio.Gradient)
    ctx.fillStyle = this.color.canvasGradient(ctx);
  else ctx.fillStyle = this.color.rgbaString();
  return ctx;
}
iio.Shape.prototype.prep_ctx_outline = function(ctx){
  if(this.outline instanceof iio.Gradient)
    ctx.strokeStyle = this.outline.canvasGradient(ctx);
  else ctx.strokeStyle = this.outline.rgbaString();
  return ctx;
}
iio.Shape.prototype.prep_ctx_lineWidth = function(ctx){
  ctx.lineWidth = this.lineWidth || 1;
  return ctx;
}
iio.Shape.prototype.prep_ctx_shadow = function(ctx){
  ctx.shadowColor = this.shadow.rgbaString();
  if(this.shadowBlur) ctx.shadowBlur = this.shadowBlur;
  if(this.shadowOffset) {
    ctx.shadowOffsetX = this.shadowOffset.x;
    ctx.shadowOffsetY = this.shadowOffset.y;
  } else {
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
  }
  return ctx;
}
iio.Shape.prototype.prep_ctx_dash = function(ctx){
  if(this.dashOffset) ctx.lineDashOffset = this.dashOffset
  ctx.setLineDash(this.dash);
  return ctx;
}
iio.Shape.prototype.finish_path_shape = function(ctx){
  if (this.color) ctx.fill();
  if (this.img) ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
  if (this.outline) ctx.stroke();
  if (this.clip) ctx.clip();
} 
iio.Shape.prototype.draw_obj = function(ctx){
  ctx.save();
  if(this.alpha) ctx.globalAlpha = this.alpha;
  if (this.lineCap) ctx.lineCap = this.lineCap;
  if (this.shadow) ctx = this.prep_ctx_shadow(ctx);
  if (this.dash) ctx = this.prep_ctx_dash(ctx);
  if (this.color) ctx = this.prep_ctx_color(ctx);
  if (this.outline) {
    ctx = this.prep_ctx_outline(ctx);
    ctx = this.prep_ctx_lineWidth(ctx);
  }
  if(this.draw_shape) this.draw_shape(ctx);
  ctx.restore();
}
iio.Shape.prototype.draw = function(ctx){

  if (this.hidden) return;
  ctx = this.orient_ctx(ctx);
  
  //draw objs in z index order
  if (this.objs&&this.objs.length > 0) {
    var drawnSelf = false;
    for(var i=0; i<this.objs.length; i++){
      if (!drawnSelf && this.objs[i].z >= this.z) {
        this.draw_obj(ctx);
        drawnSelf = true;
      } 
      if (this.objs[i].draw) 
        this.objs[i].draw(ctx);
    }
    if (!drawnSelf) this.draw_obj(ctx);
  } 
  //draw
  else this.draw_obj(ctx);
  ctx.restore();
}
iio.Shape.prototype.draw_line = function(ctx, x1, y1, x2, y2){
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x1, y1);
  ctx.stroke();
};

//DEFINITION
iio.Line = function(){ this.Line.apply(this, arguments) };
iio.inherit(iio.Line, iio.Shape);
iio.Line.prototype._super = iio.Shape.prototype;

//CONSTRUCTOR
iio.Line.prototype.Line = function() {
  this._super.Shape.call(this,iio.merge_args(arguments));
}

//FUNCTIONS
/*iio.Line.prototype.contains = function(v, y) {
  if (typeof(y) != 'undefined') v = {
    x: v,
    y: y
  } 
  if (iio.is.between(v.x, this.pos.x, this.vs[1].x) && iio.is.between(v.y, this.vs[0].y, this.vs[1].y)) {
    var a = (this.vs[1].y - this.vs[0].y) / (this.vs[1].x - this.vs[0].x);
    if (!isFinite(a)) return true;
    var y = a * (this.vs[1].x - this.vs[0].x) + this.vs[0].y;
    if (y == v.y) return true;
  }
  return false;
}*/
iio.Line.prototype.prep_ctx_color = function(ctx){
  if(this.color instanceof iio.Gradient)
    ctx.strokeStyle = this.color.canvasGradient(ctx);
  else ctx.strokeStyle = this.color.rgbaString();
  ctx = this.prep_ctx_lineWidth(ctx);
  return ctx;
}
iio.Line.prototype.prep_ctx_lineWidth = function(ctx){
  ctx.lineWidth = this.width || 1;
  return ctx;
}

iio.Line.prototype.draw_shape = function(ctx) {
  ctx.beginPath();
  ctx.moveTo(this.vs[0].x, this.vs[0].y);
  if (this.bezier)
    ctx.bezierCurveTo(this.bezier[0].x, this.bezier[0].y, this.bezier[1].x, this.bezier[1].y, this.vs[1].x, this.vs[1].y);
  else ctx.lineTo(this.vs[1].x, this.vs[1].y);
  ctx.stroke();
};

//DEFINITION
iio.Polygon = function(){ this.Polygon.apply(this, arguments) };
iio.inherit(iio.Polygon, iio.Shape);
iio.Polygon.prototype._super = iio.Shape.prototype;

//CONSTRUCTOR
iio.Polygon.prototype.Polygon = function() {
  this._super.Shape.call(this,iio.merge_args(arguments));
}

//FUNCTIONS
iio.Polygon.prototype.draw_shape = function(ctx) {
  ctx.beginPath();
  ctx.moveTo(this.vs[0].x, this.vs[0].y);
  if (this.bezier) {
    var _i = 0;
    for (var i = 1; i < this.vs.length; i++)
      ctx.this.bezierCurveTo(this.bezier[_i++] || this.vs[i - 1].x, 
        this.bezier[_i++] || this.vs[i - 1].y, 
        this.bezier[_i++] || this.vs[i].x, 
        this.bezier[_i++] || this.vs[i].y,
         this.vs[i].x, this.vs[i].y);
    if (!this.open) {
      i--;
      ctx.this.bezierCurveTo(this.bezier[_i++] || this.vs[i].x,
       this.bezier[_i++] || this.vs[i].y,
       this.bezier[_i++] || 0,
       this.bezier[_i++] || 0,
       0, 0);
    }
  } else for(var i=1; i<this.vs.length; i++)
    ctx.lineTo(this.vs[i].x, this.vs[i].y);
  if (typeof(this.open) == 'undefined' || !this.open)
    ctx.closePath();
  this.finish_path_shape(ctx);
}
iio.Polygon.prototype.contains = function(v, y) {
  v = this.localize(v,y);
  var i = j = c = 0;
  for (i = 0, j = this.vs.length - 1; i < this.vs.length; j = i++) {
    if (((this.vs[i].y > v.y) != (this.vs[j].y > v.y)) &&
      (v.x < (this.vs[j].x - this.vs[i].x) * (v.y - this.vs[i].y) / (this.vs[j].y - this.vs[i].y) + this.vs[i].x))
      c = !c;
  }
  return c;
}
iio.Polygon.prototype._contains = function(v, y) {
  y = (v.y || y);
  v = (v.x || v);
  var i = j = c = 0;
  var vs = this.vs;
  if (this.rotation) vs = this.globalVs();
  for (i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    if (((vs[i].y > y) != (vs[j].y > y)) &&
      (v < (vs[j].x - vs[i].x) * (y - vs[i].y) / (vs[j].y - vs[i].y) + vs[i].x))
      c = !c;
  }
  return c;
}
iio.Polygon.prototype.globalVs = function() {
  var vList=[]; var x,y;
  for(var i=0;i<this.vs.length;i++){
     x=this.vs[i].x;
     y=this.vs[i].y;
     var v = iio.point.rotate(x,y,this.rotation);
     v.x+=this.pos.x;
     v.y+=this.pos.y;
     vList[i]=v;
  }
  return vList;
}
iio.Polygon.prototype.size = function(){ 
  return this.right() - this.left() 
}
iio.Polygon.prototype.left = function(){ 
  return iio.specVec( this.globalVs(),
    function(v1,v2){
      if(v1.x>v2.x)
        return true;
      return false
    }).x 
}
iio.Polygon.prototype.right = function(){ 
  return iio.specVec( this.globalVs(),
    function(v1,v2){
      if(v1.x<v2.x)
        return true;
      return false
    }).x 
}
iio.Polygon.prototype.top = function(){ 
  return iio.specVec( this.globalVs(),
    function(v1,v2){
      if(v1.y>v2.y)
        return true;
      return false}).y
}
iio.Polygon.prototype.bottom = function(){ 
  return iio.specVec( this.globalVs(),
    function(v1,v2){
      if(v1.y<v2.y)
        return true;
      return false}).y
};

//DEFINITION
iio.Rectangle = function(){ this.Rectangle.apply(this, arguments) };
iio.inherit(iio.Rectangle, iio.Shape);
iio.Rectangle.prototype._super = iio.Shape.prototype;

//CONSTRUCTOR
iio.Rectangle.prototype.Rectangle = function() {
  this._super.Shape.call(this,iio.merge_args(arguments));
  this.height = this.height || this.width;
}

//FUNCTIONS
iio.Rectangle.prototype.draw_shape = function(ctx){
  ctx.translate(-this.width / 2, -this.height / 2);
  if (this.bezier) {
    iio.draw.poly(ctx, this.getTrueVertices(), this.bezier);
    this.finish_path_shape(ctx);
  }
  // } else if (this.type==iio.X) {
  //   iio.draw.prep_x(ctx, this);
  //   iio.draw.line(ctx, 0, 0, this.width, this.width);
  //   iio.draw.line(ctx, this.width, 0, 0, this.width);
  //   ctx.restore();
  // } 
  else if(this.round)
    this.draw_rounded(ctx);
  else{
    if (this.color) ctx.fillRect(0, 0, this.width, this.height)
    if (this.img) ctx.drawImage(this.img, 0, 0, this.width, this.height);
    if (this.anims) ctx.drawImage(this.anims[this.animKey].frames[this.animFrame].src,
      this.anims[this.animKey].frames[this.animFrame].x,
      this.anims[this.animKey].frames[this.animFrame].y,
      this.anims[this.animKey].frames[this.animFrame].w,
      this.anims[this.animKey].frames[this.animFrame].h,
      0, 0, this.width, this.height);
    if (this.outline) ctx.strokeRect(0, 0, this.width, this.height);
  }
}
iio.Rectangle.prototype.draw_rounded = function(ctx){
  ctx.beginPath();
  ctx.moveTo(this.round[0], 0);
  ctx.lineTo(this.width - this.round[1], 0);
  ctx.quadraticCurveTo(this.width, 0, this.width, this.round[1]);
  ctx.lineTo(this.width, this.height - this.round[2]);
  ctx.quadraticCurveTo(this.width, this.height, this.width - this.round[2], this.height);
  ctx.lineTo(this.round[3], this.height);
  ctx.quadraticCurveTo(0, this.height, 0, this.height - this.round[3]);
  ctx.lineTo(0, this.round[0]);
  ctx.quadraticCurveTo(0, 0, this.round[0], 0);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.clip();
}
iio.Rectangle.prototype.contains = function(v, y) {
  v = this.localize(v,y);
  if (v.x > -this.width / 2 
   && v.x < this.width / 2
   && v.y > -this.height / 2 
   && v.y < this.height / 2)
    return true;
  return false;
}
iio.Rectangle.prototype.real_vertices = function() {
  this.vs = [{
    x: this.left,
    y: this.top
  }, {
    x: this.right,
    y: this.top
  }, {
    x: this.right,
    y: this.bottom
  }, {
    x: this.left,
    y: this.bottom
  }];
  return this.vs.map(function(_v) {
    var v = iio.point.rotate(_v.x - this.pos.x, _v.y - this.pos.y, this.rot);
    v.x += this.pos.x;
    v.y += this.pos.y;
    return v;
  }, this);
}
iio.Rectangle.prototype.size = function(){ return this.width }
iio.Rectangle.prototype.setSize = function(w,h){ this.width = w; this.height = h; }
iio.Rectangle.prototype.left = function(){ return this.pos.x - this.width/2 }
iio.Rectangle.prototype.right = function(){ return this.pos.x + this.width/2 }
iio.Rectangle.prototype.top = function(){ return this.pos.y - this.height/2 }
iio.Rectangle.prototype.bottom = function(){ return this.pos.y + this.height/2 };

//DEFINITION
iio.Grid = function(){ this.Grid.apply(this, arguments) };
iio.inherit(iio.Grid, iio.Rectangle);
iio.Grid.prototype._super = iio.Rectangle.prototype;

//CONSTRUCTOR
iio.Grid.prototype.Grid = function() {
  this._super.Rectangle.call(this,iio.merge_args(arguments));

  // set res if undefined
  this.res = this.res || new iio.Vector(
    this.width/this.C,
    this.height/this.R
  );

  // set width/height if undefined
  this.width = this.width || this.C * this.res.x;
  this.height = this.height || this.R * this.res.y;

  // initialize cells
  this.init_cells();
}

//FUNCTIONS
iio.Grid.prototype.init_cells = function(){
  this.cells = [];
  var x = -this.res.x * (this.C - 1) / 2;
  var y = -this.res.y * (this.R - 1) / 2;
  for (var c = 0; c < this.C; c++) {
    this.cells[c] = [];
    for (var r = 0; r < this.R; r++) {
      this.cells[c][r] = this.add(new iio.Rectangle({
        pos: new iio.Vector( x,y ),
        c: c,
        r: r,
        width: this.res.x,
        height: this.res.y
      }));
      y += this.res.y;
    }
    y = -this.res.y * (this.R - 1) / 2;
    x += this.res.x;
  }
}
iio.Grid.prototype.infer_res = function(){
  this.res.x = this.width/this.C;
  this.res.y = this.height/this.R;
}
iio.Grid.prototype.clear = function(noDraw){
  this.objs = [];
  this.init_cells();
  if(noDraw);
  else this.app.draw();
}
iio.Grid.prototype.cellCenter = function(c, r) {
  return {
    x: -this.width / 2 + c * this.res.x + this.res.x / 2,
    y: -this.height / 2 + r * this.res.y + this.res.y / 2
  }
}
iio.Grid.prototype.cellAt = function(x, y) {
  if (x.x) return this.cells[Math.floor((x.x - this.left()) / this.res.x)][Math.floor((x.y - this.top()) / this.res.y)];
  else return this.cells[Math.floor((x - this.left()) / this.res.x)][Math.floor((y - this.top()) / this.res.y)];
}
iio.Grid.prototype.foreachCell = function(fn, p) {
  for (var c = 0; c < this.C; c++)
    for (var r = 0; r < this.R; r++)
      if (fn(this.cells[c][r], p) === false)
        return [r, c];
}
iio.Grid.prototype.setSize = function(w,h){
  this.width = w;
  this.height = h;
  this.infer_res();
}
iio.Grid.prototype._shrink = function(s, r) {
  this.setSize( 
    this.width * (1 - s),
    this.height * (1 - s)
  );
  if (this.width < .02 
    || this.width < this.shrink.lowerBound 
    || this.width > this.shrink.upperBound) {
    if (r) return r(this);
    else return true;
  }
}

//DRAW FUNCTIONS
iio.Grid.prototype.prep_ctx_color = iio.Line.prototype.prep_ctx_color;
iio.Grid.prototype.draw_shape = function(ctx) {
  //ctx.translate(-this.width / 2, -this.height / 2);
  /*iio.draw.rect(ctx, this.width, this.height, {
    c: this.color,
    o: this.outline
  }, {
    img: this.img,
    anims: this.anims,
    mov: this.mov,
    round: this.round
  });*/
  if (this.color) {
    for (var c = 1; c < this.C; c++) 
      iio.draw.line(ctx, 
        -this.width / 2 + c * this.res.x, -this.height / 2, 
        -this.width / 2 + c * this.res.x, this.height / 2
      );
    for (var r = 1; r < this.R; r++) 
      iio.draw.line(ctx, 
        -this.width / 2, -this.height / 2 + r * this.res.y,
        this.width / 2, -this.height / 2 + r * this.res.y
      );
  }
};

//DEFINITION
iio.Ellipse = function(){ this.Ellipse.apply(this, arguments) };
iio.inherit(iio.Ellipse, iio.Shape);
iio.Ellipse.prototype._super = iio.Shape.prototype;

//CONSTRUCTOR
iio.Ellipse.prototype.Ellipse = function() {
  this._super.Shape.call(this,iio.merge_args(arguments));
}

//FUNCTIONS
iio.Ellipse.prototype.draw_shape = function(ctx) {
  
  ctx.beginPath();
  if (this.vRadius !== undefined) {
    if (ctx.ellipse) {
      ctx.ellipse(0,0, this.radius, this.vRadius, 0, 0,2*Math.PI, false)
    } else {
      ctx.save();
      ctx.translate(-this.radius, -this.vRadius);
      ctx.scale(this.radius, this.vRadius);
      ctx.arc(1, 1, 1, 0, 2 * Math.PI, false);
      ctx.restore();
    }
  } else {
    ctx.arc(0,0, this.radius, 0,2*Math.PI, false);
  }
  if (this.color) ctx.fill();
  if (this.outline) ctx.stroke();
  if (this.clip) ctx.clip();
  if (this.img) ctx.drawImage(this.img, -this.radius, -this.radius, this.radius*2, this.radius*2);
}
iio.Ellipse.prototype.contains = function(v, y) {
  if (typeof(y) !== 'undefined') v = { x:v, y:y }
  if ((!this.vRadius || this.radius === this.vRadius) && iio.Vector.dist(v, this.pos) < this.radius)
    return true;
  v = this.localize(v);
  if (Math.pow(v.x, 2) / Math.pow(this.radius, 2) + Math.pow(v.y, 2) / Math.pow(this.vRadius, 2) <= 1)
    return true;
  return false;
}
iio.Ellipse.prototype.size = function(){ return this.radius }
iio.Ellipse.prototype.setSize = function(s){ this.radius = s/2 }
iio.Ellipse.prototype.left = function(){ return this.pos.x - this.radius }
iio.Ellipse.prototype.right = function(){ return this.pos.x + this.radius }
iio.Ellipse.prototype.top = function(){ return this.pos.y - this.vRadius }
iio.Ellipse.prototype.bottom = function(){ return this.pos.y + this.vRadius }
iio.Ellipse.prototype._shrink = function(s, r) {
  this.radius *= 1 - s;
  if (this.vRadius) this.vRadius *= 1 - s;
  if (this.radius < .02 
    || this.radius < this.shrink.lowerBound 
    || this.radius > this.shrink.upperBound) {
    if (r) return r(this);
    return true;
  }
};

//DEFINITION
iio.Text = function(){ this.Text.apply(this, arguments) };
iio.inherit(iio.Text, iio.Shape);
iio.Text.prototype._super = iio.Shape.prototype;

//CONSTRUCTOR
iio.Text.prototype.Text = function() {
  this._super.Shape.call(this,iio.merge_args(arguments));
  this.size = this.size || 40;
  if(!this.outline)
    this.color = this.color || new iio.Color();
  this.font = this.font || 'Arial';
  this.align = this.align || 'center';

  /*var tX = this.getX(this.text.length);
  this.cursor = this.add([tX, 10, tX, -this.size * .8], '2 ' + (this.color || this.outline), {
    index: this.text.length,
    shift: false
  });
  if (this.showCursor) {
    this.loop(2, function(o) {
      this.cursor.hidden = !this.cursor.hidden;
    })
  } else this.cursor.hidden = true;*/
}

iio.Text.getFontHeight = function(font) {

  var text = $('<span>Hg</span>').css({ fontFamily: font });
  var block = $('<div style="display: inline-block; width: 1px; height: 0px;"></div>');

  var div = $('<div></div>');
  div.append(text, block);

  var body = $('body');
  body.append(div);

  try {

    var result = {};

    block.css({ verticalAlign: 'baseline' });
    result.ascent = block.offset().top - text.offset().top;

    block.css({ verticalAlign: 'bottom' });
    result.height = block.offset().top - text.offset().top;

    result.descent = result.height - result.ascent;

  } finally {
    div.remove();
  }

  return result;
};

//FUNCTIONS
iio.Text.prototype.inferSize = function(ctx){
  this.ctx = ctx || this.ctx;

  this.app.ctx.font = this.size + 'px ' + this.font;
  this.width = this.app.ctx.measureText(this.text).width;
  this.height = this.app.ctx.measureText("H").width;
}
iio.Text.prototype.left = function(){
  return this.pos.x - this.width / 2;
}
iio.Text.prototype.right = function(){
  return this.pos.x + this.width / 2;
}
iio.Text.prototype.top = function(){
  return this.pos.y - this.height / 2;
}
iio.Text.prototype.bottom = function(){
  return this.pos.y + this.height / 2;
}
iio.Text.prototype._shrink = function(s, r) {
  this.size *= 1 - s;
  this.inferSize();
  if (this.size < .02 
    || this.size < this.shrink.lowerBound 
    || this.size > this.shrink.upperBound) {
    if (r) return r(this);
    else return true;
  }
}
iio.Text.prototype.draw_shape = function(ctx) {

  ctx.translate(0,this.height/2);

  // ctx.strokeStyle = 'red';
  // ctx.strokeRect( -this.width/2, -this.height, this.width, this.height );

  ctx.font = this.size + 'px ' + this.font;
  ctx.textAlign = this.align;
  if (this.color) ctx.fillText(this.text, 0, 0);
  if (this.outline) ctx.strokeText(this.text, 0, 0);
  if (this.showCursor)
    this.cursor.pos.x = this.cursor.endPos.x = this.getX(this.cursor.index);
}
iio.Text.prototype.contains = function(v, y) {
  v = this.localize(v,y);
  if ((typeof(this.align) == 'undefined' || this.align == 'left') && v.x>0 && v.x<this.width && v.y<this.height/2 && v.y>-this.height/2)
    return true;
  else if (this.align == 'center' && v.x>-this.width/2 && v.x<this.width/2 && v.y<this.height/2 && v.y>-this.height/2)
    return true;
  else if ((this.align == 'right' || this.align == 'end') && v.x>-this.width && v.x<0 && v.y<this.height/2 && v.y>-this.height/2)
    return true;
  return false;
}
iio.Text.prototype.charWidth = function(i) {
  i = i || 0;
  this.app.ctx.font = this.size + 'px ' + this.font;
  return this.app.ctx.measureText(this.text.charAt(i)).width;
}
iio.Text.prototype.getX = function(i) {
  this.app.ctx.font = this.size + 'px ' + this.font;
  if (typeof(this.align) == 'undefined' || this.align == 'left')
    return this.app.ctx.measureText(this.text.substring(0, i)).width;
  if (this.align == 'right' || this.align == 'end')
    return -this.app.ctx.measureText(this.text.substring(0, this.text.length - i)).width;
  if (this.align == 'center') {
    var x = -Math.floor(this.app.ctx.measureText(this.text).width / 2);
    return x + this.app.ctx.measureText(this.text.substring(0, i)).width;
  }
}
iio.Text.prototype.keyUp = function(k) {
  if (k == 'shift')
    this.cursor.shift = false;
}
iio.Text.prototype.keyDown = function(key, cI, shift, fn) {
  if (!iio.is.number(cI)) {
    fn = cI;
    cI = this.cursor.index;
  }
  var str;
  var pre = this.text.substring(0, cI);
  var suf = this.text.substring(cI);
  if (typeof fn != 'undefined') {
    str = fn(key, shift, pre, suf);
    if (str != false) {
      this.text = pre + str + suf;
      this.cursor.index = cI + 1;
      if (this.showCursor) this.cursor.hidden = false;
      this.app.draw();
      return this.cursor.index;
    }
  }
  if (key.length > 1) {
    if (key == 'space') {
      this.text = pre + " " + suf;
      cI++;
    } else if (key == 'backspace' && cI > 0) {
      this.text = pre.substring(0, pre.length - 1) + suf;
      cI--;
    } else if (key == 'delete' && cI < this.text.length)
      this.text = pre + suf.substring(1);
    else if (key == 'left arrow' && cI > 0) cI--;
    else if (key == 'right arrow' && cI < this.text.length) cI++;
    else if (key == 'shift') this.cursor.shift = true;
    else if (key == 'semi-colon') {
      if (shift) this.text = pre + ':' + suf;
      else this.text = pre + ';' + suf;
      cI++;
    } else if (key == 'equal') {
      if (shift) this.text = pre + '+' + suf;
      else this.text = pre + '=' + suf;
      cI++;
    } else if (key == 'comma') {
      if (shift) this.text = pre + '<' + suf;
      else this.text = pre + ',' + suf;
      cI++;
    } else if (key == 'dash') {
      if (shift) this.text = pre + '_' + suf;
      else this.text = pre + '-' + suf;
      cI++;
    } else if (key == 'period') {
      if (shift) this.text = pre + '>' + suf;
      else this.text = pre + '.' + suf;
      cI++;
    } else if (key == 'forward slash') {
      if (shift) this.text = pre + '?' + suf;
      else this.text = pre + '/' + suf;
      cI++;
    } else if (key == 'grave accent') {
      if (shift) this.text = pre + '~' + suf;
      else this.text = pre + '`' + suf;
      cI++;
    } else if (key == 'open bracket') {
      if (shift) this.text = pre + '{' + suf;
      else this.text = pre + '[' + suf;
      cI++;
    } else if (key == 'back slash') {
      if (shift) this.text = pre + '|' + suf;
      else this.text = pre + "/" + suf;
      cI++;
    } else if (key == 'close bracket') {
      if (shift) this.text = pre + '}' + suf;
      else this.text = pre + ']' + suf;
      cI++;
    } else if (key == 'single quote') {
      if (shift) this.text = pre + '"' + suf;
      else this.text = pre + "'" + suf;
      cI++;
    }
  } else {
    if (shift || this.cursor.shift)
      this.text = pre + key.charAt(0).toUpperCase() + suf;
    else this.text = pre + key + suf;
    cI++;
  }
  if (this.showCursor) this.cursor.hidden = false;
  this.cursor.index = cI;
  this.app.draw();
  return cI;
};
/* App
------------------
iio.js version 1.4
--------------------------------------------------------------
iio.js is licensed under the BSD 2-clause Open Source license
*/

// DEFINITION
iio.App =  function() { 
  this.App.apply(this, arguments) 
}
iio.inherit(iio.App, iio.Drawable);
iio.App.prototype._super = iio.Drawable.prototype;

// CONSTRUCTOR
iio.App.prototype.App = function(view, script, settings) {

  this._super.Drawable.call(this);

  //set app reference for shared functions
  this.app = this;

  //set canvas & context
  this.canvas = view;
  this.ctx = view.getContext('2d');

  //prep canvas
  this.canvas.parent = this;
  iio.canvas.prep_input(this.canvas);

  //get width & height from canvas
  this.width = view.clientWidth || view.width;
  this.height = view.clientHeight || view.height;

  //set center
  this.center = new iio.Vector(
    this.width / 2,
    this.height / 2
  );

  this.update_pos();

  //add app to global app array
  iio.apps.push(this);

  //run js script
  /*if (typeof(app) === "string") {
    app = iio.scripts[app];
  }*/
  //app.call(this, this, s);

  // run script
  this.script = new script(this, settings);
}

// FUNCTIONS
//-------------------------------------------------------------------
iio.App.prototype.update = function(){
  var nuFPS;
  if(this.script.onUpdate) 
    nuFPS = this.script.onUpdate();
  this.draw();
  return nuFPS;
}
iio.App.prototype.update_pos = function(){
  var offset = this.canvas.getBoundingClientRect();
  this.pos = new iio.Vector(
    offset.left,
    offset.top
  );
}
iio.App.prototype.stop = function() {
  this.objs.forEach(function(obj) {
    iio.cancelLoops(obj);
  });
  iio.cancelLoops(this);
  if (this.mainLoop) iio.cancelLoop(this.mainLoop.id);
  this.clear();
}
iio.App.prototype.draw = function( noClear ) {

  // clear canvas
  if( !noClear )
    this.ctx.clearRect(0, 0, this.width, this.height);

  // draw background color
  if (this.color) {
    this.ctx.fillStyle = this.color.rgbaString();
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  // draw child objects
  if (this.objs.length > 0)
    for(var i=0; i<this.objs.length; i++)
      if (this.objs[i].draw) this.objs[i].draw(this.ctx);
}
iio.App.prototype.convert_event_pos = function(e) {
  this.update_pos();
  return new iio.Vector( 
    e.clientX - this.pos.x, 
    e.clientY - this.pos.y
  )
}
;
/* Sound
------------------
iio.js version 1.4
--------------------------------------------------------------
iio.js is licensed under the BSD 2-clause Open Source license
*/

// Single AudioContext shared across all iio apps
iio.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

//DEFINITION
iio.Sound = function(){ this.Sound.apply(this, arguments) };
iio.inherit(iio.Sound, iio.Interface);
iio.Sound.prototype._super = iio.Interface.prototype;

//CONSTRUCTOR
iio.Sound.prototype.Sound = function(url, onLoad, onError) {
  var sound = this;
  // Set up a GainNode for volume control
  this.gainNode = iio.audioCtx.createGain();
  this.gainNode.connect(iio.audioCtx.destination);
  
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function() {
    iio.audioCtx.decodeAudioData(xhr.response, function(buffer) {
      sound.buffer = buffer;
      if (onLoad) onLoad(sound, buffer);
    }, onError); 
  };
  xhr.onerror = onError;
  xhr.send();
}

iio.Sound.prototype.play = function(delay, properties) {
  if (properties) this.set(properties);
  if (this.buffer === undefined) return;
  var source = iio.audioCtx.createBufferSource();
  source.buffer = this.buffer;
  if (this.loop)
    source.loop = true;

  if (this.gain)
    this.gainNode.gain.value = this.gain;
  source.connect(this.gainNode);
  source.start(delay || 0);
}

;
iio.loadSound = function(url, onLoad, onError) {
  var sound = new iio.Sound(url, onLoad, onError);
  return sound;
}

iio.loadImage = function(url, onLoad, onError) {
  var img = new Image();
  img.onload = onLoad;
  img.onerror = onError;
  img.src = url;
  return img;
}

iio.Loader = function(basePath) {
  this.basePath = (basePath || '.') + '/';
};

/*
 * @params:
 *   assets: Define the assets to load, can be of various formats
 *   String
 *     "sprite.png"
 *     returns: {"sprite1.png": Image}
 *
 *   Array
 *     [
 *       "sprite1.png",
 *       "ping.wav",
 *       "background.jpg"
 *     ]
 *     returns: {
 *       "sprite1.png": Image,
 *       "ping.wav": Sound,
 *       "background.jpg": Image
 *     }
 *
 *     or 
 *
 *     [
 *       {name: "sprite1.png", callback: processImage},
 *       {name: "ping.wav", callback: processSound},
 *       {name: "background.png", callback: processImage}
 *     ]
 *     returns: {
 *       "sprite1.png": processImage(Image),
 *       "ping.wav": processSound(Sound),
 *       "background.jpg": processImage(Image)
 *     }
 *
 *     or 
 *
 *     [
 *       {name: "sprite1.png", callback: processImage},
 *       {name: "ping.wav", callback: processSound},
 *       "background.jpg"
 *     ]
 *     returns: {
 *       "sprite1.png": processImage(Image),
 *       "ping.wav": processSound(Sound),
 *       "background.jpg": Image
 *     }
 *
 *   Object
 *     {name: "sprite1.png", callback: processSprite}
 *     returns: {"sprite1.png": processSprite(Image)}
 *
 *     or 
 *
 *     ## With assetIds ##
 *
 *     {
 *       "mainCharacter": "sprite1.png",
 *       "loadingSound": "ping.wav",
 *       "background": "background.jpg"
 *     }
 *     returns: {
 *       "mainCharacter": Image,
 *       "loadingSound": Sound,
 *       "background": Image
 *     }
 *
 *     or 
 *
 *     {
 *       mainCharacter: {name: "sprite1.png", callback: processSprite},
 *       loadingSound: "ping.wav",
 *       background: "background.jpg"
 *     }
 *     returns: {
 *       mainCharacter: processSprite(Image),
 *       loadingSound: Sound,
 *       background: Image
 *     }
 *
 *   onProcessUpdate: function(percentage, lastLoadedAsset) { ... }
 *
 *   onComplete: function(assets) { ... }
 *
 * @returns:
 *   Depending on the format of the asset parameter, this method returns different objects
 *
 * TODO szheng definitely need to write a test suite for this.
 *               
 */
iio.Loader.prototype.load = function(assets, onComplete) {
  var total = assets.length || Object.keys(assets).length;
  var loaded = 0;
  var _assets = {}
  var postLoad = function() {
    loaded++;
    console.log(loaded);
    if (loaded == total) onComplete(_assets);
  };

  // Helper function to load asset into _assets.
  var load = function(assetName, postLoadProcess, id) {
    var name = id || assetName;
    var url = this.basePath + assetName;

    var loader; // Loader to use
    if (iio.is.image(url)) {
      loader = iio.loadImage;
    } else if (iio.is.sound(url)) {
      loader = iio.loadSound;
    } else {
      return;
    }

    var asset = loader(url, function() {
      if (postLoadProcess) {
        _assets[name] = postloadProcess(asset);
      } else {
        _assets[name] = asset;
      }
      console.log('success');
      postLoad();
    }, postLoad);
  }.bind(this);

  if (iio.is.string(assets)) {
    load(assets);
  } else if (assets instanceof Array) {
    assets.forEach(function(asset) {
      if (iio.is.string(asset)) {
        load(asset);
      } else if (asset.name) {
        load(asset.name, asset.callback, asset.id);
      }
    });
  } else if (assets.name) {
    load(assets.name, assets.callback);
  } else {
    for (var key in assets) {
      if (assets.hasOwnProperty(key)) {
        var asset = assets[key];
        if (iio.is.string(asset)) {
          load(asset, null, key);
        } else if (asset.name) {
          load(asset.name, asset.callback, key);
        } else {
          load(key, asset.callback, asset.id);
        }
      }
    }
  }

  return _assets;
};

;
/**
 * CoffeeScript Compiler v1.9.1
 * http://coffeescript.org
 *
 * Copyright 2011, Jeremy Ashkenas
 * Released under the MIT License
 */
(function(root){var CoffeeScript=function(){function require(e){return require[e]}return require["./helpers"]=function(){var e={},t={exports:e};return function(){var t,n,i,r,s,o;e.starts=function(e,t,n){return t===e.substr(n,t.length)},e.ends=function(e,t,n){var i;return i=t.length,t===e.substr(e.length-i-(n||0),i)},e.repeat=s=function(e,t){var n;for(n="";t>0;)1&t&&(n+=e),t>>>=1,e+=e;return n},e.compact=function(e){var t,n,i,r;for(r=[],t=0,i=e.length;i>t;t++)n=e[t],n&&r.push(n);return r},e.count=function(e,t){var n,i;if(n=i=0,!t.length)return 1/0;for(;i=1+e.indexOf(t,i);)n++;return n},e.merge=function(e,t){return n(n({},e),t)},n=e.extend=function(e,t){var n,i;for(n in t)i=t[n],e[n]=i;return e},e.flatten=i=function(e){var t,n,r,s;for(n=[],r=0,s=e.length;s>r;r++)t=e[r],t instanceof Array?n=n.concat(i(t)):n.push(t);return n},e.del=function(e,t){var n;return n=e[t],delete e[t],n},e.some=null!=(r=Array.prototype.some)?r:function(e){var t,n,i;for(n=0,i=this.length;i>n;n++)if(t=this[n],e(t))return!0;return!1},e.invertLiterate=function(e){var t,n,i;return i=!0,n=function(){var n,r,s,o;for(s=e.split("\n"),o=[],n=0,r=s.length;r>n;n++)t=s[n],i&&/^([ ]{4}|[ ]{0,3}\t)/.test(t)?o.push(t):(i=/^\s*$/.test(t))?o.push(t):o.push("# "+t);return o}(),n.join("\n")},t=function(e,t){return t?{first_line:e.first_line,first_column:e.first_column,last_line:t.last_line,last_column:t.last_column}:e},e.addLocationDataFn=function(e,n){return function(i){return"object"==typeof i&&i.updateLocationDataIfMissing&&i.updateLocationDataIfMissing(t(e,n)),i}},e.locationDataToString=function(e){var t;return"2"in e&&"first_line"in e[2]?t=e[2]:"first_line"in e&&(t=e),t?t.first_line+1+":"+(t.first_column+1)+"-"+(t.last_line+1+":"+(t.last_column+1)):"No location data"},e.baseFileName=function(e,t,n){var i,r;return null==t&&(t=!1),null==n&&(n=!1),r=n?/\\|\//:/\//,i=e.split(r),e=i[i.length-1],t&&e.indexOf(".")>=0?(i=e.split("."),i.pop(),"coffee"===i[i.length-1]&&i.length>1&&i.pop(),i.join(".")):e},e.isCoffee=function(e){return/\.((lit)?coffee|coffee\.md)$/.test(e)},e.isLiterate=function(e){return/\.(litcoffee|coffee\.md)$/.test(e)},e.throwSyntaxError=function(e,t){var n;throw n=new SyntaxError(e),n.location=t,n.toString=o,n.stack=""+n,n},e.updateSyntaxError=function(e,t,n){return e.toString===o&&(e.code||(e.code=t),e.filename||(e.filename=n),e.stack=""+e),e},o=function(){var e,t,n,i,r,o,a,c,h,l,u,p,d;return this.code&&this.location?(u=this.location,a=u.first_line,o=u.first_column,h=u.last_line,c=u.last_column,null==h&&(h=a),null==c&&(c=o),r=this.filename||"[stdin]",e=this.code.split("\n")[a],d=o,i=a===h?c+1:e.length,l=e.slice(0,d).replace(/[^\s]/g," ")+s("^",i-d),"undefined"!=typeof process&&null!==process&&(n=process.stdout.isTTY&&!process.env.NODE_DISABLE_COLORS),(null!=(p=this.colorful)?p:n)&&(t=function(e){return"[1;31m"+e+"[0m"},e=e.slice(0,d)+t(e.slice(d,i))+e.slice(i),l=t(l)),r+":"+(a+1)+":"+(o+1)+": error: "+this.message+"\n"+e+"\n"+l):Error.prototype.toString.call(this)},e.nameWhitespaceCharacter=function(e){switch(e){case" ":return"space";case"\n":return"newline";case"\r":return"carriage return";case"	":return"tab";default:return e}}}.call(this),t.exports}(),require["./rewriter"]=function(){var e={},t={exports:e};return function(){var t,n,i,r,s,o,a,c,h,l,u,p,d,f,m,g,v,y,b,k=[].indexOf||function(e){for(var t=0,n=this.length;n>t;t++)if(t in this&&this[t]===e)return t;return-1},w=[].slice;for(f=function(e,t,n){var i;return i=[e,t],i.generated=!0,n&&(i.origin=n),i},e.Rewriter=function(){function e(){}return e.prototype.rewrite=function(e){return this.tokens=e,this.removeLeadingNewlines(),this.closeOpenCalls(),this.closeOpenIndexes(),this.normalizeLines(),this.tagPostfixConditionals(),this.addImplicitBracesAndParens(),this.addLocationDataToGeneratedTokens(),this.tokens},e.prototype.scanTokens=function(e){var t,n,i;for(i=this.tokens,t=0;n=i[t];)t+=e.call(this,n,t,i);return!0},e.prototype.detectEnd=function(e,t,n){var i,o,a,c,h;for(h=this.tokens,i=0;c=h[e];){if(0===i&&t.call(this,c,e))return n.call(this,c,e);if(!c||0>i)return n.call(this,c,e-1);o=c[0],k.call(s,o)>=0?i+=1:(a=c[0],k.call(r,a)>=0&&(i-=1)),e+=1}return e-1},e.prototype.removeLeadingNewlines=function(){var e,t,n,i,r;for(i=this.tokens,e=t=0,n=i.length;n>t&&(r=i[e][0],"TERMINATOR"===r);e=++t);return e?this.tokens.splice(0,e):void 0},e.prototype.closeOpenCalls=function(){var e,t;return t=function(e,t){var n;return")"===(n=e[0])||"CALL_END"===n||"OUTDENT"===e[0]&&")"===this.tag(t-1)},e=function(e,t){return this.tokens["OUTDENT"===e[0]?t-1:t][0]="CALL_END"},this.scanTokens(function(n,i){return"CALL_START"===n[0]&&this.detectEnd(i+1,t,e),1})},e.prototype.closeOpenIndexes=function(){var e,t;return t=function(e){var t;return"]"===(t=e[0])||"INDEX_END"===t},e=function(e){return e[0]="INDEX_END"},this.scanTokens(function(n,i){return"INDEX_START"===n[0]&&this.detectEnd(i+1,t,e),1})},e.prototype.indexOfTag=function(){var e,t,n,i,r,s,o;for(t=arguments[0],r=arguments.length>=2?w.call(arguments,1):[],e=0,n=i=0,s=r.length;s>=0?s>i:i>s;n=s>=0?++i:--i){for(;"HERECOMMENT"===this.tag(t+n+e);)e+=2;if(null!=r[n]&&("string"==typeof r[n]&&(r[n]=[r[n]]),o=this.tag(t+n+e),0>k.call(r[n],o)))return-1}return t+n+e-1},e.prototype.looksObjectish=function(e){var t,n;return this.indexOfTag(e,"@",null,":")>-1||this.indexOfTag(e,null,":")>-1?!0:(n=this.indexOfTag(e,s),n>-1&&(t=null,this.detectEnd(n+1,function(e){var t;return t=e[0],k.call(r,t)>=0},function(e,n){return t=n}),":"===this.tag(t+1))?!0:!1)},e.prototype.findTagsBackwards=function(e,t){var n,i,o,a,c,h,l;for(n=[];e>=0&&(n.length||(a=this.tag(e),0>k.call(t,a)&&(c=this.tag(e),0>k.call(s,c)||this.tokens[e].generated)&&(h=this.tag(e),0>k.call(u,h))));)i=this.tag(e),k.call(r,i)>=0&&n.push(this.tag(e)),o=this.tag(e),k.call(s,o)>=0&&n.length&&n.pop(),e-=1;return l=this.tag(e),k.call(t,l)>=0},e.prototype.addImplicitBracesAndParens=function(){var e,t;return e=[],t=null,this.scanTokens(function(i,l,p){var d,m,g,v,y,b,w,T,C,E,F,N,L,x,S,D,R,A,I,_,O,$,j,M,B,V,P,U;if(U=i[0],F=(N=l>0?p[l-1]:[])[0],C=(p.length-1>l?p[l+1]:[])[0],j=function(){return e[e.length-1]},M=l,g=function(e){return l-M+e},v=function(){var e,t;return null!=(e=j())?null!=(t=e[2])?t.ours:void 0:void 0},y=function(){var e;return v()&&"("===(null!=(e=j())?e[0]:void 0)},w=function(){var e;return v()&&"{"===(null!=(e=j())?e[0]:void 0)},b=function(){var e;return v&&"CONTROL"===(null!=(e=j())?e[0]:void 0)},B=function(t){var n;return n=null!=t?t:l,e.push(["(",n,{ours:!0}]),p.splice(n,0,f("CALL_START","(")),null==t?l+=1:void 0},d=function(){return e.pop(),p.splice(l,0,f("CALL_END",")",["","end of input",i[2]])),l+=1},V=function(t,n){var r,s;return null==n&&(n=!0),r=null!=t?t:l,e.push(["{",r,{sameLine:!0,startsLine:n,ours:!0}]),s=new String("{"),s.generated=!0,p.splice(r,0,f("{",s,i)),null==t?l+=1:void 0},m=function(t){return t=null!=t?t:l,e.pop(),p.splice(t,0,f("}","}",i)),l+=1},y()&&("IF"===U||"TRY"===U||"FINALLY"===U||"CATCH"===U||"CLASS"===U||"SWITCH"===U))return e.push(["CONTROL",l,{ours:!0}]),g(1);if("INDENT"===U&&v()){if("=>"!==F&&"->"!==F&&"["!==F&&"("!==F&&","!==F&&"{"!==F&&"TRY"!==F&&"ELSE"!==F&&"="!==F)for(;y();)d();return b()&&e.pop(),e.push([U,l]),g(1)}if(k.call(s,U)>=0)return e.push([U,l]),g(1);if(k.call(r,U)>=0){for(;v();)y()?d():w()?m():e.pop();t=e.pop()}if((k.call(c,U)>=0&&i.spaced||"?"===U&&l>0&&!p[l-1].spaced)&&(k.call(o,C)>=0||k.call(h,C)>=0&&!(null!=(L=p[l+1])?L.spaced:void 0)&&!(null!=(x=p[l+1])?x.newLine:void 0)))return"?"===U&&(U=i[0]="FUNC_EXIST"),B(l+1),g(2);if(k.call(c,U)>=0&&this.indexOfTag(l+1,"INDENT",null,":")>-1&&!this.findTagsBackwards(l,["CLASS","EXTENDS","IF","CATCH","SWITCH","LEADING_WHEN","FOR","WHILE","UNTIL"]))return B(l+1),e.push(["INDENT",l+2]),g(3);if(":"===U){for(I=function(){var e;switch(!1){case e=this.tag(l-1),0>k.call(r,e):return t[1];case"@"!==this.tag(l-2):return l-2;default:return l-1}}.call(this);"HERECOMMENT"===this.tag(I-2);)I-=2;return this.insideForDeclaration="FOR"===C,P=0===I||(S=this.tag(I-1),k.call(u,S)>=0)||p[I-1].newLine,j()&&(D=j(),$=D[0],O=D[1],("{"===$||"INDENT"===$&&"{"===this.tag(O-1))&&(P||","===this.tag(I-1)||"{"===this.tag(I-1)))?g(1):(V(I,!!P),g(2))}if(w()&&k.call(u,U)>=0&&(j()[2].sameLine=!1),T="OUTDENT"===F||N.newLine,k.call(a,U)>=0||k.call(n,U)>=0&&T)for(;v();)if(R=j(),$=R[0],O=R[1],A=R[2],_=A.sameLine,P=A.startsLine,y()&&","!==F)d();else if(w()&&!this.insideForDeclaration&&_&&"TERMINATOR"!==U&&":"!==F)m();else{if(!w()||"TERMINATOR"!==U||","===F||P&&this.looksObjectish(l+1))break;if("HERECOMMENT"===C)return g(1);m()}if(!(","!==U||this.looksObjectish(l+1)||!w()||this.insideForDeclaration||"TERMINATOR"===C&&this.looksObjectish(l+2)))for(E="OUTDENT"===C?1:0;w();)m(l+E);return g(1)})},e.prototype.addLocationDataToGeneratedTokens=function(){return this.scanTokens(function(e,t,n){var i,r,s,o,a,c;return e[2]?1:e.generated||e.explicit?("{"===e[0]&&(s=null!=(a=n[t+1])?a[2]:void 0)?(r=s.first_line,i=s.first_column):(o=null!=(c=n[t-1])?c[2]:void 0)?(r=o.last_line,i=o.last_column):r=i=0,e[2]={first_line:r,first_column:i,last_line:r,last_column:i},1):1})},e.prototype.normalizeLines=function(){var e,t,r,s,o;return o=r=s=null,t=function(e,t){var r,s,a,c;return";"!==e[1]&&(r=e[0],k.call(p,r)>=0)&&!("TERMINATOR"===e[0]&&(s=this.tag(t+1),k.call(i,s)>=0))&&!("ELSE"===e[0]&&"THEN"!==o)&&!!("CATCH"!==(a=e[0])&&"FINALLY"!==a||"->"!==o&&"=>"!==o)||(c=e[0],k.call(n,c)>=0&&this.tokens[t-1].newLine)},e=function(e,t){return this.tokens.splice(","===this.tag(t-1)?t-1:t,0,s)},this.scanTokens(function(n,a,c){var h,l,u,p,f,m;if(m=n[0],"TERMINATOR"===m){if("ELSE"===this.tag(a+1)&&"OUTDENT"!==this.tag(a-1))return c.splice.apply(c,[a,1].concat(w.call(this.indentation()))),1;if(u=this.tag(a+1),k.call(i,u)>=0)return c.splice(a,1),0}if("CATCH"===m)for(h=l=1;2>=l;h=++l)if("OUTDENT"===(p=this.tag(a+h))||"TERMINATOR"===p||"FINALLY"===p)return c.splice.apply(c,[a+h,0].concat(w.call(this.indentation()))),2+h;return k.call(d,m)>=0&&"INDENT"!==this.tag(a+1)&&("ELSE"!==m||"IF"!==this.tag(a+1))?(o=m,f=this.indentation(c[a]),r=f[0],s=f[1],"THEN"===o&&(r.fromThen=!0),c.splice(a+1,0,r),this.detectEnd(a+2,t,e),"THEN"===m&&c.splice(a,1),1):1})},e.prototype.tagPostfixConditionals=function(){var e,t,n;return n=null,t=function(e,t){var n,i;return i=e[0],n=this.tokens[t-1][0],"TERMINATOR"===i||"INDENT"===i&&0>k.call(d,n)},e=function(e){return"INDENT"!==e[0]||e.generated&&!e.fromThen?n[0]="POST_"+n[0]:void 0},this.scanTokens(function(i,r){return"IF"!==i[0]?1:(n=i,this.detectEnd(r+1,t,e),1)})},e.prototype.indentation=function(e){var t,n;return t=["INDENT",2],n=["OUTDENT",2],e?(t.generated=n.generated=!0,t.origin=n.origin=e):t.explicit=n.explicit=!0,[t,n]},e.prototype.generate=f,e.prototype.tag=function(e){var t;return null!=(t=this.tokens[e])?t[0]:void 0},e}(),t=[["(",")"],["[","]"],["{","}"],["INDENT","OUTDENT"],["CALL_START","CALL_END"],["PARAM_START","PARAM_END"],["INDEX_START","INDEX_END"],["STRING_START","STRING_END"],["REGEX_START","REGEX_END"]],e.INVERSES=l={},s=[],r=[],m=0,v=t.length;v>m;m++)y=t[m],g=y[0],b=y[1],s.push(l[b]=g),r.push(l[g]=b);i=["CATCH","THEN","ELSE","FINALLY"].concat(r),c=["IDENTIFIER","SUPER",")","CALL_END","]","INDEX_END","@","THIS"],o=["IDENTIFIER","NUMBER","STRING","STRING_START","JS","REGEX","REGEX_START","NEW","PARAM_START","CLASS","IF","TRY","SWITCH","THIS","BOOL","NULL","UNDEFINED","UNARY","YIELD","UNARY_MATH","SUPER","THROW","@","->","=>","[","(","{","--","++"],h=["+","-"],a=["POST_IF","FOR","WHILE","UNTIL","WHEN","BY","LOOP","TERMINATOR"],d=["ELSE","->","=>","TRY","FINALLY","THEN"],p=["TERMINATOR","CATCH","FINALLY","ELSE","OUTDENT","LEADING_WHEN"],u=["TERMINATOR","INDENT","OUTDENT"],n=[".","?.","::","?::"]}.call(this),t.exports}(),require["./lexer"]=function(){var e={},t={exports:e};return function(){var t,n,i,r,s,o,a,c,h,l,u,p,d,f,m,g,v,y,b,k,w,T,C,E,F,N,L,x,S,D,R,A,I,_,O,$,j,M,B,V,P,U,G,H,q,X,W,Y,K,z,J,Q,Z,et,tt,nt,it,rt,st,ot,at,ct,ht,lt,ut=[].indexOf||function(e){for(var t=0,n=this.length;n>t;t++)if(t in this&&this[t]===e)return t;return-1};ot=require("./rewriter"),P=ot.Rewriter,w=ot.INVERSES,at=require("./helpers"),nt=at.count,ht=at.starts,tt=at.compact,ct=at.repeat,it=at.invertLiterate,st=at.locationDataToString,lt=at.throwSyntaxError,e.Lexer=S=function(){function e(){}return e.prototype.tokenize=function(e,t){var n,i,r,s;for(null==t&&(t={}),this.literate=t.literate,this.indent=0,this.baseIndent=0,this.indebt=0,this.outdebt=0,this.indents=[],this.ends=[],this.tokens=[],this.chunkLine=t.line||0,this.chunkColumn=t.column||0,e=this.clean(e),r=0;this.chunk=e.slice(r);)if(n=this.identifierToken()||this.commentToken()||this.whitespaceToken()||this.lineToken()||this.stringToken()||this.numberToken()||this.regexToken()||this.jsToken()||this.literalToken(),s=this.getLineAndColumnFromChunk(n),this.chunkLine=s[0],this.chunkColumn=s[1],r+=n,t.untilBalanced&&0===this.ends.length)return{tokens:this.tokens,index:r};return this.closeIndentation(),(i=this.ends.pop())&&this.error("missing "+i.tag,i.origin[2]),t.rewrite===!1?this.tokens:(new P).rewrite(this.tokens)},e.prototype.clean=function(e){return e.charCodeAt(0)===t&&(e=e.slice(1)),e=e.replace(/\r/g,"").replace(z,""),et.test(e)&&(e="\n"+e,this.chunkLine--),this.literate&&(e=it(e)),e},e.prototype.identifierToken=function(){var e,t,n,i,r,c,h,l,u,p,d,f,m,g,y;return(h=v.exec(this.chunk))?(c=h[0],i=h[1],e=h[2],r=i.length,l=void 0,"own"===i&&"FOR"===this.tag()?(this.token("OWN",i),i.length):"from"===i&&"YIELD"===this.tag()?(this.token("FROM",i),i.length):(p=this.tokens,u=p[p.length-1],n=e||null!=u&&("."===(d=u[0])||"?."===d||"::"===d||"?::"===d||!u.spaced&&"@"===u[0]),g="IDENTIFIER",!n&&(ut.call(E,i)>=0||ut.call(a,i)>=0)&&(g=i.toUpperCase(),"WHEN"===g&&(f=this.tag(),ut.call(N,f)>=0)?g="LEADING_WHEN":"FOR"===g?this.seenFor=!0:"UNLESS"===g?g="IF":ut.call(J,g)>=0?g="UNARY":ut.call(B,g)>=0&&("INSTANCEOF"!==g&&this.seenFor?(g="FOR"+g,this.seenFor=!1):(g="RELATION","!"===this.value()&&(l=this.tokens.pop(),i="!"+i)))),ut.call(C,i)>=0&&(n?(g="IDENTIFIER",i=new String(i),i.reserved=!0):ut.call(V,i)>=0&&this.error("reserved word '"+i+"'",{length:i.length})),n||(ut.call(s,i)>=0&&(i=o[i]),g=function(){switch(i){case"!":return"UNARY";case"==":case"!=":return"COMPARE";case"&&":case"||":return"LOGIC";case"true":case"false":return"BOOL";case"break":case"continue":return"STATEMENT";default:return g}}()),y=this.token(g,i,0,r),y.variable=!n,l&&(m=[l[2].first_line,l[2].first_column],y[2].first_line=m[0],y[2].first_column=m[1]),e&&(t=c.lastIndexOf(":"),this.token(":",":",t,e.length)),c.length)):0},e.prototype.numberToken=function(){var e,t,n,i,r;return(n=I.exec(this.chunk))?(i=n[0],t=i.length,/^0[BOX]/.test(i)?this.error("radix prefix in '"+i+"' must be lowercase",{offset:1}):/E/.test(i)&&!/^0x/.test(i)?this.error("exponential notation in '"+i+"' must be indicated with a lowercase 'e'",{offset:i.indexOf("E")}):/^0\d*[89]/.test(i)?this.error("decimal literal '"+i+"' must not be prefixed with '0'",{length:t}):/^0\d+/.test(i)&&this.error("octal literal '"+i+"' must be prefixed with '0o'",{length:t}),(r=/^0o([0-7]+)/.exec(i))&&(i="0x"+parseInt(r[1],8).toString(16)),(e=/^0b([01]+)/.exec(i))&&(i="0x"+parseInt(e[1],2).toString(16)),this.token("NUMBER",i,0,t),t):0},e.prototype.stringToken=function(){var e,t,n,i,r,s,o,a,c,h,l,u,m,g,v,y;if(l=(Y.exec(this.chunk)||[])[0],!l)return 0;if(g=function(){switch(l){case"'":return W;case'"':return q;case"'''":return f;case'"""':return p}}(),s=3===l.length,u=this.matchWithInterpolations(g,l),y=u.tokens,r=u.index,e=y.length-1,n=l[0],s){for(a=null,i=function(){var e,t,n;for(n=[],o=e=0,t=y.length;t>e;o=++e)v=y[o],"NEOSTRING"===v[0]&&n.push(v[1]);return n}().join("#{}");h=d.exec(i);)t=h[1],(null===a||(m=t.length)>0&&a.length>m)&&(a=t);a&&(c=RegExp("^"+a,"gm")),this.mergeInterpolationTokens(y,{delimiter:n},function(t){return function(n,i){return n=t.formatString(n),0===i&&(n=n.replace(F,"")),i===e&&(n=n.replace(K,"")),c&&(n=n.replace(c,"")),n}}(this))}else this.mergeInterpolationTokens(y,{delimiter:n},function(t){return function(n,i){return n=t.formatString(n),n=n.replace(G,function(t,r){return 0===i&&0===r||i===e&&r+t.length===n.length?"":" "})}}(this));return r},e.prototype.commentToken=function(){var e,t,n;return(n=this.chunk.match(c))?(e=n[0],t=n[1],t&&((n=u.exec(e))&&this.error("block comments cannot contain "+n[0],{offset:n.index,length:n[0].length}),t.indexOf("\n")>=0&&(t=t.replace(RegExp("\\n"+ct(" ",this.indent),"g"),"\n")),this.token("HERECOMMENT",t,0,e.length)),e.length):0},e.prototype.jsToken=function(){var e,t;return"`"===this.chunk.charAt(0)&&(e=T.exec(this.chunk))?(this.token("JS",(t=e[0]).slice(1,-1),0,t.length),t.length):0},e.prototype.regexToken=function(){var e,t,n,r,s,o,a,c,h,l,u,p,d;switch(!1){case!(o=M.exec(this.chunk)):this.error("regular expressions cannot begin with "+o[2],{offset:o.index+o[1].length});break;case!(o=this.matchWithInterpolations(m,"///")):d=o.tokens,s=o.index;break;case!(o=$.exec(this.chunk)):if(p=o[0],e=o[1],t=o[2],this.validateEscapes(e,{isRegex:!0,offsetInChunk:1}),s=p.length,h=this.tokens,c=h[h.length-1],c)if(c.spaced&&(l=c[0],ut.call(i,l)>=0)){if(!t||O.test(p))return 0}else if(u=c[0],ut.call(A,u)>=0)return 0;t||this.error("missing / (unclosed regex)");break;default:return 0}switch(r=j.exec(this.chunk.slice(s))[0],n=s+r.length,a=this.makeToken("REGEX",null,0,n),!1){case!!Z.test(r):this.error("invalid regular expression flags "+r,{offset:s,length:r.length});break;case!(p||1===d.length):null==e&&(e=this.formatHeregex(d[0][1])),this.token("REGEX",""+this.makeDelimitedLiteral(e,{delimiter:"/"})+r,0,n,a);break;default:this.token("REGEX_START","(",0,0,a),this.token("IDENTIFIER","RegExp",0,0),this.token("CALL_START","(",0,0),this.mergeInterpolationTokens(d,{delimiter:'"',"double":!0},this.formatHeregex),r&&(this.token(",",",",s,0),this.token("STRING",'"'+r+'"',s,r.length)),this.token(")",")",n,0),this.token("REGEX_END",")",n,0)}return n},e.prototype.lineToken=function(){var e,t,n,i,r;if(!(n=R.exec(this.chunk)))return 0;if(t=n[0],this.seenFor=!1,r=t.length-1-t.lastIndexOf("\n"),i=this.unfinished(),r-this.indebt===this.indent)return i?this.suppressNewlines():this.newlineToken(0),t.length;if(r>this.indent){if(i)return this.indebt=r-this.indent,this.suppressNewlines(),t.length;if(!this.tokens.length)return this.baseIndent=this.indent=r,t.length;e=r-this.indent+this.outdebt,this.token("INDENT",e,t.length-r,r),this.indents.push(e),this.ends.push({tag:"OUTDENT"}),this.outdebt=this.indebt=0,this.indent=r}else this.baseIndent>r?this.error("missing indentation",{offset:t.length}):(this.indebt=0,this.outdentToken(this.indent-r,i,t.length));return t.length},e.prototype.outdentToken=function(e,t,n){var i,r,s,o;for(i=this.indent-e;e>0;)s=this.indents[this.indents.length-1],s?s===this.outdebt?(e-=this.outdebt,this.outdebt=0):this.outdebt>s?(this.outdebt-=s,e-=s):(r=this.indents.pop()+this.outdebt,n&&(o=this.chunk[n],ut.call(y,o)>=0)&&(i-=r-e,e=r),this.outdebt=0,this.pair("OUTDENT"),this.token("OUTDENT",e,0,n),e-=r):e=0;for(r&&(this.outdebt-=e);";"===this.value();)this.tokens.pop();return"TERMINATOR"===this.tag()||t||this.token("TERMINATOR","\n",n,0),this.indent=i,this},e.prototype.whitespaceToken=function(){var e,t,n,i;return(e=et.exec(this.chunk))||(t="\n"===this.chunk.charAt(0))?(i=this.tokens,n=i[i.length-1],n&&(n[e?"spaced":"newLine"]=!0),e?e[0].length:0):0},e.prototype.newlineToken=function(e){for(;";"===this.value();)this.tokens.pop();return"TERMINATOR"!==this.tag()&&this.token("TERMINATOR","\n",e,0),this},e.prototype.suppressNewlines=function(){return"\\"===this.value()&&this.tokens.pop(),this},e.prototype.literalToken=function(){var e,t,n,s,o,a,c,u,p,d;if((e=_.exec(this.chunk))?(d=e[0],r.test(d)&&this.tagParameters()):d=this.chunk.charAt(0),u=d,n=this.tokens,t=n[n.length-1],"="===d&&t&&(!t[1].reserved&&(s=t[1],ut.call(C,s)>=0)&&this.error("reserved word '"+t[1]+"' can't be assigned",t[2]),"||"===(o=t[1])||"&&"===o))return t[0]="COMPOUND_ASSIGN",t[1]+="=",d.length;if(";"===d)this.seenFor=!1,u="TERMINATOR";else if(ut.call(D,d)>=0)u="MATH";else if(ut.call(h,d)>=0)u="COMPARE";else if(ut.call(l,d)>=0)u="COMPOUND_ASSIGN";else if(ut.call(J,d)>=0)u="UNARY";else if(ut.call(Q,d)>=0)u="UNARY_MATH";else if(ut.call(U,d)>=0)u="SHIFT";else if(ut.call(x,d)>=0||"?"===d&&(null!=t?t.spaced:void 0))u="LOGIC";else if(t&&!t.spaced)if("("===d&&(a=t[0],ut.call(i,a)>=0))"?"===t[0]&&(t[0]="FUNC_EXIST"),u="CALL_START";else if("["===d&&(c=t[0],ut.call(b,c)>=0))switch(u="INDEX_START",t[0]){case"?":t[0]="INDEX_SOAK"}switch(p=this.makeToken(u,d),d){case"(":case"{":case"[":this.ends.push({tag:w[d],origin:p});break;case")":case"}":case"]":this.pair(d)}return this.tokens.push(p),d.length},e.prototype.tagParameters=function(){var e,t,n,i;if(")"!==this.tag())return this;for(t=[],i=this.tokens,e=i.length,i[--e][0]="PARAM_END";n=i[--e];)switch(n[0]){case")":t.push(n);break;case"(":case"CALL_START":if(!t.length)return"("===n[0]?(n[0]="PARAM_START",this):this;t.pop()}return this},e.prototype.closeIndentation=function(){return this.outdentToken(this.indent)},e.prototype.matchWithInterpolations=function(t,n){var i,r,s,o,a,c,h,l,u,p,d,f,m,g,v;if(v=[],l=n.length,this.chunk.slice(0,l)!==n)return null;for(m=this.chunk.slice(l);;){if(g=t.exec(m)[0],this.validateEscapes(g,{isRegex:"/"===n.charAt(0),offsetInChunk:l}),v.push(this.makeToken("NEOSTRING",g,l)),m=m.slice(g.length),l+=g.length,"#{"!==m.slice(0,2))break;p=this.getLineAndColumnFromChunk(l+1),c=p[0],r=p[1],d=(new e).tokenize(m.slice(1),{line:c,column:r,untilBalanced:!0}),h=d.tokens,o=d.index,o+=1,u=h[0],i=h[h.length-1],u[0]=u[1]="(",i[0]=i[1]=")",i.origin=["","end of interpolation",i[2]],"TERMINATOR"===(null!=(f=h[1])?f[0]:void 0)&&h.splice(1,1),v.push(["TOKENS",h]),m=m.slice(o),l+=o}return m.slice(0,n.length)!==n&&this.error("missing "+n,{length:n.length}),s=v[0],a=v[v.length-1],s[2].first_column-=n.length,a[2].last_column+=n.length,0===a[1].length&&(a[2].last_column-=1),{tokens:v,index:l+n.length}},e.prototype.mergeInterpolationTokens=function(e,t,n){var i,r,s,o,a,c,h,l,u,p,d,f,m,g,v,y;for(e.length>1&&(u=this.token("STRING_START","(",0,0)),s=this.tokens.length,o=a=0,h=e.length;h>a;o=++a){switch(g=e[o],m=g[0],y=g[1],m){case"TOKENS":if(2===y.length)continue;l=y[0],v=y;break;case"NEOSTRING":if(i=n(g[1],o),0===i.length){if(0!==o)continue;r=this.tokens.length}2===o&&null!=r&&this.tokens.splice(r,2),g[0]="STRING",g[1]=this.makeDelimitedLiteral(i,t),l=g,v=[g]}this.tokens.length>s&&(p=this.token("+","+"),p[2]={first_line:l[2].first_line,first_column:l[2].first_column,last_line:l[2].first_line,last_column:l[2].first_column}),(d=this.tokens).push.apply(d,v)}return u?(c=e[e.length-1],u.origin=["STRING",null,{first_line:u[2].first_line,first_column:u[2].first_column,last_line:c[2].last_line,last_column:c[2].last_column}],f=this.token("STRING_END",")"),f[2]={first_line:c[2].last_line,first_column:c[2].last_column,last_line:c[2].last_line,last_column:c[2].last_column}):void 0},e.prototype.pair=function(e){var t,n,i,r,s;return i=this.ends,n=i[i.length-1],e!==(s=null!=n?n.tag:void 0)?("OUTDENT"!==s&&this.error("unmatched "+e),r=this.indents,t=r[r.length-1],this.outdentToken(t,!0),this.pair(e)):this.ends.pop()},e.prototype.getLineAndColumnFromChunk=function(e){var t,n,i,r,s;return 0===e?[this.chunkLine,this.chunkColumn]:(s=e>=this.chunk.length?this.chunk:this.chunk.slice(0,+(e-1)+1||9e9),i=nt(s,"\n"),t=this.chunkColumn,i>0?(r=s.split("\n"),n=r[r.length-1],t=n.length):t+=s.length,[this.chunkLine+i,t])},e.prototype.makeToken=function(e,t,n,i){var r,s,o,a,c;return null==n&&(n=0),null==i&&(i=t.length),s={},o=this.getLineAndColumnFromChunk(n),s.first_line=o[0],s.first_column=o[1],r=Math.max(0,i-1),a=this.getLineAndColumnFromChunk(n+r),s.last_line=a[0],s.last_column=a[1],c=[e,t,s]},e.prototype.token=function(e,t,n,i,r){var s;return s=this.makeToken(e,t,n,i),r&&(s.origin=r),this.tokens.push(s),s},e.prototype.tag=function(){var e,t;return e=this.tokens,t=e[e.length-1],null!=t?t[0]:void 0},e.prototype.value=function(){var e,t;return e=this.tokens,t=e[e.length-1],null!=t?t[1]:void 0},e.prototype.unfinished=function(){var e;return L.test(this.chunk)||"\\"===(e=this.tag())||"."===e||"?."===e||"?::"===e||"UNARY"===e||"MATH"===e||"UNARY_MATH"===e||"+"===e||"-"===e||"YIELD"===e||"**"===e||"SHIFT"===e||"RELATION"===e||"COMPARE"===e||"LOGIC"===e||"THROW"===e||"EXTENDS"===e},e.prototype.formatString=function(e){return e.replace(X,"$1")},e.prototype.formatHeregex=function(e){return e.replace(g,"$1$2")},e.prototype.validateEscapes=function(e,t){var n,i,r,s,o,a,c,h;return null==t&&(t={}),s=k.exec(e),!s||(s[0],n=s[1],a=s[2],i=s[3],h=s[4],t.isRegex&&a&&"0"!==a.charAt(0))?void 0:(o=a?"octal escape sequences are not allowed":"invalid escape sequence",r="\\"+(a||i||h),this.error(o+" "+r,{offset:(null!=(c=t.offsetInChunk)?c:0)+s.index+n.length,length:r.length}))},e.prototype.makeDelimitedLiteral=function(e,t){var n;return null==t&&(t={}),""===e&&"/"===t.delimiter&&(e="(?:)"),n=RegExp("(\\\\\\\\)|(\\\\0(?=[1-7]))|\\\\?("+t.delimiter+")|\\\\?(?:(\\n)|(\\r)|(\\u2028)|(\\u2029))|(\\\\.)","g"),e=e.replace(n,function(e,n,i,r,s,o,a,c,h){switch(!1){case!n:return t.double?n+n:n;case!i:return"\\x00";case!r:return"\\"+r;case!s:return"\\n";case!o:return"\\r";case!a:return"\\u2028";case!c:return"\\u2029";case!h:return t.double?"\\"+h:h}}),""+t.delimiter+e+t.delimiter},e.prototype.error=function(e,t){var n,i,r,s,o,a;return null==t&&(t={}),r="first_line"in t?t:(o=this.getLineAndColumnFromChunk(null!=(s=t.offset)?s:0),i=o[0],n=o[1],o,{first_line:i,first_column:n,last_column:n+(null!=(a=t.length)?a:1)-1}),lt(e,r)},e}(),E=["true","false","null","this","new","delete","typeof","in","instanceof","return","throw","break","continue","debugger","yield","if","else","switch","for","while","do","try","catch","finally","class","extends","super"],a=["undefined","then","unless","until","loop","of","by","when"],o={and:"&&",or:"||",is:"==",isnt:"!=",not:"!",yes:"true",no:"false",on:"true",off:"false"},s=function(){var e;e=[];for(rt in o)e.push(rt);return e}(),a=a.concat(s),V=["case","default","function","var","void","with","const","let","enum","export","import","native","implements","interface","package","private","protected","public","static"],H=["arguments","eval","yield*"],C=E.concat(V).concat(H),e.RESERVED=V.concat(E).concat(a).concat(H),e.STRICT_PROSCRIBED=H,t=65279,v=/^(?!\d)((?:(?!\s)[$\w\x7f-\uffff])+)([^\n\S]*:(?!:))?/,I=/^0b[01]+|^0o[0-7]+|^0x[\da-f]+|^\d*\.?\d+(?:e[+-]?\d+)?/i,_=/^(?:[-=]>|[-+*\/%<>&|^!?=]=|>>>=?|([-+:])\1|([&|<>*\/%])\2=?|\?(\.|::)|\.{2,3})/,et=/^[^\n\S]+/,c=/^###([^#][\s\S]*?)(?:###[^\n\S]*|###$)|^(?:\s*#(?!##[^#]).*)+/,r=/^[-=]>/,R=/^(?:\n[^\n\S]*)+/,T=/^`[^\\`]*(?:\\.[^\\`]*)*`/,Y=/^(?:'''|"""|'|")/,W=/^(?:[^\\']|\\[\s\S])*/,q=/^(?:[^\\"#]|\\[\s\S]|\#(?!\{))*/,f=/^(?:[^\\']|\\[\s\S]|'(?!''))*/,p=/^(?:[^\\"#]|\\[\s\S]|"(?!"")|\#(?!\{))*/,X=/((?:\\\\)+)|\\[^\S\n]*\n\s*/g,G=/\s*\n\s*/g,d=/\n+([^\n\S]*)(?=\S)/g,$=/^\/(?!\/)((?:[^[\/\n\\]|\\[^\n]|\[(?:\\[^\n]|[^\]\n\\])*])*)(\/)?/,j=/^\w*/,Z=/^(?!.*(.).*\1)[imgy]*$/,m=/^(?:[^\\\/#]|\\[\s\S]|\/(?!\/\/)|\#(?!\{))*/,g=/((?:\\\\)+)|\\(\s)|\s+(?:#.*)?/g,M=/^(\/|\/{3}\s*)(\*)/,O=/^\/=?\s/,u=/\*\//,L=/^\s*(?:,|\??\.(?![.\d])|::)/,k=/((?:^|[^\\])(?:\\\\)*)\\(?:(0[0-7]|[1-7])|(x(?![\da-fA-F]{2}).{0,2})|(u(?![\da-fA-F]{4}).{0,4}))/,F=/^[^\n\S]*\n/,K=/\n[^\n\S]*$/,z=/\s+$/,l=["-=","+=","/=","*=","%=","||=","&&=","?=","<<=",">>=",">>>=","&=","^=","|=","**=","//=","%%="],J=["NEW","TYPEOF","DELETE","DO"],Q=["!","~"],x=["&&","||","&","|","^"],U=["<<",">>",">>>"],h=["==","!=","<",">","<=",">="],D=["*","/","%","//","%%"],B=["IN","OF","INSTANCEOF"],n=["TRUE","FALSE"],i=["IDENTIFIER",")","]","?","@","THIS","SUPER"],b=i.concat(["NUMBER","STRING","STRING_END","REGEX","REGEX_END","BOOL","NULL","UNDEFINED","}","::"]),A=b.concat(["++","--"]),N=["INDENT","OUTDENT","TERMINATOR"],y=[")","}","]"]}.call(this),t.exports}(),require["./parser"]=function(){var e={},t={exports:e},n=function(){function e(){this.yy={}}var t=function(e,t,n,i){for(n=n||{},i=e.length;i--;n[e[i]]=t);return n},n=[1,20],i=[1,75],r=[1,71],s=[1,76],o=[1,77],a=[1,73],c=[1,74],h=[1,50],l=[1,52],u=[1,53],p=[1,54],d=[1,55],f=[1,45],m=[1,46],g=[1,27],v=[1,60],y=[1,61],b=[1,70],k=[1,43],w=[1,26],T=[1,58],C=[1,59],E=[1,57],F=[1,38],N=[1,44],L=[1,56],x=[1,65],S=[1,66],D=[1,67],R=[1,68],A=[1,42],I=[1,64],_=[1,29],O=[1,30],$=[1,31],j=[1,32],M=[1,33],B=[1,34],V=[1,35],P=[1,78],U=[1,6,26,34,108],G=[1,88],H=[1,81],q=[1,80],X=[1,79],W=[1,82],Y=[1,83],K=[1,84],z=[1,85],J=[1,86],Q=[1,87],Z=[1,91],et=[1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,135,136,141,142,143,144,145,146,147],tt=[1,97],nt=[1,98],it=[1,99],rt=[1,100],st=[1,102],ot=[1,103],at=[1,96],ct=[2,112],ht=[1,6,25,26,34,55,60,63,72,73,74,75,77,79,80,84,90,91,92,97,99,108,110,111,112,116,117,132,135,136,141,142,143,144,145,146,147],lt=[2,79],ut=[1,108],pt=[2,58],dt=[1,112],ft=[1,117],mt=[1,118],gt=[1,120],vt=[1,6,25,26,34,46,55,60,63,72,73,74,75,77,79,80,84,90,91,92,97,99,108,110,111,112,116,117,132,135,136,141,142,143,144,145,146,147],yt=[2,76],bt=[1,6,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,135,136,141,142,143,144,145,146,147],kt=[1,155],wt=[1,157],Tt=[1,152],Ct=[1,6,25,26,34,46,55,60,63,72,73,74,75,77,79,80,84,86,90,91,92,97,99,108,110,111,112,116,117,132,135,136,139,140,141,142,143,144,145,146,147,148],Et=[2,95],Ft=[1,6,25,26,34,49,55,60,63,72,73,74,75,77,79,80,84,90,91,92,97,99,108,110,111,112,116,117,132,135,136,141,142,143,144,145,146,147],Nt=[1,6,25,26,34,46,49,55,60,63,72,73,74,75,77,79,80,84,86,90,91,92,97,99,108,110,111,112,116,117,123,124,132,135,136,139,140,141,142,143,144,145,146,147,148],Lt=[1,206],xt=[1,205],St=[1,6,25,26,34,38,55,60,63,72,73,74,75,77,79,80,84,90,91,92,97,99,108,110,111,112,116,117,132,135,136,141,142,143,144,145,146,147],Dt=[2,56],Rt=[1,216],At=[6,25,26,55,60],It=[6,25,26,46,55,60,63],_t=[1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,135,136,142,144,145,146,147],Ot=[1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132],$t=[72,73,74,75,77,80,90,91],jt=[1,235],Mt=[2,133],Bt=[1,6,25,26,34,46,55,60,63,72,73,74,75,77,79,80,84,90,91,92,97,99,108,110,111,112,116,117,123,124,132,135,136,141,142,143,144,145,146,147],Vt=[1,244],Pt=[6,25,26,60,92,97],Ut=[1,6,25,26,34,55,60,63,79,84,92,97,99,108,117,132],Gt=[1,6,25,26,34,55,60,63,79,84,92,97,99,108,111,117,132],Ht=[123,124],qt=[60,123,124],Xt=[1,255],Wt=[6,25,26,60,84],Yt=[6,25,26,49,60,84],Kt=[1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,135,136,144,145,146,147],zt=[11,28,30,32,33,36,37,40,41,42,43,44,51,52,53,57,58,79,82,85,89,94,95,96,102,106,107,110,112,114,116,125,131,133,134,135,136,137,139,140],Jt=[2,122],Qt=[6,25,26],Zt=[2,57],en=[1,268],tn=[1,269],nn=[1,6,25,26,34,55,60,63,79,84,92,97,99,104,105,108,110,111,112,116,117,127,129,132,135,136,141,142,143,144,145,146,147],rn=[26,127,129],sn=[1,6,26,34,55,60,63,79,84,92,97,99,108,111,117,132],on=[2,71],an=[1,291],cn=[1,292],hn=[1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,127,132,135,136,141,142,143,144,145,146,147],ln=[1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,112,116,117,132],un=[1,303],pn=[1,304],dn=[6,25,26,60],fn=[1,6,25,26,34,55,60,63,79,84,92,97,99,104,108,110,111,112,116,117,132,135,136,141,142,143,144,145,146,147],mn=[25,60],gn={trace:function(){},yy:{},symbols_:{error:2,Root:3,Body:4,Line:5,TERMINATOR:6,Expression:7,Statement:8,Return:9,Comment:10,STATEMENT:11,Value:12,Invocation:13,Code:14,Operation:15,Assign:16,If:17,Try:18,While:19,For:20,Switch:21,Class:22,Throw:23,Block:24,INDENT:25,OUTDENT:26,Identifier:27,IDENTIFIER:28,AlphaNumeric:29,NUMBER:30,String:31,STRING:32,STRING_START:33,STRING_END:34,Regex:35,REGEX:36,REGEX_START:37,REGEX_END:38,Literal:39,JS:40,DEBUGGER:41,UNDEFINED:42,NULL:43,BOOL:44,Assignable:45,"=":46,AssignObj:47,ObjAssignable:48,":":49,ThisProperty:50,RETURN:51,HERECOMMENT:52,PARAM_START:53,ParamList:54,PARAM_END:55,FuncGlyph:56,"->":57,"=>":58,OptComma:59,",":60,Param:61,ParamVar:62,"...":63,Array:64,Object:65,Splat:66,SimpleAssignable:67,Accessor:68,Parenthetical:69,Range:70,This:71,".":72,"?.":73,"::":74,"?::":75,Index:76,INDEX_START:77,IndexValue:78,INDEX_END:79,INDEX_SOAK:80,Slice:81,"{":82,AssignList:83,"}":84,CLASS:85,EXTENDS:86,OptFuncExist:87,Arguments:88,SUPER:89,FUNC_EXIST:90,CALL_START:91,CALL_END:92,ArgList:93,THIS:94,"@":95,"[":96,"]":97,RangeDots:98,"..":99,Arg:100,SimpleArgs:101,TRY:102,Catch:103,FINALLY:104,CATCH:105,THROW:106,"(":107,")":108,WhileSource:109,WHILE:110,WHEN:111,UNTIL:112,Loop:113,LOOP:114,ForBody:115,FOR:116,BY:117,ForStart:118,ForSource:119,ForVariables:120,OWN:121,ForValue:122,FORIN:123,FOROF:124,SWITCH:125,Whens:126,ELSE:127,When:128,LEADING_WHEN:129,IfBlock:130,IF:131,POST_IF:132,UNARY:133,UNARY_MATH:134,"-":135,"+":136,YIELD:137,FROM:138,"--":139,"++":140,"?":141,MATH:142,"**":143,SHIFT:144,COMPARE:145,LOGIC:146,RELATION:147,COMPOUND_ASSIGN:148,$accept:0,$end:1},terminals_:{2:"error",6:"TERMINATOR",11:"STATEMENT",25:"INDENT",26:"OUTDENT",28:"IDENTIFIER",30:"NUMBER",32:"STRING",33:"STRING_START",34:"STRING_END",36:"REGEX",37:"REGEX_START",38:"REGEX_END",40:"JS",41:"DEBUGGER",42:"UNDEFINED",43:"NULL",44:"BOOL",46:"=",49:":",51:"RETURN",52:"HERECOMMENT",53:"PARAM_START",55:"PARAM_END",57:"->",58:"=>",60:",",63:"...",72:".",73:"?.",74:"::",75:"?::",77:"INDEX_START",79:"INDEX_END",80:"INDEX_SOAK",82:"{",84:"}",85:"CLASS",86:"EXTENDS",89:"SUPER",90:"FUNC_EXIST",91:"CALL_START",92:"CALL_END",94:"THIS",95:"@",96:"[",97:"]",99:"..",102:"TRY",104:"FINALLY",105:"CATCH",106:"THROW",107:"(",108:")",110:"WHILE",111:"WHEN",112:"UNTIL",114:"LOOP",116:"FOR",117:"BY",121:"OWN",123:"FORIN",124:"FOROF",125:"SWITCH",127:"ELSE",129:"LEADING_WHEN",131:"IF",132:"POST_IF",133:"UNARY",134:"UNARY_MATH",135:"-",136:"+",137:"YIELD",138:"FROM",139:"--",140:"++",141:"?",142:"MATH",143:"**",144:"SHIFT",145:"COMPARE",146:"LOGIC",147:"RELATION",148:"COMPOUND_ASSIGN"},productions_:[0,[3,0],[3,1],[4,1],[4,3],[4,2],[5,1],[5,1],[8,1],[8,1],[8,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[24,2],[24,3],[27,1],[29,1],[29,1],[31,1],[31,3],[35,1],[35,3],[39,1],[39,1],[39,1],[39,1],[39,1],[39,1],[39,1],[16,3],[16,4],[16,5],[47,1],[47,3],[47,5],[47,1],[48,1],[48,1],[48,1],[9,2],[9,1],[10,1],[14,5],[14,2],[56,1],[56,1],[59,0],[59,1],[54,0],[54,1],[54,3],[54,4],[54,6],[61,1],[61,2],[61,3],[61,1],[62,1],[62,1],[62,1],[62,1],[66,2],[67,1],[67,2],[67,2],[67,1],[45,1],[45,1],[45,1],[12,1],[12,1],[12,1],[12,1],[12,1],[68,2],[68,2],[68,2],[68,2],[68,1],[68,1],[76,3],[76,2],[78,1],[78,1],[65,4],[83,0],[83,1],[83,3],[83,4],[83,6],[22,1],[22,2],[22,3],[22,4],[22,2],[22,3],[22,4],[22,5],[13,3],[13,3],[13,1],[13,2],[87,0],[87,1],[88,2],[88,4],[71,1],[71,1],[50,2],[64,2],[64,4],[98,1],[98,1],[70,5],[81,3],[81,2],[81,2],[81,1],[93,1],[93,3],[93,4],[93,4],[93,6],[100,1],[100,1],[100,1],[101,1],[101,3],[18,2],[18,3],[18,4],[18,5],[103,3],[103,3],[103,2],[23,2],[69,3],[69,5],[109,2],[109,4],[109,2],[109,4],[19,2],[19,2],[19,2],[19,1],[113,2],[113,2],[20,2],[20,2],[20,2],[115,2],[115,4],[115,2],[118,2],[118,3],[122,1],[122,1],[122,1],[122,1],[120,1],[120,3],[119,2],[119,2],[119,4],[119,4],[119,4],[119,6],[119,6],[21,5],[21,7],[21,4],[21,6],[126,1],[126,2],[128,3],[128,4],[130,3],[130,5],[17,1],[17,3],[17,3],[17,3],[15,2],[15,2],[15,2],[15,2],[15,2],[15,2],[15,3],[15,2],[15,2],[15,2],[15,2],[15,2],[15,3],[15,3],[15,3],[15,3],[15,3],[15,3],[15,3],[15,3],[15,3],[15,5],[15,4],[15,3]],performAction:function(e,t,n,i,r,s,o){var a=s.length-1;
switch(r){case 1:return this.$=i.addLocationDataFn(o[a],o[a])(new i.Block);case 2:return this.$=s[a];case 3:this.$=i.addLocationDataFn(o[a],o[a])(i.Block.wrap([s[a]]));break;case 4:this.$=i.addLocationDataFn(o[a-2],o[a])(s[a-2].push(s[a]));break;case 5:this.$=s[a-1];break;case 6:case 7:case 8:case 9:case 11:case 12:case 13:case 14:case 15:case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 27:case 32:case 34:case 45:case 46:case 47:case 48:case 56:case 57:case 67:case 68:case 69:case 70:case 75:case 76:case 79:case 83:case 89:case 133:case 134:case 136:case 166:case 167:case 183:case 189:this.$=s[a];break;case 10:case 25:case 26:case 28:case 30:case 33:case 35:this.$=i.addLocationDataFn(o[a],o[a])(new i.Literal(s[a]));break;case 23:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Block);break;case 24:case 31:case 90:this.$=i.addLocationDataFn(o[a-2],o[a])(s[a-1]);break;case 29:case 146:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Parens(s[a-1]));break;case 36:this.$=i.addLocationDataFn(o[a],o[a])(new i.Undefined);break;case 37:this.$=i.addLocationDataFn(o[a],o[a])(new i.Null);break;case 38:this.$=i.addLocationDataFn(o[a],o[a])(new i.Bool(s[a]));break;case 39:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Assign(s[a-2],s[a]));break;case 40:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.Assign(s[a-3],s[a]));break;case 41:this.$=i.addLocationDataFn(o[a-4],o[a])(new i.Assign(s[a-4],s[a-1]));break;case 42:case 72:case 77:case 78:case 80:case 81:case 82:case 168:case 169:this.$=i.addLocationDataFn(o[a],o[a])(new i.Value(s[a]));break;case 43:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Assign(i.addLocationDataFn(o[a-2])(new i.Value(s[a-2])),s[a],"object"));break;case 44:this.$=i.addLocationDataFn(o[a-4],o[a])(new i.Assign(i.addLocationDataFn(o[a-4])(new i.Value(s[a-4])),s[a-1],"object"));break;case 49:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Return(s[a]));break;case 50:this.$=i.addLocationDataFn(o[a],o[a])(new i.Return);break;case 51:this.$=i.addLocationDataFn(o[a],o[a])(new i.Comment(s[a]));break;case 52:this.$=i.addLocationDataFn(o[a-4],o[a])(new i.Code(s[a-3],s[a],s[a-1]));break;case 53:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Code([],s[a],s[a-1]));break;case 54:this.$=i.addLocationDataFn(o[a],o[a])("func");break;case 55:this.$=i.addLocationDataFn(o[a],o[a])("boundfunc");break;case 58:case 95:this.$=i.addLocationDataFn(o[a],o[a])([]);break;case 59:case 96:case 128:case 170:this.$=i.addLocationDataFn(o[a],o[a])([s[a]]);break;case 60:case 97:case 129:this.$=i.addLocationDataFn(o[a-2],o[a])(s[a-2].concat(s[a]));break;case 61:case 98:case 130:this.$=i.addLocationDataFn(o[a-3],o[a])(s[a-3].concat(s[a]));break;case 62:case 99:case 132:this.$=i.addLocationDataFn(o[a-5],o[a])(s[a-5].concat(s[a-2]));break;case 63:this.$=i.addLocationDataFn(o[a],o[a])(new i.Param(s[a]));break;case 64:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Param(s[a-1],null,!0));break;case 65:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Param(s[a-2],s[a]));break;case 66:case 135:this.$=i.addLocationDataFn(o[a],o[a])(new i.Expansion);break;case 71:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Splat(s[a-1]));break;case 73:this.$=i.addLocationDataFn(o[a-1],o[a])(s[a-1].add(s[a]));break;case 74:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Value(s[a-1],[].concat(s[a])));break;case 84:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Access(s[a]));break;case 85:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Access(s[a],"soak"));break;case 86:this.$=i.addLocationDataFn(o[a-1],o[a])([i.addLocationDataFn(o[a-1])(new i.Access(new i.Literal("prototype"))),i.addLocationDataFn(o[a])(new i.Access(s[a]))]);break;case 87:this.$=i.addLocationDataFn(o[a-1],o[a])([i.addLocationDataFn(o[a-1])(new i.Access(new i.Literal("prototype"),"soak")),i.addLocationDataFn(o[a])(new i.Access(s[a]))]);break;case 88:this.$=i.addLocationDataFn(o[a],o[a])(new i.Access(new i.Literal("prototype")));break;case 91:this.$=i.addLocationDataFn(o[a-1],o[a])(i.extend(s[a],{soak:!0}));break;case 92:this.$=i.addLocationDataFn(o[a],o[a])(new i.Index(s[a]));break;case 93:this.$=i.addLocationDataFn(o[a],o[a])(new i.Slice(s[a]));break;case 94:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.Obj(s[a-2],s[a-3].generated));break;case 100:this.$=i.addLocationDataFn(o[a],o[a])(new i.Class);break;case 101:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Class(null,null,s[a]));break;case 102:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Class(null,s[a]));break;case 103:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.Class(null,s[a-1],s[a]));break;case 104:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Class(s[a]));break;case 105:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Class(s[a-1],null,s[a]));break;case 106:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.Class(s[a-2],s[a]));break;case 107:this.$=i.addLocationDataFn(o[a-4],o[a])(new i.Class(s[a-3],s[a-1],s[a]));break;case 108:case 109:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Call(s[a-2],s[a],s[a-1]));break;case 110:this.$=i.addLocationDataFn(o[a],o[a])(new i.Call("super",[new i.Splat(new i.Literal("arguments"))]));break;case 111:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Call("super",s[a]));break;case 112:this.$=i.addLocationDataFn(o[a],o[a])(!1);break;case 113:this.$=i.addLocationDataFn(o[a],o[a])(!0);break;case 114:this.$=i.addLocationDataFn(o[a-1],o[a])([]);break;case 115:case 131:this.$=i.addLocationDataFn(o[a-3],o[a])(s[a-2]);break;case 116:case 117:this.$=i.addLocationDataFn(o[a],o[a])(new i.Value(new i.Literal("this")));break;case 118:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Value(i.addLocationDataFn(o[a-1])(new i.Literal("this")),[i.addLocationDataFn(o[a])(new i.Access(s[a]))],"this"));break;case 119:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Arr([]));break;case 120:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.Arr(s[a-2]));break;case 121:this.$=i.addLocationDataFn(o[a],o[a])("inclusive");break;case 122:this.$=i.addLocationDataFn(o[a],o[a])("exclusive");break;case 123:this.$=i.addLocationDataFn(o[a-4],o[a])(new i.Range(s[a-3],s[a-1],s[a-2]));break;case 124:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Range(s[a-2],s[a],s[a-1]));break;case 125:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Range(s[a-1],null,s[a]));break;case 126:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Range(null,s[a],s[a-1]));break;case 127:this.$=i.addLocationDataFn(o[a],o[a])(new i.Range(null,null,s[a]));break;case 137:this.$=i.addLocationDataFn(o[a-2],o[a])([].concat(s[a-2],s[a]));break;case 138:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Try(s[a]));break;case 139:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Try(s[a-1],s[a][0],s[a][1]));break;case 140:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.Try(s[a-2],null,null,s[a]));break;case 141:this.$=i.addLocationDataFn(o[a-4],o[a])(new i.Try(s[a-3],s[a-2][0],s[a-2][1],s[a]));break;case 142:this.$=i.addLocationDataFn(o[a-2],o[a])([s[a-1],s[a]]);break;case 143:this.$=i.addLocationDataFn(o[a-2],o[a])([i.addLocationDataFn(o[a-1])(new i.Value(s[a-1])),s[a]]);break;case 144:this.$=i.addLocationDataFn(o[a-1],o[a])([null,s[a]]);break;case 145:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Throw(s[a]));break;case 147:this.$=i.addLocationDataFn(o[a-4],o[a])(new i.Parens(s[a-2]));break;case 148:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.While(s[a]));break;case 149:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.While(s[a-2],{guard:s[a]}));break;case 150:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.While(s[a],{invert:!0}));break;case 151:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.While(s[a-2],{invert:!0,guard:s[a]}));break;case 152:this.$=i.addLocationDataFn(o[a-1],o[a])(s[a-1].addBody(s[a]));break;case 153:case 154:this.$=i.addLocationDataFn(o[a-1],o[a])(s[a].addBody(i.addLocationDataFn(o[a-1])(i.Block.wrap([s[a-1]]))));break;case 155:this.$=i.addLocationDataFn(o[a],o[a])(s[a]);break;case 156:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.While(i.addLocationDataFn(o[a-1])(new i.Literal("true"))).addBody(s[a]));break;case 157:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.While(i.addLocationDataFn(o[a-1])(new i.Literal("true"))).addBody(i.addLocationDataFn(o[a])(i.Block.wrap([s[a]]))));break;case 158:case 159:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.For(s[a-1],s[a]));break;case 160:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.For(s[a],s[a-1]));break;case 161:this.$=i.addLocationDataFn(o[a-1],o[a])({source:i.addLocationDataFn(o[a])(new i.Value(s[a]))});break;case 162:this.$=i.addLocationDataFn(o[a-3],o[a])({source:i.addLocationDataFn(o[a-2])(new i.Value(s[a-2])),step:s[a]});break;case 163:this.$=i.addLocationDataFn(o[a-1],o[a])(function(){return s[a].own=s[a-1].own,s[a].name=s[a-1][0],s[a].index=s[a-1][1],s[a]}());break;case 164:this.$=i.addLocationDataFn(o[a-1],o[a])(s[a]);break;case 165:this.$=i.addLocationDataFn(o[a-2],o[a])(function(){return s[a].own=!0,s[a]}());break;case 171:this.$=i.addLocationDataFn(o[a-2],o[a])([s[a-2],s[a]]);break;case 172:this.$=i.addLocationDataFn(o[a-1],o[a])({source:s[a]});break;case 173:this.$=i.addLocationDataFn(o[a-1],o[a])({source:s[a],object:!0});break;case 174:this.$=i.addLocationDataFn(o[a-3],o[a])({source:s[a-2],guard:s[a]});break;case 175:this.$=i.addLocationDataFn(o[a-3],o[a])({source:s[a-2],guard:s[a],object:!0});break;case 176:this.$=i.addLocationDataFn(o[a-3],o[a])({source:s[a-2],step:s[a]});break;case 177:this.$=i.addLocationDataFn(o[a-5],o[a])({source:s[a-4],guard:s[a-2],step:s[a]});break;case 178:this.$=i.addLocationDataFn(o[a-5],o[a])({source:s[a-4],step:s[a-2],guard:s[a]});break;case 179:this.$=i.addLocationDataFn(o[a-4],o[a])(new i.Switch(s[a-3],s[a-1]));break;case 180:this.$=i.addLocationDataFn(o[a-6],o[a])(new i.Switch(s[a-5],s[a-3],s[a-1]));break;case 181:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.Switch(null,s[a-1]));break;case 182:this.$=i.addLocationDataFn(o[a-5],o[a])(new i.Switch(null,s[a-3],s[a-1]));break;case 184:this.$=i.addLocationDataFn(o[a-1],o[a])(s[a-1].concat(s[a]));break;case 185:this.$=i.addLocationDataFn(o[a-2],o[a])([[s[a-1],s[a]]]);break;case 186:this.$=i.addLocationDataFn(o[a-3],o[a])([[s[a-2],s[a-1]]]);break;case 187:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.If(s[a-1],s[a],{type:s[a-2]}));break;case 188:this.$=i.addLocationDataFn(o[a-4],o[a])(s[a-4].addElse(i.addLocationDataFn(o[a-2],o[a])(new i.If(s[a-1],s[a],{type:s[a-2]}))));break;case 190:this.$=i.addLocationDataFn(o[a-2],o[a])(s[a-2].addElse(s[a]));break;case 191:case 192:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.If(s[a],i.addLocationDataFn(o[a-2])(i.Block.wrap([s[a-2]])),{type:s[a-1],statement:!0}));break;case 193:case 194:case 197:case 198:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Op(s[a-1],s[a]));break;case 195:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Op("-",s[a]));break;case 196:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Op("+",s[a]));break;case 199:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Op(s[a-2].concat(s[a-1]),s[a]));break;case 200:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Op("--",s[a]));break;case 201:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Op("++",s[a]));break;case 202:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Op("--",s[a-1],null,!0));break;case 203:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Op("++",s[a-1],null,!0));break;case 204:this.$=i.addLocationDataFn(o[a-1],o[a])(new i.Existence(s[a-1]));break;case 205:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Op("+",s[a-2],s[a]));break;case 206:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Op("-",s[a-2],s[a]));break;case 207:case 208:case 209:case 210:case 211:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Op(s[a-1],s[a-2],s[a]));break;case 212:this.$=i.addLocationDataFn(o[a-2],o[a])(function(){return"!"===s[a-1].charAt(0)?new i.Op(s[a-1].slice(1),s[a-2],s[a]).invert():new i.Op(s[a-1],s[a-2],s[a])}());break;case 213:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Assign(s[a-2],s[a],s[a-1]));break;case 214:this.$=i.addLocationDataFn(o[a-4],o[a])(new i.Assign(s[a-4],s[a-1],s[a-3]));break;case 215:this.$=i.addLocationDataFn(o[a-3],o[a])(new i.Assign(s[a-3],s[a],s[a-2]));break;case 216:this.$=i.addLocationDataFn(o[a-2],o[a])(new i.Extends(s[a-2],s[a]))}},table:[{1:[2,1],3:1,4:2,5:3,7:4,8:5,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{1:[3]},{1:[2,2],6:P},t(U,[2,3]),t(U,[2,6],{118:69,109:89,115:90,110:x,112:S,116:R,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(U,[2,7],{118:69,109:92,115:93,110:x,112:S,116:R,132:Z}),t(et,[2,11],{87:94,68:95,76:101,72:tt,73:nt,74:it,75:rt,77:st,80:ot,90:at,91:ct}),t(et,[2,12],{76:101,87:104,68:105,72:tt,73:nt,74:it,75:rt,77:st,80:ot,90:at,91:ct}),t(et,[2,13]),t(et,[2,14]),t(et,[2,15]),t(et,[2,16]),t(et,[2,17]),t(et,[2,18]),t(et,[2,19]),t(et,[2,20]),t(et,[2,21]),t(et,[2,22]),t(et,[2,8]),t(et,[2,9]),t(et,[2,10]),t(ht,lt,{46:[1,106]}),t(ht,[2,80]),t(ht,[2,81]),t(ht,[2,82]),t(ht,[2,83]),t([1,6,25,26,34,38,55,60,63,72,73,74,75,77,79,80,84,90,92,97,99,108,110,111,112,116,117,132,135,136,141,142,143,144,145,146,147],[2,110],{88:107,91:ut}),t([6,25,55,60],pt,{54:109,61:110,62:111,27:113,50:114,64:115,65:116,28:i,63:dt,82:b,95:ft,96:mt}),{24:119,25:gt},{7:121,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:123,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:124,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:125,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:127,8:126,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,138:[1,128],139:B,140:V},{12:130,13:131,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:132,50:63,64:47,65:48,67:129,69:23,70:24,71:25,82:b,89:w,94:T,95:C,96:E,107:L},{12:130,13:131,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:132,50:63,64:47,65:48,67:133,69:23,70:24,71:25,82:b,89:w,94:T,95:C,96:E,107:L},t(vt,yt,{86:[1,137],139:[1,134],140:[1,135],148:[1,136]}),t(et,[2,189],{127:[1,138]}),{24:139,25:gt},{24:140,25:gt},t(et,[2,155]),{24:141,25:gt},{7:142,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:[1,143],27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(bt,[2,100],{39:22,69:23,70:24,71:25,64:47,65:48,29:49,35:51,27:62,50:63,31:72,12:130,13:131,45:132,24:144,67:146,25:gt,28:i,30:r,32:s,33:o,36:a,37:c,40:h,41:l,42:u,43:p,44:d,82:b,86:[1,145],89:w,94:T,95:C,96:E,107:L}),{7:147,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t([1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,141,142,143,144,145,146,147],[2,50],{12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,9:18,10:19,45:21,39:22,69:23,70:24,71:25,56:28,67:36,130:37,109:39,113:40,115:41,64:47,65:48,29:49,35:51,27:62,50:63,118:69,31:72,8:122,7:148,11:n,28:i,30:r,32:s,33:o,36:a,37:c,40:h,41:l,42:u,43:p,44:d,51:f,52:m,53:g,57:v,58:y,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,114:D,125:A,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V}),t(et,[2,51]),t(vt,[2,77]),t(vt,[2,78]),t(ht,[2,32]),t(ht,[2,33]),t(ht,[2,34]),t(ht,[2,35]),t(ht,[2,36]),t(ht,[2,37]),t(ht,[2,38]),{4:149,5:3,7:4,8:5,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:[1,150],27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:151,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:kt,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,63:wt,64:47,65:48,66:156,67:36,69:23,70:24,71:25,82:b,85:k,89:w,93:153,94:T,95:C,96:E,97:Tt,100:154,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(ht,[2,116]),t(ht,[2,117],{27:158,28:i}),{25:[2,54]},{25:[2,55]},t(Ct,[2,72]),t(Ct,[2,75]),{7:159,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:160,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:161,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:163,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,24:162,25:gt,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{27:168,28:i,50:169,64:170,65:171,70:164,82:b,95:ft,96:E,120:165,121:[1,166],122:167},{119:172,123:[1,173],124:[1,174]},t([6,25,60,84],Et,{31:72,83:175,47:176,48:177,10:178,27:179,29:180,50:181,28:i,30:r,32:s,33:o,52:m,95:ft}),t(Ft,[2,26]),t(Ft,[2,27]),t(ht,[2,30]),{12:130,13:182,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:132,50:63,64:47,65:48,67:183,69:23,70:24,71:25,82:b,89:w,94:T,95:C,96:E,107:L},t(Nt,[2,25]),t(Ft,[2,28]),{4:184,5:3,7:4,8:5,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(U,[2,5],{7:4,8:5,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,9:18,10:19,45:21,39:22,69:23,70:24,71:25,56:28,67:36,130:37,109:39,113:40,115:41,64:47,65:48,29:49,35:51,27:62,50:63,118:69,31:72,5:185,11:n,28:i,30:r,32:s,33:o,36:a,37:c,40:h,41:l,42:u,43:p,44:d,51:f,52:m,53:g,57:v,58:y,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,110:x,112:S,114:D,116:R,125:A,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V}),t(et,[2,204]),{7:186,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:187,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:188,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:189,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:190,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:191,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:192,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:193,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:194,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(et,[2,154]),t(et,[2,159]),{7:195,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(et,[2,153]),t(et,[2,158]),{88:196,91:ut},t(Ct,[2,73]),{91:[2,113]},{27:197,28:i},{27:198,28:i},t(Ct,[2,88],{27:199,28:i}),{27:200,28:i},t(Ct,[2,89]),{7:202,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,63:Lt,64:47,65:48,67:36,69:23,70:24,71:25,78:201,81:203,82:b,85:k,89:w,94:T,95:C,96:E,98:204,99:xt,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{76:207,77:st,80:ot},{88:208,91:ut},t(Ct,[2,74]),{6:[1,210],7:209,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:[1,211],27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(St,[2,111]),{7:214,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:kt,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,63:wt,64:47,65:48,66:156,67:36,69:23,70:24,71:25,82:b,85:k,89:w,92:[1,212],93:213,94:T,95:C,96:E,100:154,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t([6,25],Dt,{59:217,55:[1,215],60:Rt}),t(At,[2,59]),t(At,[2,63],{46:[1,219],63:[1,218]}),t(At,[2,66]),t(It,[2,67]),t(It,[2,68]),t(It,[2,69]),t(It,[2,70]),{27:158,28:i},{7:214,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:kt,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,63:wt,64:47,65:48,66:156,67:36,69:23,70:24,71:25,82:b,85:k,89:w,93:153,94:T,95:C,96:E,97:Tt,100:154,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(et,[2,53]),{4:221,5:3,7:4,8:5,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,26:[1,220],27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t([1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,135,136,142,143,144,145,146,147],[2,193],{118:69,109:89,115:90,141:X}),{109:92,110:x,112:S,115:93,116:R,118:69,132:Z},t(_t,[2,194],{118:69,109:89,115:90,141:X,143:Y}),t(_t,[2,195],{118:69,109:89,115:90,141:X,143:Y}),t(_t,[2,196],{118:69,109:89,115:90,141:X,143:Y}),t(et,[2,197],{118:69,109:92,115:93}),t(Ot,[2,198],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{7:222,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(et,[2,200],{72:yt,73:yt,74:yt,75:yt,77:yt,80:yt,90:yt,91:yt}),{68:95,72:tt,73:nt,74:it,75:rt,76:101,77:st,80:ot,87:94,90:at,91:ct},{68:105,72:tt,73:nt,74:it,75:rt,76:101,77:st,80:ot,87:104,90:at,91:ct},t($t,lt),t(et,[2,201],{72:yt,73:yt,74:yt,75:yt,77:yt,80:yt,90:yt,91:yt}),t(et,[2,202]),t(et,[2,203]),{6:[1,225],7:223,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:[1,224],27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:226,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{24:227,25:gt,131:[1,228]},t(et,[2,138],{103:229,104:[1,230],105:[1,231]}),t(et,[2,152]),t(et,[2,160]),{25:[1,232],109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},{126:233,128:234,129:jt},t(et,[2,101]),{7:236,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(bt,[2,104],{24:237,25:gt,72:yt,73:yt,74:yt,75:yt,77:yt,80:yt,90:yt,91:yt,86:[1,238]}),t(Ot,[2,145],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Ot,[2,49],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{6:P,108:[1,239]},{4:240,5:3,7:4,8:5,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t([6,25,60,97],Mt,{118:69,109:89,115:90,98:241,63:[1,242],99:xt,110:x,112:S,116:R,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Bt,[2,119]),t([6,25,97],Dt,{59:243,60:Vt}),t(Pt,[2,128]),{7:214,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:kt,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,63:wt,64:47,65:48,66:156,67:36,69:23,70:24,71:25,82:b,85:k,89:w,93:245,94:T,95:C,96:E,100:154,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(Pt,[2,134]),t(Pt,[2,135]),t(Nt,[2,118]),{24:246,25:gt,109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},t(Ut,[2,148],{118:69,109:89,115:90,110:x,111:[1,247],112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Ut,[2,150],{118:69,109:89,115:90,110:x,111:[1,248],112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(et,[2,156]),t(Gt,[2,157],{118:69,109:89,115:90,110:x,112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t([1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,132,135,136,141,142,143,144,145,146,147],[2,161],{117:[1,249]}),t(Ht,[2,164]),{27:168,28:i,50:169,64:170,65:171,82:b,95:ft,96:mt,120:250,122:167},t(Ht,[2,170],{60:[1,251]}),t(qt,[2,166]),t(qt,[2,167]),t(qt,[2,168]),t(qt,[2,169]),t(et,[2,163]),{7:252,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:253,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t([6,25,84],Dt,{59:254,60:Xt}),t(Wt,[2,96]),t(Wt,[2,42],{49:[1,256]}),t(Wt,[2,45]),t(Yt,[2,46]),t(Yt,[2,47]),t(Yt,[2,48]),{38:[1,257],68:105,72:tt,73:nt,74:it,75:rt,76:101,77:st,80:ot,87:104,90:at,91:ct},t($t,yt),{6:P,34:[1,258]},t(U,[2,4]),t(Kt,[2,205],{118:69,109:89,115:90,141:X,142:W,143:Y}),t(Kt,[2,206],{118:69,109:89,115:90,141:X,142:W,143:Y}),t(_t,[2,207],{118:69,109:89,115:90,141:X,143:Y}),t(_t,[2,208],{118:69,109:89,115:90,141:X,143:Y}),t([1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,144,145,146,147],[2,209],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y}),t([1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,145,146],[2,210],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,147:Q}),t([1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,146],[2,211],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,147:Q}),t([1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,117,132,145,146,147],[2,212],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K}),t(Gt,[2,192],{118:69,109:89,115:90,110:x,112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Gt,[2,191],{118:69,109:89,115:90,110:x,112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(St,[2,108]),t(Ct,[2,84]),t(Ct,[2,85]),t(Ct,[2,86]),t(Ct,[2,87]),{79:[1,259]},{63:Lt,79:[2,92],98:260,99:xt,109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},{79:[2,93]},{7:261,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,79:[2,127],82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(zt,[2,121]),t(zt,Jt),t(Ct,[2,91]),t(St,[2,109]),t(Ot,[2,39],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{7:262,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:263,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(St,[2,114]),t([6,25,92],Dt,{59:264,60:Vt}),t(Pt,Mt,{118:69,109:89,115:90,63:[1,265],110:x,112:S,116:R,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{56:266,57:v,58:y},t(Qt,Zt,{62:111,27:113,50:114,64:115,65:116,61:267,28:i,63:dt,82:b,95:ft,96:mt}),{6:en,25:tn},t(At,[2,64]),{7:270,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(nn,[2,23]),{6:P,26:[1,271]},t(Ot,[2,199],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Ot,[2,213],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{7:272,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:273,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(Ot,[2,216],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(et,[2,190]),{7:274,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(et,[2,139],{104:[1,275]}),{24:276,25:gt},{24:279,25:gt,27:277,28:i,65:278,82:b},{126:280,128:234,129:jt},{26:[1,281],127:[1,282],128:283,129:jt},t(rn,[2,183]),{7:285,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,101:284,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(sn,[2,102],{118:69,109:89,115:90,24:286,25:gt,110:x,112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(et,[2,105]),{7:287,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(ht,[2,146]),{6:P,26:[1,288]},{7:289,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t([11,28,30,32,33,36,37,40,41,42,43,44,51,52,53,57,58,82,85,89,94,95,96,102,106,107,110,112,114,116,125,131,133,134,135,136,137,139,140],Jt,{6:on,25:on,60:on,97:on}),{6:an,25:cn,97:[1,290]},t([6,25,26,92,97],Zt,{12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,9:18,10:19,45:21,39:22,69:23,70:24,71:25,56:28,67:36,130:37,109:39,113:40,115:41,64:47,65:48,29:49,35:51,27:62,50:63,118:69,31:72,8:122,66:156,7:214,100:293,11:n,28:i,30:r,32:s,33:o,36:a,37:c,40:h,41:l,42:u,43:p,44:d,51:f,52:m,53:g,57:v,58:y,63:wt,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,110:x,112:S,114:D,116:R,125:A,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V}),t(Qt,Dt,{59:294,60:Vt}),t(hn,[2,187]),{7:295,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:296,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:297,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(Ht,[2,165]),{27:168,28:i,50:169,64:170,65:171,82:b,95:ft,96:mt,122:298},t([1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,112,116,132],[2,172],{118:69,109:89,115:90,111:[1,299],117:[1,300],135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(ln,[2,173],{118:69,109:89,115:90,111:[1,301],135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{6:un,25:pn,84:[1,302]},t([6,25,26,84],Zt,{31:72,48:177,10:178,27:179,29:180,50:181,47:305,28:i,30:r,32:s,33:o,52:m,95:ft}),{7:306,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:[1,307],27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(ht,[2,31]),t(Ft,[2,29]),t(Ct,[2,90]),{7:308,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,79:[2,125],82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{79:[2,126],109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},t(Ot,[2,40],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{26:[1,309],109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},{6:an,25:cn,92:[1,310]},t(Pt,on),{24:311,25:gt},t(At,[2,60]),{27:113,28:i,50:114,61:312,62:111,63:dt,64:115,65:116,82:b,95:ft,96:mt},t(dn,pt,{61:110,62:111,27:113,50:114,64:115,65:116,54:313,28:i,63:dt,82:b,95:ft,96:mt}),t(At,[2,65],{118:69,109:89,115:90,110:x,112:S,116:R,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(nn,[2,24]),{26:[1,314],109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},t(Ot,[2,215],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{24:315,25:gt,109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},{24:316,25:gt},t(et,[2,140]),{24:317,25:gt},{24:318,25:gt},t(fn,[2,144]),{26:[1,319],127:[1,320],128:283,129:jt},t(et,[2,181]),{24:321,25:gt},t(rn,[2,184]),{24:322,25:gt,60:[1,323]},t(mn,[2,136],{118:69,109:89,115:90,110:x,112:S,116:R,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(et,[2,103]),t(sn,[2,106],{118:69,109:89,115:90,24:324,25:gt,110:x,112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{108:[1,325]},{97:[1,326],109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},t(Bt,[2,120]),{7:214,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,63:wt,64:47,65:48,66:156,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,100:327,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:214,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,25:kt,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,63:wt,64:47,65:48,66:156,67:36,69:23,70:24,71:25,82:b,85:k,89:w,93:328,94:T,95:C,96:E,100:154,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(Pt,[2,129]),{6:an,25:cn,26:[1,329]},t(Gt,[2,149],{118:69,109:89,115:90,110:x,112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Gt,[2,151],{118:69,109:89,115:90,110:x,112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Gt,[2,162],{118:69,109:89,115:90,110:x,112:S,116:R,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Ht,[2,171]),{7:330,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:331,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:332,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(Bt,[2,94]),{10:178,27:179,28:i,29:180,30:r,31:72,32:s,33:o,47:333,48:177,50:181,52:m,95:ft},t(dn,Et,{31:72,47:176,48:177,10:178,27:179,29:180,50:181,83:334,28:i,30:r,32:s,33:o,52:m,95:ft}),t(Wt,[2,97]),t(Wt,[2,43],{118:69,109:89,115:90,110:x,112:S,116:R,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{7:335,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{79:[2,124],109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},t(et,[2,41]),t(St,[2,115]),t(et,[2,52]),t(At,[2,61]),t(Qt,Dt,{59:336,60:Rt}),t(et,[2,214]),t(hn,[2,188]),t(et,[2,141]),t(fn,[2,142]),t(fn,[2,143]),t(et,[2,179]),{24:337,25:gt},{26:[1,338]},t(rn,[2,185],{6:[1,339]}),{7:340,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},t(et,[2,107]),t(ht,[2,147]),t(ht,[2,123]),t(Pt,[2,130]),t(Qt,Dt,{59:341,60:Vt}),t(Pt,[2,131]),t([1,6,25,26,34,55,60,63,79,84,92,97,99,108,110,111,112,116,132],[2,174],{118:69,109:89,115:90,117:[1,342],135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(ln,[2,176],{118:69,109:89,115:90,111:[1,343],135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Ot,[2,175],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Wt,[2,98]),t(Qt,Dt,{59:344,60:Xt}),{26:[1,345],109:89,110:x,112:S,115:90,116:R,118:69,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q},{6:en,25:tn,26:[1,346]},{26:[1,347]},t(et,[2,182]),t(rn,[2,186]),t(mn,[2,137],{118:69,109:89,115:90,110:x,112:S,116:R,132:G,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),{6:an,25:cn,26:[1,348]},{7:349,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{7:350,8:122,9:18,10:19,11:n,12:6,13:7,14:8,15:9,16:10,17:11,18:12,19:13,20:14,21:15,22:16,23:17,27:62,28:i,29:49,30:r,31:72,32:s,33:o,35:51,36:a,37:c,39:22,40:h,41:l,42:u,43:p,44:d,45:21,50:63,51:f,52:m,53:g,56:28,57:v,58:y,64:47,65:48,67:36,69:23,70:24,71:25,82:b,85:k,89:w,94:T,95:C,96:E,102:F,106:N,107:L,109:39,110:x,112:S,113:40,114:D,115:41,116:R,118:69,125:A,130:37,131:I,133:_,134:O,135:$,136:j,137:M,139:B,140:V},{6:un,25:pn,26:[1,351]},t(Wt,[2,44]),t(At,[2,62]),t(et,[2,180]),t(Pt,[2,132]),t(Ot,[2,177],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Ot,[2,178],{118:69,109:89,115:90,135:H,136:q,141:X,142:W,143:Y,144:K,145:z,146:J,147:Q}),t(Wt,[2,99])],defaultActions:{60:[2,54],61:[2,55],96:[2,113],203:[2,93]},parseError:function(e,t){if(!t.recoverable)throw Error(e);
this.trace(e)},parse:function(e){function t(){var e;return e=f.lex()||p,"number"!=typeof e&&(e=n.symbols_[e]||e),e}var n=this,i=[0],r=[null],s=[],o=this.table,a="",c=0,h=0,l=0,u=2,p=1,d=s.slice.call(arguments,1),f=Object.create(this.lexer),m={yy:{}};for(var g in this.yy)Object.prototype.hasOwnProperty.call(this.yy,g)&&(m.yy[g]=this.yy[g]);f.setInput(e,m.yy),m.yy.lexer=f,m.yy.parser=this,f.yylloc===void 0&&(f.yylloc={});var v=f.yylloc;s.push(v);var y=f.options&&f.options.ranges;this.parseError="function"==typeof m.yy.parseError?m.yy.parseError:Object.getPrototypeOf(this).parseError;for(var b,k,w,T,C,E,F,N,L,x={};;){if(w=i[i.length-1],this.defaultActions[w]?T=this.defaultActions[w]:((null===b||b===void 0)&&(b=t()),T=o[w]&&o[w][b]),T===void 0||!T.length||!T[0]){var S="";L=[];for(E in o[w])this.terminals_[E]&&E>u&&L.push("'"+this.terminals_[E]+"'");S=f.showPosition?"Parse error on line "+(c+1)+":\n"+f.showPosition()+"\nExpecting "+L.join(", ")+", got '"+(this.terminals_[b]||b)+"'":"Parse error on line "+(c+1)+": Unexpected "+(b==p?"end of input":"'"+(this.terminals_[b]||b)+"'"),this.parseError(S,{text:f.match,token:this.terminals_[b]||b,line:f.yylineno,loc:v,expected:L})}if(T[0]instanceof Array&&T.length>1)throw Error("Parse Error: multiple actions possible at state: "+w+", token: "+b);switch(T[0]){case 1:i.push(b),r.push(f.yytext),s.push(f.yylloc),i.push(T[1]),b=null,k?(b=k,k=null):(h=f.yyleng,a=f.yytext,c=f.yylineno,v=f.yylloc,l>0&&l--);break;case 2:if(F=this.productions_[T[1]][1],x.$=r[r.length-F],x._$={first_line:s[s.length-(F||1)].first_line,last_line:s[s.length-1].last_line,first_column:s[s.length-(F||1)].first_column,last_column:s[s.length-1].last_column},y&&(x._$.range=[s[s.length-(F||1)].range[0],s[s.length-1].range[1]]),C=this.performAction.apply(x,[a,h,c,m.yy,T[1],r,s].concat(d)),C!==void 0)return C;F&&(i=i.slice(0,2*-1*F),r=r.slice(0,-1*F),s=s.slice(0,-1*F)),i.push(this.productions_[T[1]][0]),r.push(x.$),s.push(x._$),N=o[i[i.length-2]][i[i.length-1]],i.push(N);break;case 3:return!0}}return!0}};return e.prototype=gn,gn.Parser=e,new e}();return require!==void 0&&e!==void 0&&(e.parser=n,e.Parser=n.Parser,e.parse=function(){return n.parse.apply(n,arguments)},e.main=function(t){t[1]||(console.log("Usage: "+t[0]+" FILE"),process.exit(1));var n=require("fs").readFileSync(require("path").normalize(t[1]),"utf8");return e.parser.parse(n)},t!==void 0&&require.main===t&&e.main(process.argv.slice(1))),t.exports}(),require["./scope"]=function(){var e={},t={exports:e};return function(){var t,n=[].indexOf||function(e){for(var t=0,n=this.length;n>t;t++)if(t in this&&this[t]===e)return t;return-1};e.Scope=t=function(){function e(e,t,n,i){var r,s;this.parent=e,this.expressions=t,this.method=n,this.referencedVars=i,this.variables=[{name:"arguments",type:"arguments"}],this.positions={},this.parent||(this.utilities={}),this.root=null!=(r=null!=(s=this.parent)?s.root:void 0)?r:this}return e.prototype.add=function(e,t,n){return this.shared&&!n?this.parent.add(e,t,n):Object.prototype.hasOwnProperty.call(this.positions,e)?this.variables[this.positions[e]].type=t:this.positions[e]=this.variables.push({name:e,type:t})-1},e.prototype.namedMethod=function(){var e;return(null!=(e=this.method)?e.name:void 0)||!this.parent?this.method:this.parent.namedMethod()},e.prototype.find=function(e){return this.check(e)?!0:(this.add(e,"var"),!1)},e.prototype.parameter=function(e){return this.shared&&this.parent.check(e,!0)?void 0:this.add(e,"param")},e.prototype.check=function(e){var t;return!!(this.type(e)||(null!=(t=this.parent)?t.check(e):void 0))},e.prototype.temporary=function(e,t,n){return null==n&&(n=!1),n?(t+parseInt(e,36)).toString(36).replace(/\d/g,"a"):e+(t||"")},e.prototype.type=function(e){var t,n,i,r;for(i=this.variables,t=0,n=i.length;n>t;t++)if(r=i[t],r.name===e)return r.type;return null},e.prototype.freeVariable=function(e,t){var i,r,s;for(null==t&&(t={}),i=0;;){if(s=this.temporary(e,i,t.single),!(this.check(s)||n.call(this.root.referencedVars,s)>=0))break;i++}return(null!=(r=t.reserve)?r:!0)&&this.add(s,"var",!0),s},e.prototype.assign=function(e,t){return this.add(e,{value:t,assigned:!0},!0),this.hasAssignments=!0},e.prototype.hasDeclarations=function(){return!!this.declaredVariables().length},e.prototype.declaredVariables=function(){var e;return function(){var t,n,i,r;for(i=this.variables,r=[],t=0,n=i.length;n>t;t++)e=i[t],"var"===e.type&&r.push(e.name);return r}.call(this).sort()},e.prototype.assignedVariables=function(){var e,t,n,i,r;for(n=this.variables,i=[],e=0,t=n.length;t>e;e++)r=n[e],r.type.assigned&&i.push(r.name+" = "+r.type.value);return i},e}()}.call(this),t.exports}(),require["./nodes"]=function(){var e={},t={exports:e};return function(){var t,n,i,r,s,o,a,c,h,l,u,p,d,f,m,g,v,y,b,k,w,T,C,E,F,N,L,x,S,D,R,A,I,_,O,$,j,M,B,V,P,U,G,H,q,X,W,Y,K,z,J,Q,Z,et,tt,nt,it,rt,st,ot,at,ct,ht,lt,ut,pt,dt,ft,mt,gt,vt,yt,bt,kt=function(e,t){function n(){this.constructor=e}for(var i in t)wt.call(t,i)&&(e[i]=t[i]);return n.prototype=t.prototype,e.prototype=new n,e.__super__=t.prototype,e},wt={}.hasOwnProperty,Tt=[].indexOf||function(e){for(var t=0,n=this.length;n>t;t++)if(t in this&&this[t]===e)return t;return-1},Ct=[].slice;Error.stackTraceLimit=1/0,P=require("./scope").Scope,dt=require("./lexer"),$=dt.RESERVED,V=dt.STRICT_PROSCRIBED,ft=require("./helpers"),et=ft.compact,rt=ft.flatten,it=ft.extend,lt=ft.merge,tt=ft.del,gt=ft.starts,nt=ft.ends,mt=ft.some,Z=ft.addLocationDataFn,ht=ft.locationDataToString,vt=ft.throwSyntaxError,e.extend=it,e.addLocationDataFn=Z,Q=function(){return!0},D=function(){return!1},X=function(){return this},S=function(){return this.negated=!this.negated,this},e.CodeFragment=h=function(){function e(e,t){var n;this.code=""+t,this.locationData=null!=e?e.locationData:void 0,this.type=(null!=e?null!=(n=e.constructor)?n.name:void 0:void 0)||"unknown"}return e.prototype.toString=function(){return""+this.code+(this.locationData?": "+ht(this.locationData):"")},e}(),st=function(e){var t;return function(){var n,i,r;for(r=[],n=0,i=e.length;i>n;n++)t=e[n],r.push(t.code);return r}().join("")},e.Base=r=function(){function e(){}return e.prototype.compile=function(e,t){return st(this.compileToFragments(e,t))},e.prototype.compileToFragments=function(e,t){var n;return e=it({},e),t&&(e.level=t),n=this.unfoldSoak(e)||this,n.tab=e.indent,e.level!==L&&n.isStatement(e)?n.compileClosure(e):n.compileNode(e)},e.prototype.compileClosure=function(e){var n,i,r,a,h,l;return(a=this.jumps())&&a.error("cannot use a pure statement in an expression"),e.sharedScope=!0,r=new c([],s.wrap([this])),n=[],((i=this.contains(at))||this.contains(ct))&&(n=[new x("this")],i?(h="apply",n.push(new x("arguments"))):h="call",r=new z(r,[new t(new x(h))])),l=new o(r,n).compileNode(e),r.isGenerator&&(l.unshift(this.makeCode("(yield* ")),l.push(this.makeCode(")"))),l},e.prototype.cache=function(e,t,n){var r,s,o;return r=null!=n?n(this):this.isComplex(),r?(s=new x(e.scope.freeVariable("ref")),o=new i(s,this),t?[o.compileToFragments(e,t),[this.makeCode(s.value)]]:[o,s]):(s=t?this.compileToFragments(e,t):this,[s,s])},e.prototype.cacheToCodeFragments=function(e){return[st(e[0]),st(e[1])]},e.prototype.makeReturn=function(e){var t;return t=this.unwrapAll(),e?new o(new x(e+".push"),[t]):new M(t)},e.prototype.contains=function(e){var t;return t=void 0,this.traverseChildren(!1,function(n){return e(n)?(t=n,!1):void 0}),t},e.prototype.lastNonComment=function(e){var t;for(t=e.length;t--;)if(!(e[t]instanceof l))return e[t];return null},e.prototype.toString=function(e,t){var n;return null==e&&(e=""),null==t&&(t=this.constructor.name),n="\n"+e+t,this.soak&&(n+="?"),this.eachChild(function(t){return n+=t.toString(e+q)}),n},e.prototype.eachChild=function(e){var t,n,i,r,s,o,a,c;if(!this.children)return this;for(a=this.children,i=0,s=a.length;s>i;i++)if(t=a[i],this[t])for(c=rt([this[t]]),r=0,o=c.length;o>r;r++)if(n=c[r],e(n)===!1)return this;return this},e.prototype.traverseChildren=function(e,t){return this.eachChild(function(n){var i;return i=t(n),i!==!1?n.traverseChildren(e,t):void 0})},e.prototype.invert=function(){return new I("!",this)},e.prototype.unwrapAll=function(){var e;for(e=this;e!==(e=e.unwrap()););return e},e.prototype.children=[],e.prototype.isStatement=D,e.prototype.jumps=D,e.prototype.isComplex=Q,e.prototype.isChainable=D,e.prototype.isAssignable=D,e.prototype.unwrap=X,e.prototype.unfoldSoak=D,e.prototype.assigns=D,e.prototype.updateLocationDataIfMissing=function(e){return this.locationData?this:(this.locationData=e,this.eachChild(function(t){return t.updateLocationDataIfMissing(e)}))},e.prototype.error=function(e){return vt(e,this.locationData)},e.prototype.makeCode=function(e){return new h(this,e)},e.prototype.wrapInBraces=function(e){return[].concat(this.makeCode("("),e,this.makeCode(")"))},e.prototype.joinFragmentArrays=function(e,t){var n,i,r,s,o;for(n=[],r=s=0,o=e.length;o>s;r=++s)i=e[r],r&&n.push(this.makeCode(t)),n=n.concat(i);return n},e}(),e.Block=s=function(e){function t(e){this.expressions=et(rt(e||[]))}return kt(t,e),t.prototype.children=["expressions"],t.prototype.push=function(e){return this.expressions.push(e),this},t.prototype.pop=function(){return this.expressions.pop()},t.prototype.unshift=function(e){return this.expressions.unshift(e),this},t.prototype.unwrap=function(){return 1===this.expressions.length?this.expressions[0]:this},t.prototype.isEmpty=function(){return!this.expressions.length},t.prototype.isStatement=function(e){var t,n,i,r;for(r=this.expressions,n=0,i=r.length;i>n;n++)if(t=r[n],t.isStatement(e))return!0;return!1},t.prototype.jumps=function(e){var t,n,i,r,s;for(s=this.expressions,n=0,r=s.length;r>n;n++)if(t=s[n],i=t.jumps(e))return i},t.prototype.makeReturn=function(e){var t,n;for(n=this.expressions.length;n--;)if(t=this.expressions[n],!(t instanceof l)){this.expressions[n]=t.makeReturn(e),t instanceof M&&!t.expression&&this.expressions.splice(n,1);break}return this},t.prototype.compileToFragments=function(e,n){return null==e&&(e={}),e.scope?t.__super__.compileToFragments.call(this,e,n):this.compileRoot(e)},t.prototype.compileNode=function(e){var n,i,r,s,o,a,c,h,l;for(this.tab=e.indent,l=e.level===L,i=[],h=this.expressions,s=o=0,a=h.length;a>o;s=++o)c=h[s],c=c.unwrapAll(),c=c.unfoldSoak(e)||c,c instanceof t?i.push(c.compileNode(e)):l?(c.front=!0,r=c.compileToFragments(e),c.isStatement(e)||(r.unshift(this.makeCode(""+this.tab)),r.push(this.makeCode(";"))),i.push(r)):i.push(c.compileToFragments(e,E));return l?this.spaced?[].concat(this.joinFragmentArrays(i,"\n\n"),this.makeCode("\n")):this.joinFragmentArrays(i,"\n"):(n=i.length?this.joinFragmentArrays(i,", "):[this.makeCode("void 0")],i.length>1&&e.level>=E?this.wrapInBraces(n):n)},t.prototype.compileRoot=function(e){var t,n,i,r,s,o,a,c,h,u,p;for(e.indent=e.bare?"":q,e.level=L,this.spaced=!0,e.scope=new P(null,this,null,null!=(h=e.referencedVars)?h:[]),u=e.locals||[],r=0,s=u.length;s>r;r++)o=u[r],e.scope.parameter(o);return a=[],e.bare||(c=function(){var e,n,r,s;for(r=this.expressions,s=[],i=e=0,n=r.length;n>e&&(t=r[i],t.unwrap()instanceof l);i=++e)s.push(t);return s}.call(this),p=this.expressions.slice(c.length),this.expressions=c,c.length&&(a=this.compileNode(lt(e,{indent:""})),a.push(this.makeCode("\n"))),this.expressions=p),n=this.compileWithDeclarations(e),e.bare?n:[].concat(a,this.makeCode("(function() {\n"),n,this.makeCode("\n}).call(this);\n"))},t.prototype.compileWithDeclarations=function(e){var t,n,i,r,s,o,a,c,h,u,p,d,f,m;for(r=[],c=[],h=this.expressions,s=o=0,a=h.length;a>o&&(i=h[s],i=i.unwrap(),i instanceof l||i instanceof x);s=++o);return e=lt(e,{level:L}),s&&(d=this.expressions.splice(s,9e9),u=[this.spaced,!1],m=u[0],this.spaced=u[1],p=[this.compileNode(e),m],r=p[0],this.spaced=p[1],this.expressions=d),c=this.compileNode(e),f=e.scope,f.expressions===this&&(n=e.scope.hasDeclarations(),t=f.hasAssignments,n||t?(s&&r.push(this.makeCode("\n")),r.push(this.makeCode(this.tab+"var ")),n&&r.push(this.makeCode(f.declaredVariables().join(", "))),t&&(n&&r.push(this.makeCode(",\n"+(this.tab+q))),r.push(this.makeCode(f.assignedVariables().join(",\n"+(this.tab+q))))),r.push(this.makeCode(";\n"+(this.spaced?"\n":"")))):r.length&&c.length&&r.push(this.makeCode("\n"))),r.concat(c)},t.wrap=function(e){return 1===e.length&&e[0]instanceof t?e[0]:new t(e)},t}(r),e.Literal=x=function(e){function t(e){this.value=e}return kt(t,e),t.prototype.makeReturn=function(){return this.isStatement()?this:t.__super__.makeReturn.apply(this,arguments)},t.prototype.isAssignable=function(){return g.test(this.value)},t.prototype.isStatement=function(){var e;return"break"===(e=this.value)||"continue"===e||"debugger"===e},t.prototype.isComplex=D,t.prototype.assigns=function(e){return e===this.value},t.prototype.jumps=function(e){return"break"!==this.value||(null!=e?e.loop:void 0)||(null!=e?e.block:void 0)?"continue"!==this.value||(null!=e?e.loop:void 0)?void 0:this:this},t.prototype.compileNode=function(e){var t,n,i;return n="this"===this.value?(null!=(i=e.scope.method)?i.bound:void 0)?e.scope.method.context:this.value:this.value.reserved?'"'+this.value+'"':this.value,t=this.isStatement()?""+this.tab+n+";":n,[this.makeCode(t)]},t.prototype.toString=function(){return' "'+this.value+'"'},t}(r),e.Undefined=function(e){function t(){return t.__super__.constructor.apply(this,arguments)}return kt(t,e),t.prototype.isAssignable=D,t.prototype.isComplex=D,t.prototype.compileNode=function(e){return[this.makeCode(e.level>=T?"(void 0)":"void 0")]},t}(r),e.Null=function(e){function t(){return t.__super__.constructor.apply(this,arguments)}return kt(t,e),t.prototype.isAssignable=D,t.prototype.isComplex=D,t.prototype.compileNode=function(){return[this.makeCode("null")]},t}(r),e.Bool=function(e){function t(e){this.val=e}return kt(t,e),t.prototype.isAssignable=D,t.prototype.isComplex=D,t.prototype.compileNode=function(){return[this.makeCode(this.val)]},t}(r),e.Return=M=function(e){function t(e){this.expression=e}return kt(t,e),t.prototype.children=["expression"],t.prototype.isStatement=Q,t.prototype.makeReturn=X,t.prototype.jumps=X,t.prototype.compileToFragments=function(e,n){var i,r;return i=null!=(r=this.expression)?r.makeReturn():void 0,!i||i instanceof t?t.__super__.compileToFragments.call(this,e,n):i.compileToFragments(e,n)},t.prototype.compileNode=function(e){var t,n,i;return t=[],n=null!=(i=this.expression)?"function"==typeof i.isYieldReturn?i.isYieldReturn():void 0:void 0,n||t.push(this.makeCode(this.tab+("return"+(this.expression?" ":"")))),this.expression&&(t=t.concat(this.expression.compileToFragments(e,N))),n||t.push(this.makeCode(";")),t},t}(r),e.Value=z=function(e){function t(e,n,i){return!n&&e instanceof t?e:(this.base=e,this.properties=n||[],i&&(this[i]=!0),this)}return kt(t,e),t.prototype.children=["base","properties"],t.prototype.add=function(e){return this.properties=this.properties.concat(e),this},t.prototype.hasProperties=function(){return!!this.properties.length},t.prototype.bareLiteral=function(e){return!this.properties.length&&this.base instanceof e},t.prototype.isArray=function(){return this.bareLiteral(n)},t.prototype.isRange=function(){return this.bareLiteral(j)},t.prototype.isComplex=function(){return this.hasProperties()||this.base.isComplex()},t.prototype.isAssignable=function(){return this.hasProperties()||this.base.isAssignable()},t.prototype.isSimpleNumber=function(){return this.bareLiteral(x)&&B.test(this.base.value)},t.prototype.isString=function(){return this.bareLiteral(x)&&y.test(this.base.value)},t.prototype.isRegex=function(){return this.bareLiteral(x)&&v.test(this.base.value)},t.prototype.isAtomic=function(){var e,t,n,i;for(i=this.properties.concat(this.base),e=0,t=i.length;t>e;e++)if(n=i[e],n.soak||n instanceof o)return!1;return!0},t.prototype.isNotCallable=function(){return this.isSimpleNumber()||this.isString()||this.isRegex()||this.isArray()||this.isRange()||this.isSplice()||this.isObject()},t.prototype.isStatement=function(e){return!this.properties.length&&this.base.isStatement(e)},t.prototype.assigns=function(e){return!this.properties.length&&this.base.assigns(e)},t.prototype.jumps=function(e){return!this.properties.length&&this.base.jumps(e)},t.prototype.isObject=function(e){return this.properties.length?!1:this.base instanceof A&&(!e||this.base.generated)},t.prototype.isSplice=function(){var e,t;return t=this.properties,e=t[t.length-1],e instanceof U},t.prototype.looksStatic=function(e){var t;return this.base.value===e&&1===this.properties.length&&"prototype"!==(null!=(t=this.properties[0].name)?t.value:void 0)},t.prototype.unwrap=function(){return this.properties.length?this:this.base},t.prototype.cacheReference=function(e){var n,r,s,o,a;return a=this.properties,s=a[a.length-1],2>this.properties.length&&!this.base.isComplex()&&!(null!=s?s.isComplex():void 0)?[this,this]:(n=new t(this.base,this.properties.slice(0,-1)),n.isComplex()&&(r=new x(e.scope.freeVariable("base")),n=new t(new O(new i(r,n)))),s?(s.isComplex()&&(o=new x(e.scope.freeVariable("name")),s=new w(new i(o,s.index)),o=new w(o)),[n.add(s),new t(r||n.base,[o||s])]):[n,r])},t.prototype.compileNode=function(e){var t,n,i,r,s;for(this.base.front=this.front,s=this.properties,t=this.base.compileToFragments(e,s.length?T:null),(this.base instanceof O||s.length)&&B.test(st(t))&&t.push(this.makeCode(".")),n=0,i=s.length;i>n;n++)r=s[n],t.push.apply(t,r.compileToFragments(e));return t},t.prototype.unfoldSoak=function(e){return null!=this.unfoldedSoak?this.unfoldedSoak:this.unfoldedSoak=function(n){return function(){var r,s,o,a,c,h,l,p,d,f;if(o=n.base.unfoldSoak(e))return(p=o.body.properties).push.apply(p,n.properties),o;for(d=n.properties,s=a=0,c=d.length;c>a;s=++a)if(h=d[s],h.soak)return h.soak=!1,r=new t(n.base,n.properties.slice(0,s)),f=new t(n.base,n.properties.slice(s)),r.isComplex()&&(l=new x(e.scope.freeVariable("ref")),r=new O(new i(l,r)),f.base=l),new b(new u(r),f,{soak:!0});return!1}}(this)()},t}(r),e.Comment=l=function(e){function t(e){this.comment=e}return kt(t,e),t.prototype.isStatement=Q,t.prototype.makeReturn=X,t.prototype.compileNode=function(e,t){var n,i;return i=this.comment.replace(/^(\s*)# /gm,"$1 * "),n="/*"+ut(i,this.tab)+(Tt.call(i,"\n")>=0?"\n"+this.tab:"")+" */",(t||e.level)===L&&(n=e.indent+n),[this.makeCode("\n"),this.makeCode(n)]},t}(r),e.Call=o=function(e){function n(e,t,n){this.args=null!=t?t:[],this.soak=n,this.isNew=!1,this.isSuper="super"===e,this.variable=this.isSuper?null:e,e instanceof z&&e.isNotCallable()&&e.error("literal is not a function")}return kt(n,e),n.prototype.children=["variable","args"],n.prototype.newInstance=function(){var e,t;return e=(null!=(t=this.variable)?t.base:void 0)||this.variable,e instanceof n&&!e.isNew?e.newInstance():this.isNew=!0,this},n.prototype.superReference=function(e){var n,r,s,o,a,c,h,l;return a=e.scope.namedMethod(),(null!=a?a.klass:void 0)?(o=a.klass,c=a.name,l=a.variable,o.isComplex()&&(s=new x(e.scope.parent.freeVariable("base")),r=new z(new O(new i(s,o))),l.base=r,l.properties.splice(0,o.properties.length)),(c.isComplex()||c instanceof w&&c.index.isAssignable())&&(h=new x(e.scope.parent.freeVariable("name")),c=new w(new i(h,c.index)),l.properties.pop(),l.properties.push(c)),n=[new t(new x("__super__"))],a["static"]&&n.push(new t(new x("constructor"))),n.push(null!=h?new w(h):c),new z(null!=s?s:o,n).compile(e)):(null!=a?a.ctor:void 0)?a.name+".__super__.constructor":this.error("cannot call super outside of an instance method.")},n.prototype.superThis=function(e){var t;return t=e.scope.method,t&&!t.klass&&t.context||"this"},n.prototype.unfoldSoak=function(e){var t,i,r,s,o,a,c,h,l;if(this.soak){if(this.variable){if(i=yt(e,this,"variable"))return i;c=new z(this.variable).cacheReference(e),s=c[0],l=c[1]}else s=new x(this.superReference(e)),l=new z(s);return l=new n(l,this.args),l.isNew=this.isNew,s=new x("typeof "+s.compile(e)+' === "function"'),new b(s,new z(l),{soak:!0})}for(t=this,a=[];;)if(t.variable instanceof n)a.push(t),t=t.variable;else{if(!(t.variable instanceof z))break;if(a.push(t),!((t=t.variable.base)instanceof n))break}for(h=a.reverse(),r=0,o=h.length;o>r;r++)t=h[r],i&&(t.variable instanceof n?t.variable=i:t.variable.base=i),i=yt(e,t,"variable");return i},n.prototype.compileNode=function(e){var t,n,i,r,s,o,a,c,h,l;if(null!=(h=this.variable)&&(h.front=this.front),r=G.compileSplattedArray(e,this.args,!0),r.length)return this.compileSplat(e,r);for(i=[],l=this.args,n=o=0,a=l.length;a>o;n=++o)t=l[n],n&&i.push(this.makeCode(", ")),i.push.apply(i,t.compileToFragments(e,E));return s=[],this.isSuper?(c=this.superReference(e)+(".call("+this.superThis(e)),i.length&&(c+=", "),s.push(this.makeCode(c))):(this.isNew&&s.push(this.makeCode("new ")),s.push.apply(s,this.variable.compileToFragments(e,T)),s.push(this.makeCode("("))),s.push.apply(s,i),s.push(this.makeCode(")")),s},n.prototype.compileSplat=function(e,t){var n,i,r,s,o,a;return this.isSuper?[].concat(this.makeCode(this.superReference(e)+".apply("+this.superThis(e)+", "),t,this.makeCode(")")):this.isNew?(s=this.tab+q,[].concat(this.makeCode("(function(func, args, ctor) {\n"+s+"ctor.prototype = func.prototype;\n"+s+"var child = new ctor, result = func.apply(child, args);\n"+s+"return Object(result) === result ? result : child;\n"+this.tab+"})("),this.variable.compileToFragments(e,E),this.makeCode(", "),t,this.makeCode(", function(){})"))):(n=[],i=new z(this.variable),(o=i.properties.pop())&&i.isComplex()?(a=e.scope.freeVariable("ref"),n=n.concat(this.makeCode("("+a+" = "),i.compileToFragments(e,E),this.makeCode(")"),o.compileToFragments(e))):(r=i.compileToFragments(e,T),B.test(st(r))&&(r=this.wrapInBraces(r)),o?(a=st(r),r.push.apply(r,o.compileToFragments(e))):a="null",n=n.concat(r)),n=n.concat(this.makeCode(".apply("+a+", "),t,this.makeCode(")")))},n}(r),e.Extends=d=function(e){function t(e,t){this.child=e,this.parent=t}return kt(t,e),t.prototype.children=["child","parent"],t.prototype.compileToFragments=function(e){return new o(new z(new x(bt("extend",e))),[this.child,this.parent]).compileToFragments(e)},t}(r),e.Access=t=function(e){function t(e,t){this.name=e,this.name.asKey=!0,this.soak="soak"===t}return kt(t,e),t.prototype.children=["name"],t.prototype.compileToFragments=function(e){var t;return t=this.name.compileToFragments(e),g.test(st(t))?t.unshift(this.makeCode(".")):(t.unshift(this.makeCode("[")),t.push(this.makeCode("]"))),t},t.prototype.isComplex=D,t}(r),e.Index=w=function(e){function t(e){this.index=e}return kt(t,e),t.prototype.children=["index"],t.prototype.compileToFragments=function(e){return[].concat(this.makeCode("["),this.index.compileToFragments(e,N),this.makeCode("]"))},t.prototype.isComplex=function(){return this.index.isComplex()},t}(r),e.Range=j=function(e){function t(e,t,n){this.from=e,this.to=t,this.exclusive="exclusive"===n,this.equals=this.exclusive?"":"="}return kt(t,e),t.prototype.children=["from","to"],t.prototype.compileVariables=function(e){var t,n,i,r,s,o;return e=lt(e,{top:!0}),t=tt(e,"isComplex"),n=this.cacheToCodeFragments(this.from.cache(e,E,t)),this.fromC=n[0],this.fromVar=n[1],i=this.cacheToCodeFragments(this.to.cache(e,E,t)),this.toC=i[0],this.toVar=i[1],(o=tt(e,"step"))&&(r=this.cacheToCodeFragments(o.cache(e,E,t)),this.step=r[0],this.stepVar=r[1]),s=[this.fromVar.match(R),this.toVar.match(R)],this.fromNum=s[0],this.toNum=s[1],this.stepVar?this.stepNum=this.stepVar.match(R):void 0},t.prototype.compileNode=function(e){var t,n,i,r,s,o,a,c,h,l,u,p,d,f;return this.fromVar||this.compileVariables(e),e.index?(a=this.fromNum&&this.toNum,s=tt(e,"index"),o=tt(e,"name"),h=o&&o!==s,f=s+" = "+this.fromC,this.toC!==this.toVar&&(f+=", "+this.toC),this.step!==this.stepVar&&(f+=", "+this.step),l=[s+" <"+this.equals,s+" >"+this.equals],c=l[0],r=l[1],n=this.stepNum?pt(this.stepNum[0])>0?c+" "+this.toVar:r+" "+this.toVar:a?(u=[pt(this.fromNum[0]),pt(this.toNum[0])],i=u[0],d=u[1],u,d>=i?c+" "+d:r+" "+d):(t=this.stepVar?this.stepVar+" > 0":this.fromVar+" <= "+this.toVar,t+" ? "+c+" "+this.toVar+" : "+r+" "+this.toVar),p=this.stepVar?s+" += "+this.stepVar:a?h?d>=i?"++"+s:"--"+s:d>=i?s+"++":s+"--":h?t+" ? ++"+s+" : --"+s:t+" ? "+s+"++ : "+s+"--",h&&(f=o+" = "+f),h&&(p=o+" = "+p),[this.makeCode(f+"; "+n+"; "+p)]):this.compileArray(e)},t.prototype.compileArray=function(e){var t,n,i,r,s,o,a,c,h,l,u,p,d;return this.fromNum&&this.toNum&&20>=Math.abs(this.fromNum-this.toNum)?(h=function(){p=[];for(var e=l=+this.fromNum,t=+this.toNum;t>=l?t>=e:e>=t;t>=l?e++:e--)p.push(e);return p}.apply(this),this.exclusive&&h.pop(),[this.makeCode("["+h.join(", ")+"]")]):(o=this.tab+q,s=e.scope.freeVariable("i",{single:!0}),u=e.scope.freeVariable("results"),c="\n"+o+u+" = [];",this.fromNum&&this.toNum?(e.index=s,n=st(this.compileNode(e))):(d=s+" = "+this.fromC+(this.toC!==this.toVar?", "+this.toC:""),i=this.fromVar+" <= "+this.toVar,n="var "+d+"; "+i+" ? "+s+" <"+this.equals+" "+this.toVar+" : "+s+" >"+this.equals+" "+this.toVar+"; "+i+" ? "+s+"++ : "+s+"--"),a="{ "+u+".push("+s+"); }\n"+o+"return "+u+";\n"+e.indent,r=function(e){return null!=e?e.contains(at):void 0},(r(this.from)||r(this.to))&&(t=", arguments"),[this.makeCode("(function() {"+c+"\n"+o+"for ("+n+")"+a+"}).apply(this"+(null!=t?t:"")+")")])},t}(r),e.Slice=U=function(e){function t(e){this.range=e,t.__super__.constructor.call(this)}return kt(t,e),t.prototype.children=["range"],t.prototype.compileNode=function(e){var t,n,i,r,s,o,a;return s=this.range,o=s.to,i=s.from,r=i&&i.compileToFragments(e,N)||[this.makeCode("0")],o&&(t=o.compileToFragments(e,N),n=st(t),(this.range.exclusive||-1!==+n)&&(a=", "+(this.range.exclusive?n:B.test(n)?""+(+n+1):(t=o.compileToFragments(e,T),"+"+st(t)+" + 1 || 9e9")))),[this.makeCode(".slice("+st(r)+(a||"")+")")]},t}(r),e.Obj=A=function(e){function n(e,t){this.generated=null!=t?t:!1,this.objects=this.properties=e||[]}return kt(n,e),n.prototype.children=["properties"],n.prototype.compileNode=function(e){var n,r,s,o,a,c,h,u,p,d,f,m,g,v,y,b,k,w,T,C,E;if(T=this.properties,this.generated)for(h=0,g=T.length;g>h;h++)b=T[h],b instanceof z&&b.error("cannot have an implicit value in an implicit object");for(r=p=0,v=T.length;v>p&&(w=T[r],!((w.variable||w).base instanceof O));r=++p);for(s=T.length>r,a=e.indent+=q,m=this.lastNonComment(this.properties),n=[],s&&(k=e.scope.freeVariable("obj"),n.push(this.makeCode("(\n"+a+k+" = "))),n.push(this.makeCode("{"+(0===T.length||0===r?"}":"\n"))),o=f=0,y=T.length;y>f;o=++f)w=T[o],o===r&&(0!==o&&n.push(this.makeCode("\n"+a+"}")),n.push(this.makeCode(",\n"))),u=o===T.length-1||o===r-1?"":w===m||w instanceof l?"\n":",\n",c=w instanceof l?"":a,s&&r>o&&(c+=q),w instanceof i&&w.variable instanceof z&&w.variable.hasProperties()&&w.variable.error("Invalid object key"),w instanceof z&&w["this"]&&(w=new i(w.properties[0].name,w,"object")),w instanceof l||(r>o?(w instanceof i||(w=new i(w,w,"object")),(w.variable.base||w.variable).asKey=!0):(w instanceof i?(d=w.variable,E=w.value):(C=w.base.cache(e),d=C[0],E=C[1]),w=new i(new z(new x(k),[new t(d)]),E))),c&&n.push(this.makeCode(c)),n.push.apply(n,w.compileToFragments(e,L)),u&&n.push(this.makeCode(u));return s?n.push(this.makeCode(",\n"+a+k+"\n"+this.tab+")")):0!==T.length&&n.push(this.makeCode("\n"+this.tab+"}")),this.front&&!s?this.wrapInBraces(n):n},n.prototype.assigns=function(e){var t,n,i,r;for(r=this.properties,t=0,n=r.length;n>t;t++)if(i=r[t],i.assigns(e))return!0;return!1},n}(r),e.Arr=n=function(e){function t(e){this.objects=e||[]}return kt(t,e),t.prototype.children=["objects"],t.prototype.compileNode=function(e){var t,n,i,r,s,o,a;if(!this.objects.length)return[this.makeCode("[]")];if(e.indent+=q,t=G.compileSplattedArray(e,this.objects),t.length)return t;for(t=[],n=function(){var t,n,i,r;for(i=this.objects,r=[],t=0,n=i.length;n>t;t++)a=i[t],r.push(a.compileToFragments(e,E));return r}.call(this),r=s=0,o=n.length;o>s;r=++s)i=n[r],r&&t.push(this.makeCode(", ")),t.push.apply(t,i);return st(t).indexOf("\n")>=0?(t.unshift(this.makeCode("[\n"+e.indent)),t.push(this.makeCode("\n"+this.tab+"]"))):(t.unshift(this.makeCode("[")),t.push(this.makeCode("]"))),t},t.prototype.assigns=function(e){var t,n,i,r;for(r=this.objects,t=0,n=r.length;n>t;t++)if(i=r[t],i.assigns(e))return!0;return!1},t}(r),e.Class=a=function(e){function n(e,t,n){this.variable=e,this.parent=t,this.body=null!=n?n:new s,this.boundFuncs=[],this.body.classBody=!0}return kt(n,e),n.prototype.children=["variable","parent","body"],n.prototype.determineName=function(){var e,n,i;return this.variable?(n=this.variable.properties,i=n[n.length-1],e=i?i instanceof t&&i.name.value:this.variable.base.value,Tt.call(V,e)>=0&&this.variable.error("class variable name may not be "+e),e&&(e=g.test(e)&&e)):null},n.prototype.setContext=function(e){return this.body.traverseChildren(!1,function(t){return t.classBody?!1:t instanceof x&&"this"===t.value?t.value=e:t instanceof c&&t.bound?t.context=e:void 0})},n.prototype.addBoundFunctions=function(e){var n,i,r,s,o;for(o=this.boundFuncs,i=0,r=o.length;r>i;i++)n=o[i],s=new z(new x("this"),[new t(n)]).compile(e),this.ctor.body.unshift(new x(s+" = "+bt("bind",e)+"("+s+", this)"))},n.prototype.addProperties=function(e,n,r){var s,o,a,h,l,u;return u=e.base.properties.slice(0),h=function(){var e;for(e=[];o=u.shift();)o instanceof i&&(a=o.variable.base,delete o.context,l=o.value,"constructor"===a.value?(this.ctor&&o.error("cannot define more than one constructor in a class"),l.bound&&o.error("cannot define a constructor as a bound function"),l instanceof c?o=this.ctor=l:(this.externalCtor=r.classScope.freeVariable("class"),o=new i(new x(this.externalCtor),l))):o.variable["this"]?l["static"]=!0:(s=a.isComplex()?new w(a):new t(a),o.variable=new z(new x(n),[new t(new x("prototype")),s]),l instanceof c&&l.bound&&(this.boundFuncs.push(a),l.bound=!1))),e.push(o);return e}.call(this),et(h)},n.prototype.walkBody=function(e,t){return this.traverseChildren(!1,function(r){return function(o){var a,c,h,l,u,p,d;if(a=!0,o instanceof n)return!1;if(o instanceof s){for(d=c=o.expressions,h=l=0,u=d.length;u>l;h=++l)p=d[h],p instanceof i&&p.variable.looksStatic(e)?p.value["static"]=!0:p instanceof z&&p.isObject(!0)&&(a=!1,c[h]=r.addProperties(p,e,t));o.expressions=c=rt(c)}return a&&!(o instanceof n)}}(this))},n.prototype.hoistDirectivePrologue=function(){var e,t,n;for(t=0,e=this.body.expressions;(n=e[t])&&n instanceof l||n instanceof z&&n.isString();)++t;return this.directives=e.splice(0,t)},n.prototype.ensureConstructor=function(e){return this.ctor||(this.ctor=new c,this.externalCtor?this.ctor.body.push(new x(this.externalCtor+".apply(this, arguments)")):this.parent&&this.ctor.body.push(new x(e+".__super__.constructor.apply(this, arguments)")),this.ctor.body.makeReturn(),this.body.expressions.unshift(this.ctor)),this.ctor.ctor=this.ctor.name=e,this.ctor.klass=null,this.ctor.noReturn=!0},n.prototype.compileNode=function(e){var t,n,r,a,h,l,u,p,f;return(a=this.body.jumps())&&a.error("Class bodies cannot contain pure statements"),(n=this.body.contains(at))&&n.error("Class bodies shouldn't reference arguments"),u=this.determineName()||"_Class",u.reserved&&(u="_"+u),l=new x(u),r=new c([],s.wrap([this.body])),t=[],e.classScope=r.makeScope(e.scope),this.hoistDirectivePrologue(),this.setContext(u),this.walkBody(u,e),this.ensureConstructor(u),this.addBoundFunctions(e),this.body.spaced=!0,this.body.expressions.push(l),this.parent&&(f=new x(e.classScope.freeVariable("superClass",{reserve:!1})),this.body.expressions.unshift(new d(l,f)),r.params.push(new _(f)),t.push(this.parent)),(p=this.body.expressions).unshift.apply(p,this.directives),h=new O(new o(r,t)),this.variable&&(h=new i(this.variable,h)),h.compileToFragments(e)},n}(r),e.Assign=i=function(e){function n(e,t,n,i){var r,s,o;this.variable=e,this.value=t,this.context=n,this.param=i&&i.param,this.subpattern=i&&i.subpattern,o=s=this.variable.unwrapAll().value,r=Tt.call(V,o)>=0,r&&"object"!==this.context&&this.variable.error('variable name may not be "'+s+'"')}return kt(n,e),n.prototype.children=["variable","value"],n.prototype.isStatement=function(e){return(null!=e?e.level:void 0)===L&&null!=this.context&&Tt.call(this.context,"?")>=0
},n.prototype.assigns=function(e){return this["object"===this.context?"value":"variable"].assigns(e)},n.prototype.unfoldSoak=function(e){return yt(e,this,"variable")},n.prototype.compileNode=function(e){var t,n,i,r,s,o,a,h,l,u,p,d,f,m;if(i=this.variable instanceof z){if(this.variable.isArray()||this.variable.isObject())return this.compilePatternMatch(e);if(this.variable.isSplice())return this.compileSplice(e);if("||="===(h=this.context)||"&&="===h||"?="===h)return this.compileConditional(e);if("**="===(l=this.context)||"//="===l||"%%="===l)return this.compileSpecialMath(e)}return this.value instanceof c&&(this.value["static"]?(this.value.klass=this.variable.base,this.value.name=this.variable.properties[0],this.value.variable=this.variable):(null!=(u=this.variable.properties)?u.length:void 0)>=2&&(p=this.variable.properties,o=p.length>=3?Ct.call(p,0,r=p.length-2):(r=0,[]),a=p[r++],s=p[r++],"prototype"===(null!=(d=a.name)?d.value:void 0)&&(this.value.klass=new z(this.variable.base,o),this.value.name=s,this.value.variable=this.variable))),this.context||(m=this.variable.unwrapAll(),m.isAssignable()||this.variable.error('"'+this.variable.compile(e)+'" cannot be assigned'),("function"==typeof m.hasProperties?m.hasProperties():void 0)||(this.param?e.scope.add(m.value,"var"):e.scope.find(m.value))),f=this.value.compileToFragments(e,E),n=this.variable.compileToFragments(e,E),"object"===this.context?n.concat(this.makeCode(": "),f):(t=n.concat(this.makeCode(" "+(this.context||"=")+" "),f),E>=e.level?t:this.wrapInBraces(t))},n.prototype.compilePatternMatch=function(e){var i,r,s,o,a,c,h,l,u,d,f,m,v,y,b,k,T,C,N,S,D,R,A,I,_,j,M,B;if(I=e.level===L,j=this.value,y=this.variable.base.objects,!(b=y.length))return s=j.compileToFragments(e),e.level>=F?this.wrapInBraces(s):s;if(l=this.variable.isObject(),I&&1===b&&!((v=y[0])instanceof G))return v instanceof n?(T=v,C=T.variable,h=C.base,v=T.value):h=l?v["this"]?v.properties[0].name:v:new x(0),i=g.test(h.unwrap().value||0),j=new z(j),j.properties.push(new(i?t:w)(h)),N=v.unwrap().value,Tt.call($,N)>=0&&v.error("assignment to a reserved word: "+v.compile(e)),new n(v,j,null,{param:this.param}).compileToFragments(e,L);for(M=j.compileToFragments(e,E),B=st(M),r=[],o=!1,(!g.test(B)||this.variable.assigns(B))&&(r.push([this.makeCode((k=e.scope.freeVariable("ref"))+" = ")].concat(Ct.call(M))),M=[this.makeCode(k)],B=k),c=d=0,f=y.length;f>d;c=++d){if(v=y[c],h=c,l&&(v instanceof n?(S=v,D=S.variable,h=D.base,v=S.value):v.base instanceof O?(R=new z(v.unwrapAll()).cacheReference(e),v=R[0],h=R[1]):h=v["this"]?v.properties[0].name:v),!o&&v instanceof G)m=v.name.unwrap().value,v=v.unwrap(),_=b+" <= "+B+".length ? "+bt("slice",e)+".call("+B+", "+c,(A=b-c-1)?(u=e.scope.freeVariable("i",{single:!0}),_+=", "+u+" = "+B+".length - "+A+") : ("+u+" = "+c+", [])"):_+=") : []",_=new x(_),o=u+"++";else{if(!o&&v instanceof p){(A=b-c-1)&&(1===A?o=B+".length - 1":(u=e.scope.freeVariable("i",{single:!0}),_=new x(u+" = "+B+".length - "+A),o=u+"++",r.push(_.compileToFragments(e,E))));continue}m=v.unwrap().value,(v instanceof G||v instanceof p)&&v.error("multiple splats/expansions are disallowed in an assignment"),"number"==typeof h?(h=new x(o||h),i=!1):i=l&&g.test(h.unwrap().value||0),_=new z(new x(B),[new(i?t:w)(h)])}null!=m&&Tt.call($,m)>=0&&v.error("assignment to a reserved word: "+v.compile(e)),r.push(new n(v,_,null,{param:this.param,subpattern:!0}).compileToFragments(e,E))}return I||this.subpattern||r.push(M),a=this.joinFragmentArrays(r,", "),E>e.level?a:this.wrapInBraces(a)},n.prototype.compileConditional=function(e){var t,i,r,s;return r=this.variable.cacheReference(e),i=r[0],s=r[1],!i.properties.length&&i.base instanceof x&&"this"!==i.base.value&&!e.scope.check(i.base.value)&&this.variable.error('the variable "'+i.base.value+"\" can't be assigned with "+this.context+" because it has not been declared before"),Tt.call(this.context,"?")>=0?(e.isExistentialEquals=!0,new b(new u(i),s,{type:"if"}).addElse(new n(s,this.value,"=")).compileToFragments(e)):(t=new I(this.context.slice(0,-1),i,new n(s,this.value,"=")).compileToFragments(e),E>=e.level?t:this.wrapInBraces(t))},n.prototype.compileSpecialMath=function(e){var t,i,r;return i=this.variable.cacheReference(e),t=i[0],r=i[1],new n(t,new I(this.context.slice(0,-1),r,this.value)).compileToFragments(e)},n.prototype.compileSplice=function(e){var t,n,i,r,s,o,a,c,h,l,u,p;return a=this.variable.properties.pop().range,i=a.from,l=a.to,n=a.exclusive,o=this.variable.compile(e),i?(c=this.cacheToCodeFragments(i.cache(e,F)),r=c[0],s=c[1]):r=s="0",l?i instanceof z&&i.isSimpleNumber()&&l instanceof z&&l.isSimpleNumber()?(l=l.compile(e)-s,n||(l+=1)):(l=l.compile(e,T)+" - "+s,n||(l+=" + 1")):l="9e9",h=this.value.cache(e,E),u=h[0],p=h[1],t=[].concat(this.makeCode("[].splice.apply("+o+", ["+r+", "+l+"].concat("),u,this.makeCode(")), "),p),e.level>L?this.wrapInBraces(t):t},n}(r),e.Code=c=function(e){function t(e,t,n){this.params=e||[],this.body=t||new s,this.bound="boundfunc"===n,this.isGenerator=!!this.body.contains(function(e){var t;return e instanceof I&&("yield"===(t=e.operator)||"yield*"===t)})}return kt(t,e),t.prototype.children=["params","body"],t.prototype.isStatement=function(){return!!this.ctor},t.prototype.jumps=D,t.prototype.makeScope=function(e){return new P(e,this.body,this)},t.prototype.compileNode=function(e){var r,a,c,h,l,u,d,f,m,g,v,y,k,w,C,E,F,N,L,S,D,R,A,O,$,j,M,B,V,P,U,G,H;if(this.bound&&(null!=(A=e.scope.method)?A.bound:void 0)&&(this.context=e.scope.method.context),this.bound&&!this.context)return this.context="_this",H=new t([new _(new x(this.context))],new s([this])),a=new o(H,[new x("this")]),a.updateLocationDataIfMissing(this.locationData),a.compileNode(e);for(e.scope=tt(e,"classScope")||this.makeScope(e.scope),e.scope.shared=tt(e,"sharedScope"),e.indent+=q,delete e.bare,delete e.isExistentialEquals,L=[],h=[],O=this.params,u=0,m=O.length;m>u;u++)N=O[u],N instanceof p||e.scope.parameter(N.asReference(e));for($=this.params,d=0,g=$.length;g>d;d++)if(N=$[d],N.splat||N instanceof p){for(j=this.params,f=0,v=j.length;v>f;f++)F=j[f],F instanceof p||!F.name.value||e.scope.add(F.name.value,"var",!0);V=new i(new z(new n(function(){var t,n,i,r;for(i=this.params,r=[],n=0,t=i.length;t>n;n++)F=i[n],r.push(F.asReference(e));return r}.call(this))),new z(new x("arguments")));break}for(M=this.params,E=0,y=M.length;y>E;E++)N=M[E],N.isComplex()?(U=R=N.asReference(e),N.value&&(U=new I("?",R,N.value)),h.push(new i(new z(N.name),U,"=",{param:!0}))):(R=N,N.value&&(C=new x(R.name.value+" == null"),U=new i(new z(N.name),N.value,"="),h.push(new b(C,U)))),V||L.push(R);for(G=this.body.isEmpty(),V&&h.unshift(V),h.length&&(B=this.body.expressions).unshift.apply(B,h),l=S=0,k=L.length;k>S;l=++S)F=L[l],L[l]=F.compileToFragments(e),e.scope.parameter(st(L[l]));for(P=[],this.eachParamName(function(e,t){return Tt.call(P,e)>=0&&t.error("multiple parameters named "+e),P.push(e)}),G||this.noReturn||this.body.makeReturn(),c="function",this.isGenerator&&(c+="*"),this.ctor&&(c+=" "+this.name),c+="(",r=[this.makeCode(c)],l=D=0,w=L.length;w>D;l=++D)F=L[l],l&&r.push(this.makeCode(", ")),r.push.apply(r,F);return r.push(this.makeCode(") {")),this.body.isEmpty()||(r=r.concat(this.makeCode("\n"),this.body.compileWithDeclarations(e),this.makeCode("\n"+this.tab))),r.push(this.makeCode("}")),this.ctor?[this.makeCode(this.tab)].concat(Ct.call(r)):this.front||e.level>=T?this.wrapInBraces(r):r},t.prototype.eachParamName=function(e){var t,n,i,r,s;for(r=this.params,s=[],t=0,n=r.length;n>t;t++)i=r[t],s.push(i.eachName(e));return s},t.prototype.traverseChildren=function(e,n){return e?t.__super__.traverseChildren.call(this,e,n):void 0},t}(r),e.Param=_=function(e){function t(e,t,n){var i,r;this.name=e,this.value=t,this.splat=n,r=i=this.name.unwrapAll().value,Tt.call(V,r)>=0&&this.name.error('parameter name "'+i+'" is not allowed')}return kt(t,e),t.prototype.children=["name","value"],t.prototype.compileToFragments=function(e){return this.name.compileToFragments(e,E)},t.prototype.asReference=function(e){var t,n;return this.reference?this.reference:(n=this.name,n["this"]?(t=n.properties[0].name.value,t.reserved&&(t="_"+t),n=new x(e.scope.freeVariable(t))):n.isComplex()&&(n=new x(e.scope.freeVariable("arg"))),n=new z(n),this.splat&&(n=new G(n)),n.updateLocationDataIfMissing(this.locationData),this.reference=n)},t.prototype.isComplex=function(){return this.name.isComplex()},t.prototype.eachName=function(e,t){var n,r,s,o,a,c;if(null==t&&(t=this.name),n=function(t){return e("@"+t.properties[0].name.value,t)},t instanceof x)return e(t.value,t);if(t instanceof z)return n(t);for(c=t.objects,r=0,s=c.length;s>r;r++)a=c[r],a instanceof i?this.eachName(e,a.value.unwrap()):a instanceof G?(o=a.name.unwrap(),e(o.value,o)):a instanceof z?a.isArray()||a.isObject()?this.eachName(e,a.base):a["this"]?n(a):e(a.base.value,a.base):a instanceof p||a.error("illegal parameter "+a.compile())},t}(r),e.Splat=G=function(e){function t(e){this.name=e.compile?e:new x(e)}return kt(t,e),t.prototype.children=["name"],t.prototype.isAssignable=Q,t.prototype.assigns=function(e){return this.name.assigns(e)},t.prototype.compileToFragments=function(e){return this.name.compileToFragments(e)},t.prototype.unwrap=function(){return this.name},t.compileSplattedArray=function(e,n,i){var r,s,o,a,c,h,l,u,p,d,f;for(l=-1;(f=n[++l])&&!(f instanceof t););if(l>=n.length)return[];if(1===n.length)return f=n[0],c=f.compileToFragments(e,E),i?c:[].concat(f.makeCode(bt("slice",e)+".call("),c,f.makeCode(")"));for(r=n.slice(l),h=u=0,d=r.length;d>u;h=++u)f=r[h],o=f.compileToFragments(e,E),r[h]=f instanceof t?[].concat(f.makeCode(bt("slice",e)+".call("),o,f.makeCode(")")):[].concat(f.makeCode("["),o,f.makeCode("]"));return 0===l?(f=n[0],a=f.joinFragmentArrays(r.slice(1),", "),r[0].concat(f.makeCode(".concat("),a,f.makeCode(")"))):(s=function(){var t,i,r,s;for(r=n.slice(0,l),s=[],t=0,i=r.length;i>t;t++)f=r[t],s.push(f.compileToFragments(e,E));return s}(),s=n[0].joinFragmentArrays(s,", "),a=n[l].joinFragmentArrays(r,", "),p=n[n.length-1],[].concat(n[0].makeCode("["),s,n[l].makeCode("].concat("),a,p.makeCode(")")))},t}(r),e.Expansion=p=function(e){function t(){return t.__super__.constructor.apply(this,arguments)}return kt(t,e),t.prototype.isComplex=D,t.prototype.compileNode=function(){return this.error("Expansion must be used inside a destructuring assignment or parameter list")},t.prototype.asReference=function(){return this},t.prototype.eachName=function(){},t}(r),e.While=J=function(e){function t(e,t){this.condition=(null!=t?t.invert:void 0)?e.invert():e,this.guard=null!=t?t.guard:void 0}return kt(t,e),t.prototype.children=["condition","guard","body"],t.prototype.isStatement=Q,t.prototype.makeReturn=function(e){return e?t.__super__.makeReturn.apply(this,arguments):(this.returns=!this.jumps({loop:!0}),this)},t.prototype.addBody=function(e){return this.body=e,this},t.prototype.jumps=function(){var e,t,n,i,r;if(e=this.body.expressions,!e.length)return!1;for(t=0,i=e.length;i>t;t++)if(r=e[t],n=r.jumps({loop:!0}))return n;return!1},t.prototype.compileNode=function(e){var t,n,i,r;return e.indent+=q,r="",n=this.body,n.isEmpty()?n=this.makeCode(""):(this.returns&&(n.makeReturn(i=e.scope.freeVariable("results")),r=""+this.tab+i+" = [];\n"),this.guard&&(n.expressions.length>1?n.expressions.unshift(new b(new O(this.guard).invert(),new x("continue"))):this.guard&&(n=s.wrap([new b(this.guard,n)]))),n=[].concat(this.makeCode("\n"),n.compileToFragments(e,L),this.makeCode("\n"+this.tab))),t=[].concat(this.makeCode(r+this.tab+"while ("),this.condition.compileToFragments(e,N),this.makeCode(") {"),n,this.makeCode("}")),this.returns&&t.push(this.makeCode("\n"+this.tab+"return "+i+";")),t},t}(r),e.Op=I=function(e){function n(e,t,n,i){if("in"===e)return new k(t,n);if("do"===e)return this.generateDo(t);if("new"===e){if(t instanceof o&&!t["do"]&&!t.isNew)return t.newInstance();(t instanceof c&&t.bound||t["do"])&&(t=new O(t))}return this.operator=r[e]||e,this.first=t,this.second=n,this.flip=!!i,this}var r,s;return kt(n,e),r={"==":"===","!=":"!==",of:"in",yieldfrom:"yield*"},s={"!==":"===","===":"!=="},n.prototype.children=["first","second"],n.prototype.isSimpleNumber=D,n.prototype.isYield=function(){var e;return"yield"===(e=this.operator)||"yield*"===e},n.prototype.isYieldReturn=function(){return this.isYield()&&this.first instanceof M},n.prototype.isUnary=function(){return!this.second},n.prototype.isComplex=function(){var e;return!(this.isUnary()&&("+"===(e=this.operator)||"-"===e)&&this.first instanceof z&&this.first.isSimpleNumber())},n.prototype.isChainable=function(){var e;return"<"===(e=this.operator)||">"===e||">="===e||"<="===e||"==="===e||"!=="===e},n.prototype.invert=function(){var e,t,i,r,o;if(this.isChainable()&&this.first.isChainable()){for(e=!0,t=this;t&&t.operator;)e&&(e=t.operator in s),t=t.first;if(!e)return new O(this).invert();for(t=this;t&&t.operator;)t.invert=!t.invert,t.operator=s[t.operator],t=t.first;return this}return(r=s[this.operator])?(this.operator=r,this.first.unwrap()instanceof n&&this.first.invert(),this):this.second?new O(this).invert():"!"===this.operator&&(i=this.first.unwrap())instanceof n&&("!"===(o=i.operator)||"in"===o||"instanceof"===o)?i:new n("!",this)},n.prototype.unfoldSoak=function(e){var t;return("++"===(t=this.operator)||"--"===t||"delete"===t)&&yt(e,this,"first")},n.prototype.generateDo=function(e){var t,n,r,s,a,h,l,u;for(h=[],n=e instanceof i&&(l=e.value.unwrap())instanceof c?l:e,u=n.params||[],r=0,s=u.length;s>r;r++)a=u[r],a.value?(h.push(a.value),delete a.value):h.push(a);return t=new o(e,h),t["do"]=!0,t},n.prototype.compileNode=function(e){var t,n,i,r,s,o;if(n=this.isChainable()&&this.first.isChainable(),n||(this.first.front=this.front),"delete"===this.operator&&e.scope.check(this.first.unwrapAll().value)&&this.error("delete operand may not be argument or var"),("--"===(r=this.operator)||"++"===r)&&(s=this.first.unwrapAll().value,Tt.call(V,s)>=0)&&this.error('cannot increment/decrement "'+this.first.unwrapAll().value+'"'),this.isYield())return this.compileYield(e);if(this.isUnary())return this.compileUnary(e);if(n)return this.compileChain(e);switch(this.operator){case"?":return this.compileExistence(e);case"**":return this.compilePower(e);case"//":return this.compileFloorDivision(e);case"%%":return this.compileModulo(e);default:return i=this.first.compileToFragments(e,F),o=this.second.compileToFragments(e,F),t=[].concat(i,this.makeCode(" "+this.operator+" "),o),F>=e.level?t:this.wrapInBraces(t)}},n.prototype.compileChain=function(e){var t,n,i,r;return i=this.first.second.cache(e),this.first.second=i[0],r=i[1],n=this.first.compileToFragments(e,F),t=n.concat(this.makeCode(" "+(this.invert?"&&":"||")+" "),r.compileToFragments(e),this.makeCode(" "+this.operator+" "),this.second.compileToFragments(e,F)),this.wrapInBraces(t)},n.prototype.compileExistence=function(e){var t,n;return this.first.isComplex()?(n=new x(e.scope.freeVariable("ref")),t=new O(new i(n,this.first))):(t=this.first,n=t),new b(new u(t),n,{type:"if"}).addElse(this.second).compileToFragments(e)},n.prototype.compileUnary=function(e){var t,i,r;return i=[],t=this.operator,i.push([this.makeCode(t)]),"!"===t&&this.first instanceof u?(this.first.negated=!this.first.negated,this.first.compileToFragments(e)):e.level>=T?new O(this).compileToFragments(e):(r="+"===t||"-"===t,("new"===t||"typeof"===t||"delete"===t||r&&this.first instanceof n&&this.first.operator===t)&&i.push([this.makeCode(" ")]),(r&&this.first instanceof n||"new"===t&&this.first.isStatement(e))&&(this.first=new O(this.first)),i.push(this.first.compileToFragments(e,F)),this.flip&&i.reverse(),this.joinFragmentArrays(i,""))},n.prototype.compileYield=function(e){var t,n;return n=[],t=this.operator,null==e.scope.parent&&this.error("yield statements must occur within a function generator."),Tt.call(Object.keys(this.first),"expression")>=0&&!(this.first instanceof W)?this.isYieldReturn()?n.push(this.first.compileToFragments(e,L)):null!=this.first.expression&&n.push(this.first.expression.compileToFragments(e,F)):(n.push([this.makeCode("("+t+" ")]),n.push(this.first.compileToFragments(e,F)),n.push([this.makeCode(")")])),this.joinFragmentArrays(n,"")},n.prototype.compilePower=function(e){var n;return n=new z(new x("Math"),[new t(new x("pow"))]),new o(n,[this.first,this.second]).compileToFragments(e)},n.prototype.compileFloorDivision=function(e){var i,r;return r=new z(new x("Math"),[new t(new x("floor"))]),i=new n("/",this.first,this.second),new o(r,[i]).compileToFragments(e)},n.prototype.compileModulo=function(e){var t;return t=new z(new x(bt("modulo",e))),new o(t,[this.first,this.second]).compileToFragments(e)},n.prototype.toString=function(e){return n.__super__.toString.call(this,e,this.constructor.name+" "+this.operator)},n}(r),e.In=k=function(e){function t(e,t){this.object=e,this.array=t}return kt(t,e),t.prototype.children=["object","array"],t.prototype.invert=S,t.prototype.compileNode=function(e){var t,n,i,r,s;if(this.array instanceof z&&this.array.isArray()&&this.array.base.objects.length){for(s=this.array.base.objects,n=0,i=s.length;i>n;n++)if(r=s[n],r instanceof G){t=!0;break}if(!t)return this.compileOrTest(e)}return this.compileLoopTest(e)},t.prototype.compileOrTest=function(e){var t,n,i,r,s,o,a,c,h,l,u,p;for(c=this.object.cache(e,F),u=c[0],a=c[1],h=this.negated?[" !== "," && "]:[" === "," || "],t=h[0],n=h[1],p=[],l=this.array.base.objects,i=s=0,o=l.length;o>s;i=++s)r=l[i],i&&p.push(this.makeCode(n)),p=p.concat(i?a:u,this.makeCode(t),r.compileToFragments(e,T));return F>e.level?p:this.wrapInBraces(p)},t.prototype.compileLoopTest=function(e){var t,n,i,r;return i=this.object.cache(e,E),r=i[0],n=i[1],t=[].concat(this.makeCode(bt("indexOf",e)+".call("),this.array.compileToFragments(e,E),this.makeCode(", "),n,this.makeCode(") "+(this.negated?"< 0":">= 0"))),st(r)===st(n)?t:(t=r.concat(this.makeCode(", "),t),E>e.level?t:this.wrapInBraces(t))},t.prototype.toString=function(e){return t.__super__.toString.call(this,e,this.constructor.name+(this.negated?"!":""))},t}(r),e.Try=Y=function(e){function t(e,t,n,i){this.attempt=e,this.errorVariable=t,this.recovery=n,this.ensure=i}return kt(t,e),t.prototype.children=["attempt","recovery","ensure"],t.prototype.isStatement=Q,t.prototype.jumps=function(e){var t;return this.attempt.jumps(e)||(null!=(t=this.recovery)?t.jumps(e):void 0)},t.prototype.makeReturn=function(e){return this.attempt&&(this.attempt=this.attempt.makeReturn(e)),this.recovery&&(this.recovery=this.recovery.makeReturn(e)),this},t.prototype.compileNode=function(e){var t,n,r,s;return e.indent+=q,s=this.attempt.compileToFragments(e,L),t=this.recovery?(r=new x("_error"),this.errorVariable?this.recovery.unshift(new i(this.errorVariable,r)):void 0,[].concat(this.makeCode(" catch ("),r.compileToFragments(e),this.makeCode(") {\n"),this.recovery.compileToFragments(e,L),this.makeCode("\n"+this.tab+"}"))):this.ensure||this.recovery?[]:[this.makeCode(" catch (_error) {}")],n=this.ensure?[].concat(this.makeCode(" finally {\n"),this.ensure.compileToFragments(e,L),this.makeCode("\n"+this.tab+"}")):[],[].concat(this.makeCode(this.tab+"try {\n"),s,this.makeCode("\n"+this.tab+"}"),t,n)},t}(r),e.Throw=W=function(e){function t(e){this.expression=e}return kt(t,e),t.prototype.children=["expression"],t.prototype.isStatement=Q,t.prototype.jumps=D,t.prototype.makeReturn=X,t.prototype.compileNode=function(e){return[].concat(this.makeCode(this.tab+"throw "),this.expression.compileToFragments(e),this.makeCode(";"))},t}(r),e.Existence=u=function(e){function t(e){this.expression=e}return kt(t,e),t.prototype.children=["expression"],t.prototype.invert=S,t.prototype.compileNode=function(e){var t,n,i,r;return this.expression.front=this.front,i=this.expression.compile(e,F),g.test(i)&&!e.scope.check(i)?(r=this.negated?["===","||"]:["!==","&&"],t=r[0],n=r[1],i="typeof "+i+" "+t+' "undefined" '+n+" "+i+" "+t+" null"):i=i+" "+(this.negated?"==":"!=")+" null",[this.makeCode(C>=e.level?i:"("+i+")")]},t}(r),e.Parens=O=function(e){function t(e){this.body=e}return kt(t,e),t.prototype.children=["body"],t.prototype.unwrap=function(){return this.body},t.prototype.isComplex=function(){return this.body.isComplex()},t.prototype.compileNode=function(e){var t,n,i;return n=this.body.unwrap(),n instanceof z&&n.isAtomic()?(n.front=this.front,n.compileToFragments(e)):(i=n.compileToFragments(e,N),t=F>e.level&&(n instanceof I||n instanceof o||n instanceof f&&n.returns),t?i:this.wrapInBraces(i))},t}(r),e.For=f=function(e){function t(e,t){var n;this.source=t.source,this.guard=t.guard,this.step=t.step,this.name=t.name,this.index=t.index,this.body=s.wrap([e]),this.own=!!t.own,this.object=!!t.object,this.object&&(n=[this.index,this.name],this.name=n[0],this.index=n[1]),this.index instanceof z&&this.index.error("index cannot be a pattern matching expression"),this.range=this.source instanceof z&&this.source.base instanceof j&&!this.source.properties.length,this.pattern=this.name instanceof z,this.range&&this.index&&this.index.error("indexes do not apply to range loops"),this.range&&this.pattern&&this.name.error("cannot pattern match over range loops"),this.own&&!this.object&&this.name.error("cannot use own with for-in"),this.returns=!1}return kt(t,e),t.prototype.children=["body","source","guard","step"],t.prototype.compileNode=function(e){var t,n,r,o,a,c,h,l,u,p,d,f,m,v,y,k,w,T,C,F,N,S,D,A,I,_,$,j,B,V,P,U,G,H;return t=s.wrap([this.body]),D=t.expressions,T=D[D.length-1],(null!=T?T.jumps():void 0)instanceof M&&(this.returns=!1),B=this.range?this.source.base:this.source,j=e.scope,this.pattern||(F=this.name&&this.name.compile(e,E)),v=this.index&&this.index.compile(e,E),F&&!this.pattern&&j.find(F),v&&j.find(v),this.returns&&($=j.freeVariable("results")),y=this.object&&v||j.freeVariable("i",{single:!0}),k=this.range&&F||v||y,w=k!==y?k+" = ":"",this.step&&!this.range&&(A=this.cacheToCodeFragments(this.step.cache(e,E,ot)),V=A[0],U=A[1],P=U.match(R)),this.pattern&&(F=y),H="",d="",h="",f=this.tab+q,this.range?p=B.compileToFragments(lt(e,{index:y,name:F,step:this.step,isComplex:ot})):(G=this.source.compile(e,E),!F&&!this.own||g.test(G)||(h+=""+this.tab+(S=j.freeVariable("ref"))+" = "+G+";\n",G=S),F&&!this.pattern&&(N=F+" = "+G+"["+k+"]"),this.object||(V!==U&&(h+=""+this.tab+V+";\n"),this.step&&P&&(u=0>pt(P[0]))||(C=j.freeVariable("len")),a=""+w+y+" = 0, "+C+" = "+G+".length",c=""+w+y+" = "+G+".length - 1",r=y+" < "+C,o=y+" >= 0",this.step?(P?u&&(r=o,a=c):(r=U+" > 0 ? "+r+" : "+o,a="("+U+" > 0 ? ("+a+") : "+c+")"),m=y+" += "+U):m=""+(k!==y?"++"+y:y+"++"),p=[this.makeCode(a+"; "+r+"; "+w+m)])),this.returns&&(I=""+this.tab+$+" = [];\n",_="\n"+this.tab+"return "+$+";",t.makeReturn($)),this.guard&&(t.expressions.length>1?t.expressions.unshift(new b(new O(this.guard).invert(),new x("continue"))):this.guard&&(t=s.wrap([new b(this.guard,t)]))),this.pattern&&t.expressions.unshift(new i(this.name,new x(G+"["+k+"]"))),l=[].concat(this.makeCode(h),this.pluckDirectCall(e,t)),N&&(H="\n"+f+N+";"),this.object&&(p=[this.makeCode(k+" in "+G)],this.own&&(d="\n"+f+"if (!"+bt("hasProp",e)+".call("+G+", "+k+")) continue;")),n=t.compileToFragments(lt(e,{indent:f}),L),n&&n.length>0&&(n=[].concat(this.makeCode("\n"),n,this.makeCode("\n"))),[].concat(l,this.makeCode(""+(I||"")+this.tab+"for ("),p,this.makeCode(") {"+d+H),n,this.makeCode(this.tab+"}"+(_||"")))},t.prototype.pluckDirectCall=function(e,t){var n,r,s,a,h,l,u,p,d,f,m,g,v,y,b,k;for(r=[],d=t.expressions,h=l=0,u=d.length;u>l;h=++l)s=d[h],s=s.unwrapAll(),s instanceof o&&(k=null!=(f=s.variable)?f.unwrapAll():void 0,(k instanceof c||k instanceof z&&(null!=(m=k.base)?m.unwrapAll():void 0)instanceof c&&1===k.properties.length&&("call"===(g=null!=(v=k.properties[0].name)?v.value:void 0)||"apply"===g))&&(a=(null!=(y=k.base)?y.unwrapAll():void 0)||k,p=new x(e.scope.freeVariable("fn")),n=new z(p),k.base&&(b=[n,k],k.base=b[0],n=b[1]),t.expressions[h]=new o(n,s.args),r=r.concat(this.makeCode(this.tab),new i(p,a).compileToFragments(e,L),this.makeCode(";\n"))));return r},t}(J),e.Switch=H=function(e){function t(e,t,n){this.subject=e,this.cases=t,this.otherwise=n}return kt(t,e),t.prototype.children=["subject","cases","otherwise"],t.prototype.isStatement=Q,t.prototype.jumps=function(e){var t,n,i,r,s,o,a,c;for(null==e&&(e={block:!0}),o=this.cases,i=0,s=o.length;s>i;i++)if(a=o[i],n=a[0],t=a[1],r=t.jumps(e))return r;return null!=(c=this.otherwise)?c.jumps(e):void 0},t.prototype.makeReturn=function(e){var t,n,i,r,o;for(r=this.cases,t=0,n=r.length;n>t;t++)i=r[t],i[1].makeReturn(e);return e&&(this.otherwise||(this.otherwise=new s([new x("void 0")]))),null!=(o=this.otherwise)&&o.makeReturn(e),this},t.prototype.compileNode=function(e){var t,n,i,r,s,o,a,c,h,l,u,p,d,f,m,g;for(c=e.indent+q,h=e.indent=c+q,o=[].concat(this.makeCode(this.tab+"switch ("),this.subject?this.subject.compileToFragments(e,N):this.makeCode("false"),this.makeCode(") {\n")),f=this.cases,a=l=0,p=f.length;p>l;a=++l){for(m=f[a],r=m[0],t=m[1],g=rt([r]),u=0,d=g.length;d>u;u++)i=g[u],this.subject||(i=i.invert()),o=o.concat(this.makeCode(c+"case "),i.compileToFragments(e,N),this.makeCode(":\n"));if((n=t.compileToFragments(e,L)).length>0&&(o=o.concat(n,this.makeCode("\n"))),a===this.cases.length-1&&!this.otherwise)break;s=this.lastNonComment(t.expressions),s instanceof M||s instanceof x&&s.jumps()&&"debugger"!==s.value||o.push(i.makeCode(h+"break;\n"))}return this.otherwise&&this.otherwise.expressions.length&&o.push.apply(o,[this.makeCode(c+"default:\n")].concat(Ct.call(this.otherwise.compileToFragments(e,L)),[this.makeCode("\n")])),o.push(this.makeCode(this.tab+"}")),o},t}(r),e.If=b=function(e){function t(e,t,n){this.body=t,null==n&&(n={}),this.condition="unless"===n.type?e.invert():e,this.elseBody=null,this.isChain=!1,this.soak=n.soak}return kt(t,e),t.prototype.children=["condition","body","elseBody"],t.prototype.bodyNode=function(){var e;return null!=(e=this.body)?e.unwrap():void 0},t.prototype.elseBodyNode=function(){var e;return null!=(e=this.elseBody)?e.unwrap():void 0},t.prototype.addElse=function(e){return this.isChain?this.elseBodyNode().addElse(e):(this.isChain=e instanceof t,this.elseBody=this.ensureBlock(e),this.elseBody.updateLocationDataIfMissing(e.locationData)),this},t.prototype.isStatement=function(e){var t;return(null!=e?e.level:void 0)===L||this.bodyNode().isStatement(e)||(null!=(t=this.elseBodyNode())?t.isStatement(e):void 0)},t.prototype.jumps=function(e){var t;return this.body.jumps(e)||(null!=(t=this.elseBody)?t.jumps(e):void 0)},t.prototype.compileNode=function(e){return this.isStatement(e)?this.compileStatement(e):this.compileExpression(e)},t.prototype.makeReturn=function(e){return e&&(this.elseBody||(this.elseBody=new s([new x("void 0")]))),this.body&&(this.body=new s([this.body.makeReturn(e)])),this.elseBody&&(this.elseBody=new s([this.elseBody.makeReturn(e)])),this},t.prototype.ensureBlock=function(e){return e instanceof s?e:new s([e])},t.prototype.compileStatement=function(e){var n,i,r,s,o,a,c;return r=tt(e,"chainChild"),(o=tt(e,"isExistentialEquals"))?new t(this.condition.invert(),this.elseBodyNode(),{type:"if"}).compileToFragments(e):(c=e.indent+q,s=this.condition.compileToFragments(e,N),i=this.ensureBlock(this.body).compileToFragments(lt(e,{indent:c})),a=[].concat(this.makeCode("if ("),s,this.makeCode(") {\n"),i,this.makeCode("\n"+this.tab+"}")),r||a.unshift(this.makeCode(this.tab)),this.elseBody?(n=a.concat(this.makeCode(" else ")),this.isChain?(e.chainChild=!0,n=n.concat(this.elseBody.unwrap().compileToFragments(e,L))):n=n.concat(this.makeCode("{\n"),this.elseBody.compileToFragments(lt(e,{indent:c}),L),this.makeCode("\n"+this.tab+"}")),n):a)},t.prototype.compileExpression=function(e){var t,n,i,r;return i=this.condition.compileToFragments(e,C),n=this.bodyNode().compileToFragments(e,E),t=this.elseBodyNode()?this.elseBodyNode().compileToFragments(e,E):[this.makeCode("void 0")],r=i.concat(this.makeCode(" ? "),n,this.makeCode(" : "),t),e.level>=C?this.wrapInBraces(r):r},t.prototype.unfoldSoak=function(){return this.soak&&this},t}(r),K={extend:function(e){return"function(child, parent) { for (var key in parent) { if ("+bt("hasProp",e)+".call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; }"},bind:function(){return"function(fn, me){ return function(){ return fn.apply(me, arguments); }; }"},indexOf:function(){return"[].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; }"},modulo:function(){return"function(a, b) { return (+a % (b = +b) + b) % b; }"},hasProp:function(){return"{}.hasOwnProperty"},slice:function(){return"[].slice"}},L=1,N=2,E=3,C=4,F=5,T=6,q="  ",g=/^(?!\d)[$\w\x7f-\uffff]+$/,B=/^[+-]?\d+$/,m=/^[+-]?0x[\da-f]+/i,R=/^[+-]?(?:0x[\da-f]+|\d*\.?\d+(?:e[+-]?\d+)?)$/i,y=/^['"]/,v=/^\//,bt=function(e,t){var n,i;return i=t.scope.root,e in i.utilities?i.utilities[e]:(n=i.freeVariable(e),i.assign(n,K[e](t)),i.utilities[e]=n)},ut=function(e,t){return e=e.replace(/\n/g,"$&"+t),e.replace(/\s+$/,"")},pt=function(e){return null==e?0:e.match(m)?parseInt(e,16):parseFloat(e)},at=function(e){return e instanceof x&&"arguments"===e.value&&!e.asKey},ct=function(e){return e instanceof x&&"this"===e.value&&!e.asKey||e instanceof c&&e.bound||e instanceof o&&e.isSuper},ot=function(e){return e.isComplex()||("function"==typeof e.isAssignable?e.isAssignable():void 0)},yt=function(e,t,n){var i;if(i=t[n].unfoldSoak(e))return t[n]=i.body,i.body=new z(t),i}}.call(this),t.exports}(),require["./sourcemap"]=function(){var e={},t={exports:e};return function(){var e,n;e=function(){function e(e){this.line=e,this.columns=[]}return e.prototype.add=function(e,t,n){var i,r;return r=t[0],i=t[1],null==n&&(n={}),this.columns[e]&&n.noReplace?void 0:this.columns[e]={line:this.line,column:e,sourceLine:r,sourceColumn:i}},e.prototype.sourceLocation=function(e){for(var t;!((t=this.columns[e])||0>=e);)e--;return t&&[t.sourceLine,t.sourceColumn]},e}(),n=function(){function t(){this.lines=[]}var n,i,r,s;return t.prototype.add=function(t,n,i){var r,s,o,a;return null==i&&(i={}),o=n[0],s=n[1],a=(r=this.lines)[o]||(r[o]=new e(o)),a.add(s,t,i)},t.prototype.sourceLocation=function(e){var t,n,i;for(n=e[0],t=e[1];!((i=this.lines[n])||0>=n);)n--;return i&&i.sourceLocation(t)},t.prototype.generate=function(e,t){var n,i,r,s,o,a,c,h,l,u,p,d,f,m,g,v;for(null==e&&(e={}),null==t&&(t=null),v=0,s=0,a=0,o=0,d=!1,n="",f=this.lines,u=i=0,c=f.length;c>i;u=++i)if(l=f[u])for(m=l.columns,r=0,h=m.length;h>r;r++)if(p=m[r]){for(;p.line>v;)s=0,d=!1,n+=";",v++;d&&(n+=",",d=!1),n+=this.encodeVlq(p.column-s),s=p.column,n+=this.encodeVlq(0),n+=this.encodeVlq(p.sourceLine-a),a=p.sourceLine,n+=this.encodeVlq(p.sourceColumn-o),o=p.sourceColumn,d=!0}return g={version:3,file:e.generatedFile||"",sourceRoot:e.sourceRoot||"",sources:e.sourceFiles||[""],names:[],mappings:n},e.inline&&(g.sourcesContent=[t]),JSON.stringify(g,null,2)},r=5,i=1<<r,s=i-1,t.prototype.encodeVlq=function(e){var t,n,o,a;for(t="",o=0>e?1:0,a=(Math.abs(e)<<1)+o;a||!t;)n=a&s,a>>=r,a&&(n|=i),t+=this.encodeBase64(n);return t},n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",t.prototype.encodeBase64=function(e){return n[e]||function(){throw Error("Cannot Base64 encode value: "+e)}()},t}(),t.exports=n}.call(this),t.exports}(),require["./coffee-script"]=function(){var e={},t={exports:e};return function(){var t,n,i,r,s,o,a,c,h,l,u,p,d,f,m,g,v,y,b={}.hasOwnProperty,k=[].indexOf||function(e){for(var t=0,n=this.length;n>t;t++)if(t in this&&this[t]===e)return t;return-1};if(a=require("fs"),v=require("vm"),f=require("path"),t=require("./lexer").Lexer,d=require("./parser").parser,h=require("./helpers"),n=require("./sourcemap"),e.VERSION="1.9.1",e.FILE_EXTENSIONS=[".coffee",".litcoffee",".coffee.md"],e.helpers=h,y=function(e){return function(t,n){var i;null==n&&(n={});try{return e.call(this,t,n)
}catch(r){throw i=r,h.updateSyntaxError(i,t,n.filename)}}},e.compile=r=y(function(e,t){var i,r,s,o,a,c,l,u,f,m,g,v,y,b,k;for(v=h.merge,o=h.extend,t=o({},t),t.sourceMap&&(g=new n),k=p.tokenize(e,t),t.referencedVars=function(){var e,t,n;for(n=[],e=0,t=k.length;t>e;e++)b=k[e],b.variable&&n.push(b[1]);return n}(),c=d.parse(k).compileToFragments(t),s=0,t.header&&(s+=1),t.shiftLine&&(s+=1),r=0,f="",u=0,m=c.length;m>u;u++)a=c[u],t.sourceMap&&(a.locationData&&g.add([a.locationData.first_line,a.locationData.first_column],[s,r],{noReplace:!0}),y=h.count(a.code,"\n"),s+=y,y?r=a.code.length-(a.code.lastIndexOf("\n")+1):r+=a.code.length),f+=a.code;return t.header&&(l="Generated by CoffeeScript "+this.VERSION,f="// "+l+"\n"+f),t.sourceMap?(i={js:f},i.sourceMap=g,i.v3SourceMap=g.generate(t,e),i):f}),e.tokens=y(function(e,t){return p.tokenize(e,t)}),e.nodes=y(function(e,t){return"string"==typeof e?d.parse(p.tokenize(e,t)):d.parse(e)}),e.run=function(e,t){var n,i,s,o;return null==t&&(t={}),s=require.main,s.filename=process.argv[1]=t.filename?a.realpathSync(t.filename):".",s.moduleCache&&(s.moduleCache={}),i=t.filename?f.dirname(a.realpathSync(t.filename)):a.realpathSync("."),s.paths=require("module")._nodeModulePaths(i),(!h.isCoffee(s.filename)||require.extensions)&&(n=r(e,t),e=null!=(o=n.js)?o:n),s._compile(e,s.filename)},e.eval=function(e,t){var n,i,s,o,a,c,h,l,u,p,d,m,g,y,k,w,T;if(null==t&&(t={}),e=e.trim()){if(o=null!=(m=v.Script.createContext)?m:v.createContext,c=null!=(g=v.isContext)?g:function(){return t.sandbox instanceof o().constructor},o){if(null!=t.sandbox){if(c(t.sandbox))w=t.sandbox;else{w=o(),y=t.sandbox;for(l in y)b.call(y,l)&&(T=y[l],w[l]=T)}w.global=w.root=w.GLOBAL=w}else w=global;if(w.__filename=t.filename||"eval",w.__dirname=f.dirname(w.__filename),w===global&&!w.module&&!w.require){for(n=require("module"),w.module=i=new n(t.modulename||"eval"),w.require=s=function(e){return n._load(e,i,!0)},i.filename=w.__filename,k=Object.getOwnPropertyNames(require),a=0,u=k.length;u>a;a++)d=k[a],"paths"!==d&&(s[d]=require[d]);s.paths=i.paths=n._nodeModulePaths(process.cwd()),s.resolve=function(e){return n._resolveFilename(e,i)}}}p={};for(l in t)b.call(t,l)&&(T=t[l],p[l]=T);return p.bare=!0,h=r(e,p),w===global?v.runInThisContext(h):v.runInContext(h,w)}},e.register=function(){return require("./register")},require.extensions)for(m=this.FILE_EXTENSIONS,l=0,u=m.length;u>l;l++)s=m[l],null==(i=require.extensions)[s]&&(i[s]=function(){throw Error("Use CoffeeScript.register() or require the coffee-script/register module to require "+s+" files.")});e._compileFile=function(e,t){var n,i,s,o;null==t&&(t=!1),s=a.readFileSync(e,"utf8"),o=65279===s.charCodeAt(0)?s.substring(1):s;try{n=r(o,{filename:e,sourceMap:t,literate:h.isLiterate(e)})}catch(c){throw i=c,h.updateSyntaxError(i,o,e)}return n},p=new t,d.lexer={lex:function(){var e,t;return t=d.tokens[this.pos++],t?(e=t[0],this.yytext=t[1],this.yylloc=t[2],d.errorToken=t.origin||t,this.yylineno=this.yylloc.first_line):e="",e},setInput:function(e){return d.tokens=e,this.pos=0},upcomingInput:function(){return""}},d.yy=require("./nodes"),d.yy.parseError=function(e,t){var n,i,r,s,o,a;return o=t.token,s=d.errorToken,a=d.tokens,i=s[0],r=s[1],n=s[2],r=function(){switch(!1){case s!==a[a.length-1]:return"end of input";case"INDENT"!==i&&"OUTDENT"!==i:return"indentation";case"IDENTIFIER"!==i&&"NUMBER"!==i&&"STRING"!==i&&"STRING_START"!==i&&"REGEX"!==i&&"REGEX_START"!==i:return i.replace(/_START$/,"").toLowerCase();default:return h.nameWhitespaceCharacter(r)}}(),h.throwSyntaxError("unexpected "+r,n)},o=function(e,t){var n,i,r,s,o,a,c,h,l,u,p,d;return s=void 0,r="",e.isNative()?r="native":(e.isEval()?(s=e.getScriptNameOrSourceURL(),s||(r=e.getEvalOrigin()+", ")):s=e.getFileName(),s||(s="<anonymous>"),h=e.getLineNumber(),i=e.getColumnNumber(),u=t(s,h,i),r=u?s+":"+u[0]+":"+u[1]:s+":"+h+":"+i),o=e.getFunctionName(),a=e.isConstructor(),c=!(e.isToplevel()||a),c?(l=e.getMethodName(),d=e.getTypeName(),o?(p=n="",d&&o.indexOf(d)&&(p=d+"."),l&&o.indexOf("."+l)!==o.length-l.length-1&&(n=" [as "+l+"]"),""+p+o+n+" ("+r+")"):d+"."+(l||"<anonymous>")+" ("+r+")"):a?"new "+(o||"<anonymous>")+" ("+r+")":o?o+" ("+r+")":r},g={},c=function(t){var n,i;if(g[t])return g[t];if(i=null!=f?f.extname(t):void 0,!(0>k.call(e.FILE_EXTENSIONS,i)))return n=e._compileFile(t,!0),g[t]=n.sourceMap},Error.prepareStackTrace=function(t,n){var i,r,s;return s=function(e,t,n){var i,r;return r=c(e),r&&(i=r.sourceLocation([t-1,n-1])),i?[i[0]+1,i[1]+1]:null},r=function(){var t,r,a;for(a=[],t=0,r=n.length;r>t&&(i=n[t],i.getFunction()!==e.run);t++)a.push("  at "+o(i,s));return a}(),""+t+"\n"+r.join("\n")+"\n"}}.call(this),t.exports}(),require["./browser"]=function(){var exports={},module={exports:exports};return function(){var CoffeeScript,compile,runScripts,indexOf=[].indexOf||function(e){for(var t=0,n=this.length;n>t;t++)if(t in this&&this[t]===e)return t;return-1};CoffeeScript=require("./coffee-script"),CoffeeScript.require=require,compile=CoffeeScript.compile,CoffeeScript.eval=function(code,options){return null==options&&(options={}),null==options.bare&&(options.bare=!0),eval(compile(code,options))},CoffeeScript.run=function(e,t){return null==t&&(t={}),t.bare=!0,t.shiftLine=!0,Function(compile(e,t))()},"undefined"!=typeof window&&null!==window&&("undefined"!=typeof btoa&&null!==btoa&&"undefined"!=typeof JSON&&null!==JSON&&"undefined"!=typeof unescape&&null!==unescape&&"undefined"!=typeof encodeURIComponent&&null!==encodeURIComponent&&(compile=function(e,t){var n,i,r;return null==t&&(t={}),t.sourceMap=!0,t.inline=!0,i=CoffeeScript.compile(e,t),n=i.js,r=i.v3SourceMap,n+"\n//# sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(r)))+"\n//# sourceURL=coffeescript"}),CoffeeScript.load=function(e,t,n,i){var r;return null==n&&(n={}),null==i&&(i=!1),n.sourceFiles=[e],r=window.ActiveXObject?new window.ActiveXObject("Microsoft.XMLHTTP"):new window.XMLHttpRequest,r.open("GET",e,!0),"overrideMimeType"in r&&r.overrideMimeType("text/plain"),r.onreadystatechange=function(){var s,o;if(4===r.readyState){if(0!==(o=r.status)&&200!==o)throw Error("Could not load "+e);if(s=[r.responseText,n],i||CoffeeScript.run.apply(CoffeeScript,s),t)return t(s)}},r.send(null)},runScripts=function(){var e,t,n,i,r,s,o,a,c,h,l;for(l=window.document.getElementsByTagName("script"),t=["text/coffeescript","text/literate-coffeescript"],e=function(){var e,n,i,r;for(r=[],e=0,n=l.length;n>e;e++)c=l[e],i=c.type,indexOf.call(t,i)>=0&&r.push(c);return r}(),s=0,n=function(){var t;return t=e[s],t instanceof Array?(CoffeeScript.run.apply(CoffeeScript,t),s++,n()):void 0},i=function(i,r){var s;return s={literate:i.type===t[1]},i.src?CoffeeScript.load(i.src,function(t){return e[r]=t,n()},s,!0):(s.sourceFiles=["embedded"],e[r]=[i.innerHTML,s])},r=o=0,a=e.length;a>o;r=++o)h=e[r],i(h,r);return n()},window.addEventListener?window.addEventListener("DOMContentLoaded",runScripts,!1):window.attachEvent("onload",runScripts))}.call(this),module.exports}(),require["./coffee-script"]}();"function"==typeof define&&define.amd?define(function(){return CoffeeScript}):root.CoffeeScript=CoffeeScript})(this);;
iio.logs = [];

//LOG OBJECT
iio.Log = function(){ this.Log.apply(this, arguments) }
iio.Log.SUCCESS = 1;
iio.Log.FAILURE = 2;
iio.Log.WARNING = 3;
iio.Log.prototype.Log = function() {
	if(iio.is.string(arguments[0])){
		this.msg = arguments[0];
		this.type = arguments[1] || 0;
	} else for (var p in arguments[0]) this[p] = arguments[0][p];
}

iio.log = function(){
	iio.add_log(new iio.Log(arguments[0],arguments[1]));
}

iio.show_logs = function(){
	iio.logDiv = document.createElement('div');
	iio.logDiv.id = 'iio_log';
	iio.logDiv.style.position = 'fixed';
	iio.logDiv.style.bottom = '0';
	iio.logDiv.style.right = '0';
	document.body.appendChild(iio.logDiv);
	for(var i=0; i<iio.logs.length; i++)
		iio.add_log(iio.logs[i]);
}

iio.add_log = function(log){
	var p = document.createElement('p');
	p.innerHTML = log.msg;
	if(log.type == iio.Log.SUCCESS) p.style.color = 'green';
	if(log.type == iio.Log.FAILURE) p.style.color = 'red';
	if(log.type == iio.Log.WARNING) p.style.color = 'yellow';
	p.style.fontFamily = 'monospace';
	iio.logDiv.appendChild(p);
	iio.logs.push(log);
	return log;
}

//STACK TRACING
iio._start = iio.start;
iio.start = function(app, id, d){
	iio.log('START: '+app.name);
	return iio._start(app, id, d)
}

//constructors
iio.App.prototype._App = iio.App.prototype.App;
iio.App.prototype.App = function(view, app, s) {
	iio.log('enter CONSTRUCTOR: App');
	this._App(view, app, s);
	iio.log('- App.pos: '+this.pos.x+','+this.pos.y);
	iio.log('- App.width: '+this.width);
	iio.log('- App.height: '+this.height);
	iio.log('end CONSTRUCTOR: App');
}
iio.Obj.prototype._Obj = iio.Obj.prototype.Obj;
iio.Obj.prototype.Obj = function() {
	iio.log('enter CONSTRUCTOR: Obj');
	this._Obj(arguments[0]);
	if(this.pos) iio.log('- Obj.pos: '+this.pos.x+','+this.pos.y);
	if(this.color) iio.log('- Obj.color: '+this.color.toString());
	iio.log('end CONSTRUCTOR: Obj');
}
iio.Drawable.prototype._Drawable = iio.Drawable.prototype.Drawable;
iio.Drawable.prototype.Drawable = function() {
	iio.log('enter CONSTRUCTOR: Drawable');
	this._Drawable(arguments[0]);
	iio.log('end CONSTRUCTOR: Drawable');
}
iio.Line.prototype._Line = iio.Line.prototype.Line;
iio.Line.prototype.Line = function() {
	iio.log('enter CONSTRUCTOR: Line');
	this._Line(arguments[0]);
	if(this.vs) iio.log('- Line.vs: ['+this.vs[0].x+','+this.vs[0].y+'] ['+this.vs[1].x+','+this.vs[1].y+']');
	iio.log('end CONSTRUCTOR: Line');
};
/*
   iio engine
   Version 1.3- Working Version
*/
iio_dependency_path = "http://iioengine.com/src/core/"
iio_dependencies = [
  'core.js',
  'libs.js',
  'V.js',
  'Color.js',
  'Obj.js',
  'App.js',
  'SpriteMap.js',
  'Drawable.js',
  'Line.js',
  'Polygon.js',
  'Rectangle.js',
  'Square.js',
  'Grid.js',
  'Ellipse.js',
  'Text.js',
]

var load_iio_remote = function(onload){
  iio_load_dependency(0,onload);
}

var iio_load_dependency = function(i,onload){
  var file_element = document.createElement('script');
  file_element.setAttribute("type","text/javascript");
  file_element.setAttribute("src", iio_dependency_path + iio_dependencies[i]);
  if (typeof file_element!="undefined")
        document.getElementsByTagName("head")[0].appendChild(file_element)

  file_element.onload = function(){
    if(i<iio_dependencies.length-1)
      iio_load_dependency(i+1,onload);
    else onload();
  }
}
