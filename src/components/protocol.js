/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function Startup() {}

Startup.prototype = {
  classDescription: "multifox bg",
  contractID: "@hultmann/multifox/bg;1",
  classID: Components.ID("{56c5d3a5-e39c-4131-af85-ebee4fceb792}"),
  _xpcom_categories: [{category: "profile-after-change"}],

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIObserver]),
  observe: function(subject, topic, data) {
    if (topic === "profile-after-change") {
      Components.utils.import("resource://multifox-modules/main.js");
      Main.startup(true);
    }
  }
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([Startup]);
