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

var chan, options, spinner, spinnerEl;

options = {
  // Show/hide a button to download the summary?
  'showDownloadSummary': true,
  // How do we show the matches?
  // [full] - show all summary fields in the table
  // [slim] - show only a symbol and provide more info in a popover
  'matchViewStrategy': 'full'
};

spinner = new Spinner({
  color: '#000',
  top: '250px',
  radius: 100,
  length: 100,
  width: 50,
  lines: 12
});

spinnerEl = document.getElementById('spinner');
spinner.spin();
spinnerEl.appendChild(spinner.el);

chan = Channel.build({
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

chan.bind('init', function (trans, params) {
  var request = params.request;
  var service = imjs.Service.connect(params.service);

  var jobbing = service.resolveIds(request);

  jobbing.then(function (job) {
    job.poll().then(withResults)
              .then(job.del, job.del); // Always clean up.
  });

  function withResults (results) {
    var mr400 = require('component-400');

    mr400({
      data: results,
      el: document.getElementById('id-resolver'),
      cb: handleIds,
      portal: portal,
      options: options
    });

  }

  function handleIds (objectIds) {
    chan.notify({
      method: 'wants',
      params: {
        what: 'list',
        data: {
          objectIds: objectIds,
          type: request.type,
          service: {
            root: service.root
          }
        }
      }
    });
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

