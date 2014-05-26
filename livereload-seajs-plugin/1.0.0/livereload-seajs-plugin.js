/**
 * The Sea.js plugin for reload and excute cmd module separately
 */
(function(seajs, global) {
  /**
   * 从html文本中, 根据feature提取相应地代码块
   * 此处主要用于提取seajs.use所在的代码块
   * @param {Object} 
   */
  function HtmlParser(options) {
    this.htmlText = options.html;
    this.feature = options.feature;
  }

  HtmlParser.prototype.findAllPos = function() {
    var ret = []

    var i = 0, k=0;
    while(!0) {
      k = this.htmlText.indexOf(this.feature, i);
      i = k+1;
      if(k != -1) {
        ret.push(k);
      } else {
        break;
      }
    }

    return ret
  };

  HtmlParser.prototype._findRangeByPos = function(pos) {
    // 返回的坐标, 是从起始字符到最后个字符
    var ranges = [];
    var start = this.htmlText.lastIndexOf('<script', pos);
    start = this.htmlText.indexOf('>', start);
    var end = this.htmlText.indexOf('</script>',pos);
    return [start + 1, end -1];
  };

  HtmlParser.prototype.parse = function() {
    var allPos = this.findAllPos(this.htmlText)

    var ret = [];
    allPos.forEach(function(pos) {
      var range = this._findRangeByPos(pos);
      var str = this.htmlText.substring(range[0], range[1]+1);
      if(ret.indexOf(str) == -1) {
          ret.push(str)
      }
    }.bind(this));

    return ret
  };
  /** test case
  var code = '<script src="">seajs.use()\n</script>\n<script src="">seajs.use()\n</script>'
  var parser = new HtmlParser({html : code, feature : 'seajs.use'});
  console.log(parser.parse());
  */

  function findUrl(url, lists) {
    // 匹配算法为模糊匹配, 并不保证结果是一定正确
    // 问题代码 console.log(findUrl('jsbridge/1.0/capi.js', ['jsbridge/1.0/capi.j', 'jsbridge/2.0/capi.js']))

    var fragments = url.split('/');
    var len = fragments.length;

    for(var i=1;i <= len;i++){
      var matchList = [];
      var match = fragments.slice(len - i, len).join('/');
      lists.forEach(function(item, index) {
        if(item.indexOf(match) > -1) {
          matchList.push(index);
        }
      });

      if(matchList.length == 1) {
        return lists[matchList[0]];
      } else if (matchList.length == 0){
        return;
      }
    }
  };
  // chrome会阻止相同url向服务器请求, 因此上时间戳无悬念
  function addTimeStampToForceRequest(data) {
    if (data.uri) {
      // use data.requestUri not data.uri to avoid combo & timestamp conflict
      // avoid too long url
      var uri = data.requestUri || data.uri
      data.requestUri = (uri + (uri.indexOf('?') === -1 ? '?t=' : '&t=') + cid()).slice(0, 2000)
    }
  }
  // 重新加载模块
  function reloadModule(absUrl, callback) {
    seajs.cache[absUrl] = null;
    // seajs.use('sea-modules/jsbridge/1.0/capi.js', callback);
    seajs.data.fetchedList[absUrl] = !1;
    seajs.Module.use(absUrl, callback, '_reload_' + cid());
  }
  // 重新加载当前页面, 但不重载样式和脚本
  var docHTML = '';
  document.addEventListener('DOMContentLoaded', function() {
    docHTML = document.documentElement.innerHTML
  });
  function reloadDocument() {
    docHTML = docHTML || document.documentElement.innerHTML;
    // clear the window event
    var $ = seajs.require('$');
    if($) {
      $(document).off(), $(window).off();
    }
    // duplicate docuemnt.body
    var doc =document.implementation.createHTMLDocument('')
    doc.documentElement.innerHTML = docHTML;
    var title = doc.title
    var body = doc.body
    // do replace
    document.title = title
    document.documentElement.replaceChild(body, document.body)
  }
  // 执行seajs的特定脚本
  function runSeajsScript() {
    // run js snippet
    var parser = new HtmlParser({'html' : document.documentElement.innerHTML, 'feature' : 'seajs.use'});
    parser.parse().forEach(function(snippet) {
      // console.log('snippet', snippet)
      eval(snippet);
    });
    // run sepcial js tag
    runScriptTag();
  };

  function runScriptTag() {
    var scripts = document.getElementsByTagName('script'),
        script,
        copy,
        parentNode,
        nextSibling

    for (i = 0, j = scripts.length; i < j; i++) {
      script = scripts[i]
      if (!script.hasAttribute('data-do-repeat')) {
        continue
      }
      copy = document.createElement('script')
      copy.setAttribute('data-do-repeat', !0);
      if (script.src) {
        copy.src = script.src
      }
      if (script.innerHTML) {
        copy.innerHTML = script.innerHTML
      }
      parentNode = script.parentNode
      nextSibling = script.nextSibling
      parentNode.removeChild(script)
      parentNode.insertBefore(copy, nextSibling)
    }
  }

  global.reload = function(url, callback) {
    var absUrl = findUrl(url, keys(seajs.cache));

    console.log('>>>>>>>>>>>>>>>>>>>>>> begin');
    console.log('receive ====> ' + url);

    seajs.on('fetch', addTimeStampToForceRequest);

    // when absUrl undifined, the callback reload funcs trigger either
    reloadModule(absUrl, function() {
      reloadDocument(); 
      runSeajsScript();
      callback && callback();
      console.log('reload ====>' + absUrl);
      console.log('<<<<<<<<<<<<<<<<<<<<< end');
      seajs.off('fetch', addTimeStampToForceRequest);
    })
  };


  // helper
  var _cid = 0;
  function cid() {
    return _cid++;
  };
  function keys(obj) {
    var keys = [];
    for(var x in obj){
      keys.push(x);
    }
    return keys;
  };

  define("seajs/livereload-seajs-plugin/1.0.0/livereload-seajs-plugin", [], {})

})(window.seajs, this);
/**
 * the livereload plugin 
 * the encupsulation of reload function above
 */
(function(LiveReload, global) {
  if(!LiveReload) return;
  
  var SeajsPlugin = (function() {
    SeajsPlugin.identifier = 'seajs';
    SeajsPlugin.version = '1.0';
    function SeajsPlugin(window, host) {
      this.window = window;
      this.host = host;
    }
    SeajsPlugin.prototype.reload = function(path, options) {
      if (path.match(/\.js$/i)) {
        global.reload(path);
        return true;
      }
      return false;
    };
    SeajsPlugin.prototype.analyze = function() {
      return {
        disable: !!global.seajs
      };
    };
    return SeajsPlugin;
  })();

  LiveReload.addPlugin(SeajsPlugin);
})(window.LiveReload, this);
/**
 * the livereload plugin 
 * custom command
 */
(function(LiveReload, global) {
  if(!LiveReload) return;
  
  var CommandPlugin = (function() {
    CommandPlugin.identifier = 'command';
    CommandPlugin.version = '1.0';
    function CommandPlugin(window, host) {
      this.window = window;
      this.host = host;
    }
    CommandPlugin.prototype.reload = function(path, options) {
      if (path.match(/\.(command)$/i)) {
        console.log('custom', path, options)
        if(path == 'reload.command') {
          // curl http://localhost:35729/changed?files=reload.command
          global.document.location.reload();
        }
        return true;
      }
      return false;
    };
    CommandPlugin.prototype.analyze = function() {
      return {
        disable: !!global.seajs
      };
    };
    return CommandPlugin;
  })();

  LiveReload.addPlugin(CommandPlugin);
})(window.LiveReload, this);
/**
 * the livereload plugin 
 * quick reload by ajax
 */
(function(LiveReload, global) {
  if(!LiveReload) return;
  
  var AjaxReloadPlugin = (function() {
    AjaxReloadPlugin.identifier = 'ajaxreload';
    AjaxReloadPlugin.version = '1.0';
    function AjaxReloadPlugin(window, host) {
      this.window = window;
      this.host = host;
      this.xhr = new XMLHttpRequest()
      this.xhr.addEventListener('readystatechange', this.readystatechange.bind(this))
    }
    AjaxReloadPlugin.prototype.reload = function(path, options) {
      // cause js, image, css have scheme specially
      if (!path.match(/\.(js|css|jpe?g|png|gif|command)$/i)) {
        console.log('quickreload', path, options)
        this.xhr.open('GET', location.href);
        this.xhr.send()
        return true;
      }
      return false;
    };
    AjaxReloadPlugin.prototype.analyze = function() {
      return {
        disable: !!global.seajs
      };
    };
    AjaxReloadPlugin.prototype.readystatechange = function() {
      if (this.xhr.readyState < 4) {
        return
      }
      if (this.xhr.status == 0) {
        /* Request aborted */
        return
      }

      if (this.xhr.getResponseHeader('Content-Type').match(/\/(x|ht|xht)ml/)) {
        var doc = document.implementation.createHTMLDocument('')
        doc.documentElement.innerHTML = this.xhr.responseText
        this.changePage(doc.title, doc.body, pageYOffset)
      }
    };
    AjaxReloadPlugin.prototype.changePage = function(title, body, scrollY){
      document.title = title
      document.documentElement.replaceChild(body, document.body)
      scrollTo(0, scrollY)
      this.instantanize()
    };
    AjaxReloadPlugin.prototype.instantanize = function() {
      var scripts = document.body.getElementsByTagName('script'),
          script,
          copy,
          parentNode,
          nextSibling

      for (i = 0, j = scripts.length; i < j; i++) {
        script = scripts[i]
        if (script.hasAttribute('data-no-instant')) {
          continue
        }
        copy = document.createElement('script')
        if (script.src) {
          copy.src = script.src
        }
        if (script.innerHTML) {
          copy.innerHTML = script.innerHTML
        }
        parentNode = script.parentNode
        nextSibling = script.nextSibling
        parentNode.removeChild(script)
        parentNode.insertBefore(copy, nextSibling)
      }
    };

    return AjaxReloadPlugin;
  })();

  LiveReload.addPlugin(AjaxReloadPlugin);
})(window.LiveReload, this);
