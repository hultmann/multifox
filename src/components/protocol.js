/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


"use strict";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");


function AboutMultifox() {}

AboutMultifox.prototype = {
  classDescription: "about multifox",
  contractID: "${XPCOM_ABOUT_CONTRACT}",
  classID: Components.ID("${XPCOM_ABOUT_CLASS}"),

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIAboutModule]),
  getURIFlags: function(aURI) {
    return Components.interfaces.nsIAboutModule.ALLOW_SCRIPT;
  },
  newChannel: function(aURI) {
    Components.utils.import("resource://gre/modules/Services.jsm");
    var channel = Services.io.newChannel("${PATH_CONTENT}/about-multifox.html", null, null);
    channel.originalURI = aURI;
    return channel;
  }
};



function Startup() {}

Startup.prototype = {
  classDescription: "multifox bg",
  contractID: "${XPCOM_STARTUP_CONTRACT}",
  classID: Components.ID("${XPCOM_STARTUP_CLASS}"),
  _xpcom_categories: [{category: "profile-after-change"}],

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver]),
  observe: function(subject, topic, data) {
    if (topic === "profile-after-change") {
      var ns = {};
      Components.utils.import("${PATH_MODULE}/new-window.js", ns);
      ns.init();
    }
  }
};


var NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutMultifox, Startup]);
