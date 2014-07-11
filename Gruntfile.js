module.exports = function (grunt) {
  'use strict';

  // args : 'tasks/page', 'grunt-contrib-watch'
  function loadTasks() {
    var tasks = Array.prototype.slice.apply(arguments);
    var origDir = process.cwd();
    process.chdir(__dirname);
    tasks.forEach(function(task) {
      if(task.indexOf('grunt-contrib-') == 0) {
        grunt.loadNpmTasks(task);
      } else {
        grunt.loadTasks(task);
      }
    });
    process.chdir(origDir);
  };

  grunt.initConfig({
    watch: {
      options: {
        livereload: true,
      },
      scripts: {
        files: grunt.option('target'),
      },
    },
  });

  loadTasks('grunt-contrib-watch');

  grunt.event.on('watch', function(action, filepath, target) {
    grunt.log.writeln(target + ': ' + filepath + ' has ' + action);
  }); 

  grunt.registerTask('default', ['watch']);
};
