define(function(require, exports, module) {
  'use strict';
  
  return function() {
    document.getElementById('text').innerHTML = 'now : ' + Date.now();
  };
});