var chan = Channel.build({
  window: document.getElementById("child").contentWindow,
  origin: "*",
  scope: "CurrentStep"
});

var root = "http://www.flymine.org/query/service";

chan.call({
  method: 'configure',
  params: {
    matchViewStrategy: 'full'
  },
  success: function () {
    console.log("Configured");
  }
});

chan.bind('has-ids', function (trans, data) {
  console.log("HAS IDS!!");
  handleIds(data.objectIds);
});

chan.bind('wants', function (trans, data) {
  console.log("Wants a list", data);
});

chan.bind('has-item', function (trans, data) {
  console.log("HAS ITEM!!");
  portal(data.object);
});

getJSON(root + "/session", function withSession (response) {

  chan.call({
    method: "init",
    params: {
      service: {
        root: root,
        token: response.token
      },
      request: {
        type: 'Gene',
        extra: 'D. melanogaster',
        caseSensitive: false,
        identifiers: [
          'CG9151',
          'FBgn0000099',
          'CG3629',
          'TfIIB',
          'Mad',
          'CG1775',
          'CG2262',
          'TWIST_DROME',
          'tinman',
          'runt',
          'E2f',
          'CG8817',
          'FBgn0010433',
          'CG9786',
          'CG1034',
          'ftz',
          'FBgn0024250',
          'FBgn0001251',
          'tll',
          'CG1374',
          'CG33473',
          'ato',
          'so',
          'CG16738',
          'tramtrack',
          'CG2328',
          'gt'
        ]
      }
    },
    success: function() {
      console.log("Tool initialised");
    }
  });
});

function getJSON (url, cb) {
  var sessionRequest = new XMLHttpRequest();
  var handler = function (e) { cb(sessionRequest.response); };

  sessionRequest.onload = handler;
  sessionRequest.open('GET', url, true);
  sessionRequest.responseType = 'json';

  sessionRequest.send();
}

function handleIds (objectIds) {
  console.log("These ones:", objectIds);
}

function portal (object, el) {
  console.log("Thinking with portals", object);
}
