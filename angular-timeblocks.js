angular.module('ngTimeBlocks', [])
    /**
     * TimeBlocks directive
     */
    .directive('visTimeblocks', function () {
      'use strict';

      return {
        restrict: 'EA',
        transclude: false,
        scope: {
          data: '=',
          options: '=',
          events: '='
        },
        link: function (scope, element, attr) {
          var timeblocksEvents = [
            'rangechange',
            'rangechanged',
            'timechange',
            'timechanged',
            'select',
            'doubleClick',
            'click',
            'contextmenu',
            'beforeRedraw',
            'afterRedraw'
          ];

          // Declare the timeblocks visualization
          var timeblocks = new TimeBlocks(element[0], scope.data.items, scope.data.labels, scope.options || {});

          scope.$watchCollection('data', function () {
            timeblocks.setItems(scope.data.items);
            timeblocks.setLabels(scope.data.labels);
            timeblocks._redraw(); // TODO: should become redundant?
          });

          scope.$watchCollection('options', function (options) {
            timeblocks.setOptions(options);
          });

          // Attach an event handlers
          timeblocksEvents.forEach(function (event) {
            timeblocks.on(event, function callback () {
              var args = [];
              for (var i = 0; i < arguments.length; i++) {
                args[i] = arguments[i];
              }

              if (scope.events && scope.events[event]) {
                scope.events[event].apply(null, args);
              }
            });
          });

          if (scope.events && scope.events.onload) {
            scope.events.onload(timeblocks);
          }

          // TODO: implement select event
          if (scope.events && scope.events.select) {
            throw new Error('Select event is not yet implemented...')
          }
        }
      };
    });
