'use strict';

/**
 * Tool for resolving ids.
 *
 * Listens for:
 *   - configure
 *   - init
 * Emits:
 *   - has-ids
 *   - has-item
 */

var options = {
  // Show/hide a button to download the summary?
  'showDownloadSummary': true,
  // How do we show the matches?
  // [full] - show all summary fields in the table
  // [slim] - show only a symbol and provide more info in a popover
  'matchViewStrategy': 'full'
};

window.onload = main;

function main () {

  var spinner = new Spinner({
    color: '#000',
    top: '250px',
    radius: 100,
    length: 100,
    width: 50,
    lines: 12
  });

  var spinnerEl = document.getElementById('spinner');
  spinner.spin();
  spinnerEl.appendChild(spinner.el);

  var chan = Channel.build({
    window: window.parent,
    origin: "*",
    scope: "CurrentStep"
  });

  chan.bind('configure', function (trans, params) {
    if (params.showDownloadSummary) {
      options.showDownloadSummary = params.showDownloadSummary;
    }
    if (params.matchViewStrategy) {
      options.matchViewStrategy = params.matchViewStrategy;
    }
    return 'ok';
  });

  var nameTemplate = _.template(
      '<%= extra %> <%= type %>s (<%= date %>)'
  );

  var TagModel = Backbone.Model.extend({
    idAttribute: 'tag'
  });

  var NameModel = Backbone.Model.extend({

    initialize: function () {
      this.tags = new Backbone.Collection([], {model: TagModel});
      this.listenTo(this.tags, 'add remove reset', function () {
        this.trigger('change:tags change');
      }.bind(this));
    },

    defaults: function () {
      return {
        name: null,
        description: null,
        extra: null,
        type: null
      };
    },

    addTag: function (tag) {
      if (tag) {
        this.tags.add({tag: tag});
      }
    },

    toJSON: function () {
      var data = Backbone.Model.prototype.toJSON.call(this);
      data.tags = this.tags.pluck('tag');
      return data;
    }
  });

  var LONG_TIME = /\d\d:\d\d:\d\d/;
  var LONG_TMZ = /GMT\+\d\d\d\d /;
  var BRACKETS = /[()]/g;

  function readableDate () {
    var d = new Date().toString();
    d = d.replace(LONG_TIME, function (time) {
      return time.split(':').slice(0, 2).join(':');
    });
    d = d.replace(LONG_TMZ, '');
    d = d.replace(BRACKETS, '');
    return d;
  }

  function trim (s) {
    return s.replace(/(^\s+|\s+$)/g, ''); // Trim.
  }

  function generateName (name, extra) {
    var generatedName = nameTemplate({
      type: name,
      extra: extra,
      date: readableDate()
    });
    return trim(generatedName);
  }

  var RESTRICTED = /^im:/;

  var TagController = Backbone.NativeView.extend({

    tagName: 'span',

    className: 'round label',

    initialize: function () {
    },

    template: _.template('<%- tag %> <i class="fa fa-times-circle"></i>'),

    render: function () {
      this.el.innerHTML = this.template(this.model.toJSON());
      if (RESTRICTED.test(this.model.get('tag'))) {
        this.el.classList.add('alert');
      }
      return this;
    },

    events: function () {
      return {'click .fa-times-circle': this.untag};
    },

    untag: function (e) {
      this.model.collection.remove(this.model);
    }

  });

  var ListDetailsController = Backbone.NativeView.extend({

    initialize: function (options) {
      var self = this;
      this._kids = [];
      this.listenTo(this.model, 'change:name change:description change:tags', this.render);
      this.model.addTag(this.model.get('extra'));
      options.service
             .fetchModel()
             .then(
               function (schema) {self.generateListName(schema);},
               function (error) { console.error(error); }
              );
    },

    generateListName: function (schema) {
      var model = this.model;
      var naming = schema.makePath(model.get('type')).getDisplayName();
      naming.then(function (name) {
        if (!model.has('name')) {
          model.set('name', generateName(name, model.get('extra')));
        }
        console.log(model.get('name'));
      }).then(null, console.error.bind(console));
    },

    events: function () {
      return {
        'change [name="listname"]': this.updateName,
        'change [name="description"]': this.updateDesc,
        'click .add-tag': this.addTags
      };
    },

    updateName: function (e) {
      var name = _.first(this.$('form')).listname.value;
      this.model.set('name', name);
    },

    updateDesc: function (e) {
      var desc = _.first(this.$('form')).description.value;
      this.model.set('description', desc);
    },

    addTags: function (e) {
      var tags = _.first(this.$('.new-tag')).value;
      if (!tags) return;
      var model = this.model;
      tags.split(',').forEach(function (tag) {
        model.addTag(trim(tag));
      });
    },

    template: _.template(document.getElementById('name-template').innerHTML),

    render: function () {
      var k, tags;
      while (k = this._kids.pop()) {
        k.remove();
      }
      this.el.innerHTML = this.template(this.model.toJSON());
      tags = _.first(this.$('.active-tags'));
      this.model.tags.each(function (tag) {
        var tagView = new TagController({model: tag});
        tagView.render();
        tags.appendChild(tagView.el);
      });
      return this;
    }

  });

  chan.bind('init', function (trans, params) {
    var request = params.request;
    var service = imjs.Service.connect(params.service);

    service.resolveIds(request).then(withJob).then(
      function () { trans.complete('initialised'); },
      function (e) {
        console.error(e);
        trans.error(e.message);
      }
    );

    return trans.delayReturn(true);

    function withJob (job) {
      return job.poll()
                .then(withResults)
                .then(null, console.error.bind(console))
                .then(job.del, job.del); // Always clean up.
    }

    function withResults (results) {
      var mr400 = require('component-400');
      var details = new NameModel(request);
      var listNameController = new ListDetailsController({
        el: document.getElementById('list-details'),
        service: service,
        model: details
      });
      listNameController.render();

      mr400({
        data: results,
        el: document.getElementById('id-resolver'),
        cb: handleIds(details),
        portal: portal,
        options: options
      });

      return;

    }

    function handleIds (detailsModel) {
      return function (objectIds) {
        chan.notify({
          method: 'wants',
          params: {
            what: 'list',
            data: {
              objectIds: objectIds,
              type: request.type,
              listDetails: detailsModel.toJSON(),
              service: {
                root: service.root
              }
            }
          }
        });
      };
    }

    function portal (object, el) {
      chan.notify({
        method: 'wants',
        params: {
          what: 'item-details',
          data: {
            object: object,
            service: {
              root: service.root
            }
          }
        }
      });
    }

  });
}

