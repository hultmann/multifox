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
 * Portions created by the Initial Developer are Copyright (C) 2012
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

"use strict";

// workaround to allow uninstalling a frame script (stopTab)
Object.defineProperty(this, "initMultifox", {
  configurable: true, // allow delete
  enumerable: true,
  get: function() {
    return function(Cu, Ci, Cc, m_global) {

Cu.import("resource://gre/modules/Services.jsm");


function onNewDocument(evt) { // DOMWindowCreated handler
  var doc = evt.target;
  var win = doc.defaultView;
  var utils = getDOMUtils(win);

  var msgData = {
    msg: "new-doc",
    // TODO host: win.location.hostname,
    url: doc.location.href,
    inner:       utils.currentInnerWindowID,
    outer:       utils.outerWindowID,
    parentOuter: -1,
    parentInner: -1
  };


  if (win !== win.top) {
    var u = getDOMUtils(win.parent);
    msgData.parentOuter = u.outerWindowID; // TODO useless, inner is enough
    msgData.parentInner = u.currentInnerWindowID;
    msgData.parentUrl   = win.parent.location.href; // to fix pending objs // TODO only for url=""/about:blank?
  }
  if (win.frameElement) {
    msgData["x-frameElement.src"] = win.frameElement.src; // TODO
  }

  if (win.opener !== null) {
    // OBS opener=null for middle clicks. It works for target=_blank links, even for different domains
    var util2 = getDOMUtils(win.opener);
    msgData.openerOuter = util2.outerWindowID; //  // TODO useless, inner is enough
    msgData.openerInner = util2.currentInnerWindowID;
    msgData.openerUrl   = win.opener.location.href; // to fix pending objs
  }

  if (m_src !== null) {
    // TODO sendSyncMessage=undefined ==> disabled extension or exception in the parent process
    if ((sendSyncMessage("multifox-remote-msg", msgData)[0]) !== null) {
      // TODO check if multifox should be disabled for this browser
      initDoc(win);
    }
    return;
  }

  // ask for source
  msgData["initBrowser"] = true; // TODO "init-tab"
  var rv = sendSyncMessage("multifox-remote-msg", msgData)[0];
  if (rv !== null) {
    startTab(rv);
    initDoc(win);
  }
}


function startTab(msgData) {
  m_nameSentByChrome  = msgData.sentByChrome;
  m_nameSentByContent = msgData.sentByContent;
  m_src = msgData.src + "initContext(window, document, '" +
                                     m_nameSentByChrome + "','" +
                                     m_nameSentByContent + "');"; // TODO send src concatenated
  addEventListener(m_nameSentByContent, onContentCustomEvent, false, true); // untrusted event!
}


function stopTab(src) {
  function forEachWindow(fn, win) {
    fn(win, src);
    for (var idx = win.length - 1; idx > -1; idx--) {
      forEachWindow(fn, win[idx]);
    }
  }

  forEachWindow(resetDoc, content);
  removeMessageListener("multifox-parent-msg", onParentMessage);
  removeEventListener("DOMWindowCreated", onNewDocument, false);
  removeEventListener(m_nameSentByContent, onContentCustomEvent, false);
  m_src = null;
  console.assert("initMultifox" in m_global, "stopTab fail m_global")
  var removed = delete m_global["initMultifox"];
  console.assert(removed, "stopTab fail")
  console.log("stopTab OK");
}


function initDoc(win) {
  var sandbox = Cu.Sandbox(win, {sandboxName: "multifox-content"});
  sandbox.window   = XPCNativeWrapper.unwrap(win);
  sandbox.document = XPCNativeWrapper.unwrap(win.document);

  try {
    Cu.evalInSandbox(m_src, sandbox);
  } catch (ex) {
    var msgData = {
      msg: "error",
      err: ex.toString(),
      innerId: getDOMUtils(win).currentInnerWindowID,
      url: win.document.location.href
    };
    msgData.topUrl = win !== win.top ? win.top.document.location.href : "";
    sendAsyncMessage("multifox-remote-msg", msgData);
  }
}


function resetDoc(win, src) {
  var sandbox = Cu.Sandbox(win, {sandboxName: "multifox-content-reset"});
  sandbox.window = XPCNativeWrapper.unwrap(win);
  sandbox.document = XPCNativeWrapper.unwrap(win.document);

  try {
    Cu.evalInSandbox(src, sandbox);
  } catch (ex) {
    var msgData = {
      msg:     "error",
      err:     ex.toString(),
      innerId: getDOMUtils(win).currentInnerWindowID,
      url:     win.location.href
    };
    msgData.topUrl = win !== win.top ? win.top.location.href : "";
    sendAsyncMessage("multifox-remote-msg", msgData);
  }
}


function onContentCustomEvent(evt) {
  var doc = evt.target;
  var win = doc.defaultView;

  var msgData = evt.detail;
  msgData.top = win === win.top; // TODO not used anymore?
  msgData.parent = win === win.top ? null : win.parent.location.href;
  msgData.url = doc.location.href;

  var winutils = getDOMUtils(win);
  msgData.outer = winutils.outerWindowID; // TODO useless, inner is enough
  msgData.inner = winutils.currentInnerWindowID;

  var remoteObj = sendSyncMessage("multifox-remote-msg", msgData)[0];
  if (remoteObj !== null) {
    // send remote data to page (e.g. cookie value)
    var evt = doc.createEvent("CustomEvent");
    evt.initCustomEvent(m_nameSentByChrome, true, true, remoteObj.responseData);
    doc.dispatchEvent(evt);
  }
}


function onParentMessage(message) {
  switch (message.json.msg) {
    case "disable-extension":
      stopTab(message.json.src);
      break;
    case "tab-data":
      startTab(message.json);
      break;
    case "get-tab-hosts":
      var msgData = {
        msg:   "all-tab-hosts",
        hosts: getSupportedUniqueHosts(content)
      };
      sendAsyncMessage("multifox-remote-msg", msgData);
      break;
    default:
      throw new Error("onParentMessage " + message.json.msg);
  }
}


function getDOMUtils(win) {
  return win.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowUtils);
}


function _getSupportedUniqueHosts(win, rv) {
  var scheme = win.location.protocol;
  if ((scheme === "http:") || (scheme === "https:")) {
    var host = win.location.hostname;
    if (rv.indexOf(host) === -1) {
      rv.push(host);
    }
  }
  for (var idx = win.length - 1; idx > -1; idx--) {
    _getSupportedUniqueHosts(win[idx], rv); // check iframes
  }
}


function getSupportedUniqueHosts(win) {
  var hosts = [];
  _getSupportedUniqueHosts(win, hosts);
  return hosts;
}


var console = {
  log: function(msg) {
    var now = new Date();
    var ms = now.getMilliseconds();
    var ms2;
    if (ms < 100) {
      ms2 = ms < 10 ? "00" + ms : "0" + ms;
    } else {
      ms2 = ms.toString();
    }
    var p = "${CHROME_NAME}[" + now.toLocaleFormat("%H:%M:%S") + "." + ms2 + "] ";

    var len = arguments.length;
    var msg = len > 1 ? Array.prototype.slice.call(arguments, 0, len).join(" ")
                      : arguments[0];
    Services.console.logStringMessage(p + msg);
  },

  assert: function(test, msg) {
    if (test !== true) {
      var ex =  new Error("console.assert - " + msg + " - " + test);
      Cu.reportError(ex); // workaround - sometimes exception doesn't show up in console
      console.trace("console.assert()");
      throw ex;
    }
  }
};


function checkState() {
  if (content.location.href === "about:blank") {
    return;
  }
  // is extension being installed/enabled/updated?
  // we need to initialize tab ASAP to keep current documents working
  // data will be received by onParentMessage
  console.log("checkState ok", content.location.href);
  var msgData = {
    msg:   "send-inj-script",
    hosts: getSupportedUniqueHosts(content)
  };
  sendAsyncMessage("multifox-remote-msg", msgData);
}

var m_src = null;
var m_nameSentByChrome = null;
var m_nameSentByContent = null;

addMessageListener("multifox-parent-msg", onParentMessage);
addEventListener("DOMWindowCreated", onNewDocument, false);
checkState();


    }
  }
});


try {
  // this=ContentFrameMessageManager
  this.initMultifox(Components.utils, Components.interfaces, Components.classes, this);
} catch (ex) {
  Components.utils.reportError(ex);
}
