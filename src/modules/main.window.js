/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Multifox.
 *
 * The Initial Developer of the Original Code is
 * Jeferson Hultmann <hultmann@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var m_runner = null;

const BrowserWindow = {

  register: function(win) {
    var profileId = Profile.getIdentity(win);

    if (profileId === Profile.DefaultIdentity) {
      util.log("BrowserWindow.register NOP");
      return;
    }

    util.log("BrowserWindow.register " + profileId);

    if (m_runner === null) {
      // first multifox window!
      m_runner = new MultifoxRunner();
    }


    win.addEventListener(m_runner.eventSentByContent, onContentEvent, false, true);

    // some MultifoxContentEvent_* listeners are not called when
    // there are "unload" listeners with useCapture=true. o_O
    // But they are called if event listener is an anonymous function.
    win.addEventListener("unload", onUnloadChromeWindow, false);


    // restore icon after toolbar customization
    var toolbox = win.document.getElementById("navigator-toolbox");
    toolbox.addEventListener("DOMNodeInserted", customizeToolbar, false);
  },


  // should keep id for session restore?
  unregister: function(win) {
    var idw = Profile.getIdentity(win);
    util.log("BrowserWindow.unregister " + idw);

    if (idw === Profile.DefaultIdentity) {
      // nothing to unregister
      return;
    }


    win.removeEventListener(m_runner.eventSentByContent, onContentEvent, false);

    var sessions = Profile.activeIdentities(win);
    var toolbox = win.document.getElementById("navigator-toolbox");
    toolbox.removeEventListener("DOMNodeInserted", customizeToolbar, false);

    var onlyDefault = (sessions.length === 1) && (sessions[0] === Profile.DefaultIdentity);
    if (onlyDefault) {
      // no more multifox windows
      m_runner.shutdown();
      m_runner = null;
    }
    win.removeEventListener("unload", onUnloadChromeWindow, false);
  }
};


function onUnloadChromeWindow(evt) {
  var win = evt.currentTarget;
  BrowserWindow.unregister(win);
}


function customizeToolbar(evt) {
  var node = evt.target;
  if ((node.id === "urlbar-container") && (node.parentNode.tagName === "toolbar")) {
    updateUI(node.ownerDocument.defaultView);
  }
}


function onContentEvent(evt) {
  evt.stopPropagation();

  var obj = JSON.parse(evt.data);
  var contentDoc = evt.target;
  var rv;

  switch (obj.from) {
    case "cookie":
      rv = documentCookie(obj, contentDoc);
      break;
    case "localStorage":
      rv = windowLocalStorage(obj, contentDoc);
      break;
    case "error":
      Components.utils.import("${URI_JS_MODULE}/error.js");
      showError(contentDoc.defaultView, obj.cmd);
      break;
    default:
      throw obj.from;
  }

  if (rv === undefined) {
    // no response
    return;
  }

  // send data to content
  var evt2 = contentDoc.createEvent("MessageEvent");
  evt2.initMessageEvent(m_runner.eventSentByChrome, false, false, rv, null, null, null);
  var success = contentDoc.dispatchEvent(evt2);
}


function MultifoxRunner() {
  util.log("MultifoxRunner");
  this._sentByChrome  = "multifox-chrome_event-"  + Math.random().toString(36).substr(2);
  this._sentByContent = "multifox-content_event-" + Math.random().toString(36).substr(2);
  this._inject = new DocStartScriptInjection();
  Cookies.start();
  util.networkListeners.enable(httpListeners.request, httpListeners.response);
  // console.assert(m_inject === null, "");
  //toggleDefaultWindowUI(true);
}

MultifoxRunner.prototype = {
  get eventSentByChrome() {
    return this._sentByChrome;
  },

  get eventSentByContent() {
    return this._sentByContent;
  },

  shutdown: function() {
    util.log("MultifoxRunner.shutdown");
    util.networkListeners.disable();
    this._inject.stop();
    Cookies.stop();
    //toggleDefaultWindowUI(false);
  }
};
