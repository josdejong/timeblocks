var TimeBlocks = (function () {
  var moment = vis.moment;
  var util = vis.util;
  var DataSet = vis.DataSet;
  var DataView = vis.DataSet;
  var Range = vis.timeline.Range;
  var Core = vis.timeline.Core;
  var TimeAxis = vis.timeline.components.TimeAxis;
  var DataScale = vis.timeline.components.DataScale;
  var CurrentTime = vis.timeline.components.CurrentTime;
  var CustomTime = vis.timeline.components.CustomTime;
  var Timeline = vis.Timeline;
  var DateUtil = vis.timeline.DateUtil;

  /*****************************    TimeBlocks    *******************************/


  /**
   * Create a TimeBlocks visualization
   * @param {HTMLElement} container
   * @param {vis.DataSet | Array} [items]
   * @param {vis.DataSet | Array} [labels]
   * @param {Object} [options]  See TimeBlocks.setOptions for the available options.
   * @constructor
   * @extends Core
   */
  function TimeBlocks (container, items, labels, options) {
    // if the third element is options, the forth is groups (optionally);
    if (!(Array.isArray(labels) || labels instanceof DataSet || labels instanceof DataView) && labels instanceof Object) {
      var forthArgument = options;
      options = labels;
      labels = forthArgument;
    }

    var me = this;
    this.defaultOptions = {
      start: null,
      end:   null,

      autoResize: true,

      orientation: {
        axis: 'bottom',   // axis orientation: 'bottom', 'top', or 'both'
        item: 'bottom'    // not relevant for TimeBlocks
      },

      moment: moment,

      width: null,
      height: null,
      maxHeight: null,
      minHeight: null,

      yMin: null,
      yMax: null
    };
    this.options = util.deepExtend({}, this.defaultOptions);

    // Create the DOM, props, and emitter
    this._create(container);

    // all components listed here will be repainted automatically
    this.components = [];

    this.body = {
      dom: this.dom,
      domProps: this.props,
      emitter: {
        on: this.on.bind(this),
        off: this.off.bind(this),
        emit: this.emit.bind(this)
      },
      hiddenDates: [],
      util: {
        toScreen: me._toScreen.bind(me),
        toGlobalScreen: me._toGlobalScreen.bind(me), // this refers to the root.width
        toTime: me._toTime.bind(me),
        toGlobalTime : me._toGlobalTime.bind(me)
      }
    };

    // range
    this.range = new Range(this.body);
    this.components.push(this.range);
    this.body.range = this.range;

    // time axis
    this.timeAxis = new TimeAxis(this.body);
    this.components.push(this.timeAxis);

    // current time bar
    this.currentTime = new CurrentTime(this.body);
    this.components.push(this.currentTime);

    // // item set
    this.blockGraph = new BlockGraph(this.body, options || {});
    this.components.push(this.blockGraph);

    this.itemsData = null;      // DataSet
    this.labelsData = null;     // DataSet


    this.on('tap', function (event) {
      me.emit('click', me.getEventProperties(event))
    });
    this.on('doubletap', function (event) {
      me.emit('doubleClick', me.getEventProperties(event))
    });
    this.dom.root.oncontextmenu = function (event) {
      me.emit('contextmenu', me.getEventProperties(event))
    };

    this.on('requestRedraw', function () {
      me._redraw();
    });

    // apply options
    if (options) {
      this.setOptions(options);
    }

    // create labels
    if (labels) {
      this.setLabels(labels);
    }

    // create itemset
    if (items) {
      this.setItems(items);
    }

    // draw for the first time
    this._redraw();
  }

// Extend the functionality from Core
  TimeBlocks.prototype = new Core();

  TimeBlocks.prototype.setOptions = function (options) {
    // TODO: validate options

    Core.prototype.setOptions.call(this, options);
  };

  /**
   * Set items
   * @param {vis.DataSet | Array | null} items
   */
  TimeBlocks.prototype.setItems = function(items) {
    var initialLoad = (this.itemsData == null);

    // convert to type DataSet when needed
    var newDataSet;
    if (!items) {
      newDataSet = null;
    }
    else if (items instanceof DataSet || items instanceof DataView) {
      newDataSet = items;
    }
    else {
      // turn an array into a DataSet
      newDataSet = new DataSet(items, {
        type: {
          start: 'Date',
          end: 'Date'
        }
      });
    }

    // set items
    this.itemsData = newDataSet;
    this.blockGraph.setItems(this.itemsData);

    if (initialLoad) {
      if (this.options.start != undefined || this.options.end != undefined) {
        var start = this.options.start != undefined ? this.options.start : null;
        var end   = this.options.end != undefined   ? this.options.end : null;
        this.setWindow(start, end, {animation: false});
      }
      else {
        this.fit({animation: false});
      }
    }
    else {
      // TODO: redraw when needed
    }
  };

  /**
   * Set labels displayed on the vertical axis
   * @param {vis.DataSet | Array} labels
   */
  TimeBlocks.prototype.setLabels = function(labels) {
    // convert to type DataSet when needed
    var newDataSet;
    if (!labels) {
      newDataSet = null;
    }
    else if (labels instanceof DataSet || labels instanceof DataView) {
      newDataSet = labels;
    }
    else {
      // turn an array into a dataset
      newDataSet = new DataSet(labels);
    }

    this.labelsData = newDataSet;
    this.blockGraph.setLabels(this.labelsData);

    // TODO: redraw when needed
  };

  /**
   * Calculate the data range of the items start and end dates
   * @returns {{min: Date | null, max: Date | null}}
   */
  TimeBlocks.prototype.getDataRange = Timeline.prototype.getDataRange;


  /**
   * Generate Timeline related information from an event
   * @param {Event} event
   * @return {Object} An object with related information, like on which area
   *                  The event happened, whether clicked on an item, etc.
   */
  TimeBlocks.prototype.getEventProperties = function (event) {
    // TODO: implement getEventProperties for TimeBlocks
  };



  /*****************************    BlockGraph    *******************************/


  function BlockGraph (body, options) {
    this.body = body;

    this.defaultOptions = {
      yMin: null,
      yMax: null
    };

    this.options = util.extend({}, this.defaultOptions);

    this.dom = {
      values: [],
      grid: [],
      items: [],
      labels: []
    };

    this.props = {
      width: 0,
      valueWidth: 0,
      labelsWidth: null,
      charHeight: 24,
      yMin: null,
      yMax: null
    };

    // the _update method is called when anything in the DataSets changes
    var me = this;
    this._update = function () {
      me._updateMinMax();
      me.body.emitter.emit('requestRedraw');
    };

    this.itemsData = null;
    this.labelsData = null;

    this._create();
    this.setOptions(options);
  }

  BlockGraph.prototype.setOptions = function (options) {
    var fields = ['yMin', 'yMax'];
    util.selectiveExtend(fields, this.options, options);

    this._updateMinMax();
  };

  BlockGraph.prototype._updateMinMax = function () {
    if (this.options.yMin != null) {
      this.props.yMin = this.options.yMin
    }
    else {
      var minItem = this.itemsData && this.itemsData.min('yMin');
      if (minItem) {
        this.props.yMin = minItem.yMin;
      }

      var minLabel = this.labelsData && this.labelsData.min('yMin');
      if (minLabel) {
        this.props.yMin = this.props.yMin == null
            ? minLabel.yMin
            : Math.min(this.props.yMin, minLabel.yMin)
      }
    }

    if (this.options.yMax != null) {
      this.props.yMax = this.options.yMax
    }
    else {
      var maxItem = this.itemsData && this.itemsData.max('yMax');
      if (maxItem) {
        this.props.yMax = maxItem.yMax;
      }

      var maxLabel = this.labelsData && this.labelsData.max('yMax');
      if (maxLabel) {
        this.props.yMax = this.props.yMax == null
            ? maxLabel.yMax
            : Math.max(this.props.yMax, maxLabel.yMax)
      }
    }
  };

  BlockGraph.prototype._create = function () {
    this.dom.verticalAxis = document.createElement('div');
    this.dom.verticalAxis.className = 'timeblocks-vertical-axis';

    this.dom.items = document.createElement('div');
    this.dom.items.className = 'timeblocks-items';

    this.dom.labelsContainer = document.createElement('div');
    this.dom.labelsContainer.className = 'timeblocks-labels';
  };

  BlockGraph.prototype.redraw = function () {
    var axisResized = this._redrawAxis();

    var itemsResized = this._redrawItems();

    return axisResized || itemsResized;
  };

  BlockGraph.prototype._redrawAxis = function () {
    var resized = false;
    var height = this.body.domProps.leftContainer.height;
    var charHeight = this.props.charHeight;
    var gridWidth = 16; // TODO: make customizable
    var props = this.props;
    var dom = this.dom;

    var zeroAlign = false;

    function formattingFunction (value) {
      return String(value);
    }

    // FIXME: the max determined by DataScale is sometimes larger than provided yMax
    this.scale = new DataScale(
        this.props.yMin,
        this.props.yMax,
        this.props.yMin,
        this.props.yMax,
        height,
        charHeight * 2, // we multiply the charHeight as we want to have more whitespace
        zeroAlign,
        formattingFunction);

    var lines = this.scale.getLines();

    // attach to DOM
    if (!this.dom.verticalAxis.parentNode) {
      this.body.dom.left.appendChild(this.dom.verticalAxis)
    }
    if (!this.dom.labelsContainer.parentNode) {
      this.dom.verticalAxis.appendChild(this.dom.labelsContainer)
    }

    // remove all old values
    // TODO: reuse DOM elements
    this._removeDomElements(this.dom.values);
    this._removeDomElements(this.dom.grid);
    this._removeDomElements(this.dom.labels);

    lines.forEach(function (line) {
      var grid = document.createElement('div');
      grid.className = 'timeblocks-grid-line ' + (line.major ? 'vis-major' : 'vis-minor');
      grid.style.top = (height - line.y) + 'px';
      grid.style.right = '0';
      grid.style.width = (props.valueWidth + gridWidth) + 'px';
      grid.style.position = 'absolute';

      dom.verticalAxis.appendChild(grid);
      dom.grid.push(grid);

      var value = document.createElement('div');
      value.className = 'timeblocks-grid-value ' + (line.major ? 'vis-major' : 'vis-minor');
      value.appendChild(document.createTextNode(format(line.val)));
      value.style.top = (height - line.y - charHeight / 2 + 1) + 'px';
      value.style.right = '0';
      value.style.position = 'absolute';
      value.style.boxSizing = 'border-box';

      dom.verticalAxis.appendChild(value);
      dom.values.push(value);
    });

    if (this.labelsData) {
      var scale = this.scale;
      var contentToHTML = this._contentToHTML;

      this.labelsData.forEach(function (data) {
        var yMin = height - scale.convertValue(data.yMin);
        var yMax = height - scale.convertValue(data.yMax);

        var contents = document.createElement('div');
        contents.className = 'timeblocks-contents';
        contents.appendChild(contentToHTML(data.content));

        var label = document.createElement('div');
        label.className = 'timeblocks-label';
        label.appendChild(contents);
        label.title = data.title || '';

        label.style.top = yMin + 'px';
        label.style.height = (yMax - yMin) + 'px';
        label.style.position = 'absolute';
        label.style.boxSizing = 'border-box';

        dom.labelsContainer.appendChild(label);
        dom.labels.push(label);
      })
    }

    // determine the width of the labels
    var labelsWidth = this.props.labelsWidth;
    if (labelsWidth === null) {
      labelsWidth = this.dom.labelsContainer.clientWidth;
      this.props.labelsWidth = labelsWidth;
    }

    // determine the width of the axis (after we've appended all childs)
    var valueWidth = 0;
    dom.values.forEach(function (value) {
      if (value.offsetWidth > valueWidth) {
        valueWidth = value.offsetWidth;
      }
    });
    this.props.valueWidth = valueWidth;

    // var gridWidth = dom.grid[0] && dom.grid[0].clientWidth || 0;
    var width = valueWidth + gridWidth + labelsWidth;
    resized = resized || (this.props.width !== width);
    this.props.width = width;

    // calculate char size
    this.props.charHeight = dom.values[0] && dom.values[0].clientHeight || 24;

    // apply width
    this.dom.verticalAxis.style.width = width + 'px';

    return resized;
  };


  BlockGraph.prototype._redrawItems = function () {
    // attach to DOM
    if (!this.dom.items.parentNode) {
      this.body.dom.center.appendChild(this.dom.items)
    }

    // TODO: reuse existing items
    this._removeDomElements(this.dom.items);

    if (this.itemsData) {
      var height = this.body.domProps.leftContainer.height;
      var toScreen = this.body.util.toScreen;
      var scale = this.scale;
      var dom = this.dom;
      var contentToHTML = this._contentToHTML;

      // TODO: filter on visible items and render only these
      this.itemsData.forEach(function (data) {
        var start = toScreen(util.convert(data.start, 'Date'));
        var end = toScreen(util.convert(data.end, 'Date'));
        var yMin = height - scale.convertValue(data.yMin);
        var yMax = height - scale.convertValue(data.yMax);

        var item = document.createElement('div');
        item.className = 'timeblocks-item';
        item.appendChild(contentToHTML(data.content));
        item.title = data.title || '';

        item.style.left = start + 'px';
        item.style.width = (end - start) + 'px';
        item.style.top = yMin + 'px';
        item.style.height = (yMax - yMin) + 'px';
        item.style.position = 'absolute';
        item.style.boxSizing = 'border-box';

        dom.items.appendChild(item);
        dom.values.push(item);
      });
    }

    this.dom.items.style.height = height + 'px';

    resized = false;
    return resized;
  };


  BlockGraph.prototype.setItems = function (items) {
    var oldItemsData = this.itemsData;

    // replace the dataset
    if (!items) {
      this.itemsData = null;
    }
    else if (items instanceof DataSet || items instanceof DataView) {
      this.itemsData = items;
    }
    else {
      throw new TypeError('Items must be an instance of DataSet or DataView');
    }

    if (oldItemsData) {
      // unsubscribe from old dataset
      oldItemsData.off('*', this._update);
    }

    if (this.itemsData) {
      // subscribe to new dataset
      this.itemsData.on('*', this._update); // listen to the events add, update, remove

      this._updateMinMax();
    }
  };

  BlockGraph.prototype.setLabels = function (labels) {
    var oldLabelsData = this.labelsData;

    // replace the dataset
    if (!labels) {
      this.labelsData = null;
    }
    else if (labels instanceof DataSet || labels instanceof DataView) {
      this.labelsData = labels;
    }
    else {
      throw new TypeError('Labels must be an instance of DataSet or DataView');
    }

    if (oldLabelsData) {
      // unsubscribe from old dataset
      oldLabelsData.off('*', this._update);
    }

    if (this.labelsData) {
      // subscribe to new dataset
      this.labelsData.on('*', this._update); // listen to the events add, update, remove

      this._updateMinMax();
    }
  };

  /**
   * helper function to remove a list of DOM elements. Array will be emptied
   * @param {Array} array
   * @private
   */
  BlockGraph.prototype._removeDomElements = function (array) {
    while (array.length > 0) {
      var elem = array.pop();
      elem.parentNode.removeChild(elem)
    }
  };

  /**
   * Convert contents to HTML if needed
   * @param {string | Element} content
   * @private
   */
  BlockGraph.prototype._contentToHTML = function (content) {
    if (content instanceof Element) {
      return content;
    }
    else if (content != undefined) {
      return document.createTextNode(content)
    }
    else {
      throw new Error('Property "content" missing');
    }
  };

  /**
   * Format a number. Prevents displaying round off errors
   * @param {number | string} number
   * @return {string} Returns the formatted number
   */
  function format (number) {
    if (typeof number === 'string') {
      return parseFloat(parseFloat(number).toPrecision(12)) + '';
    }
    else { // assume typeof number === 'number'
      return parseFloat(number.toPrecision(12)) + '';
    }
  }

  return TimeBlocks
})();