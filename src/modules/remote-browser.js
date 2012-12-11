/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// workaround to allow uninstalling a frame script (stopTab)
Object.defineProperty(this, "initMultifox", {
  configurable: true, // allow delete
  enumerable: true,
  get: function() {
    return function(Cu, Ci, Cc, m_global) {

Cu.import("resource://gre/modules/Services.jsm");

#include "console.js"
  console.setAsRemote();

function onNewDocument(evt) { // DOMWindowCreated handler
  var doc = evt.target;
  var win = doc.defaultView;
  var utils = getDOMUtils(win);

  var msgData = {
    msg: "new-doc",
    // TODO host: win.location.hostname,
    url: win.location.href,
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


function startTab(msgData) { // BUG it's being called by a non-tab browser
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
  console.log("stopTab OK", getDOMUtils(content).currentInnerWindowID, content);
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
      url: win.location.href
    };
    msgData.topUrl = win !== win.top ? win.top.location.href : "";
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
  msgData.url = win.location.href;

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
  try { // detect silent exceptions
    switch (message.json.msg) {
      case "disable-extension":
        stopTab(message.json.src);
        break;
      case "tab-data":
        startTab(message.json);
        break;
      default:
        throw new Error("onParentMessage " + message.json.msg);
    }
  } catch(ex) {
    console.error(ex);
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
