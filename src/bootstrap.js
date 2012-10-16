/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

Components.utils.import("resource://gre/modules/Services.jsm");


function install(data, reason) {
  // startup() will register it again, but it doesn't seem to be a problem
  registerResourceProtocol(data.resourceURI);
  Components.utils.import("${PATH_MODULE}/main.js");
  Main.install();
}


// shutdown() is called first
function uninstall(data, reason) {
  if (reason !== ADDON_UNINSTALL) {
    return; // updating
  }

  registerResourceProtocol(data.resourceURI);
  Components.utils.import("${PATH_MODULE}/main.js");

  Main.uninstall();

  Components.utils.unload("${PATH_MODULE}/main.js");
  registerResourceProtocol(null);
}


function startup(data, reason) {
  registerResourceProtocol(data.resourceURI);
  Components.utils.import("${PATH_MODULE}/main.js");
  Main.startup(reason === APP_STARTUP);
}


function shutdown(data, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  Main.shutdown();
  Components.utils.unload("${PATH_MODULE}/main.js");
  registerResourceProtocol(null);
}


// chrome.manifest line:
// resource ext-modules modules/
function registerResourceProtocol(uri) { // null to unregister
  var io = Services.io;
  var module = uri ? io.newURI(uri.resolve("modules/"), null, null) : null;
  io.getProtocolHandler("resource")
    .QueryInterface(Components.interfaces.nsIResProtocolHandler)
    .setSubstitution("${RESOURCE_NAME}", module);
}
