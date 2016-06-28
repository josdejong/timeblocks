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
            'contextmenu'
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

          // TODO: watch events
          // // Attach an event handler if defined
          // angular.forEach(scope.events, function (callback, event) {
          //   if (timeblocksEvents.indexOf(String(event)) >= 0) {
          //     timeblocks.on(event, callback);
          //   }
          // });

        }
      };
    });
