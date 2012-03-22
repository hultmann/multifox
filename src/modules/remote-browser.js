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


(function(Cu) {

Cu.import("resource://gre/modules/Services.jsm");


function customDoc(evt) { // DOMWindowCreated handler
  var doc = evt.target;
  var win = doc.defaultView;

  var msgData = {
    msg: "new-doc",
    url: doc.location.href,
    top: win === win.top
  };

  if (msgData.url.length === 0) {
    return; // it happens sometimes (it doesn't seem to be a real document)
  }

  if (m_src !== null) {
    if ((sendSyncMessage("multifox-remote-msg", msgData)[0]) !== null) {
      initDoc(win);
    }
    return;
  }

  // ask for source
  msgData.initBrowser = true;
  var rv = sendSyncMessage("multifox-remote-msg", msgData)[0];
  if (rv !== null) {
    m_nameSentByChrome  = rv.sentByChrome;
    m_nameSentByContent = rv.sentByContent;
    m_src = rv.src + "initContext(window, document, '" +
                     m_nameSentByChrome + "','" +
                     m_nameSentByContent + "');";
    addEventListener(m_nameSentByContent, onContentCustomEvent, false, true); // untrusted event!
    initDoc(win);
  }
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
      url: win.document.location.href
    };
    msgData.topUrl = win !== win.top ? win.top.document.location.href : "";
    sendAsyncMessage("multifox-remote-msg", msgData);
  }
}


function onContentCustomEvent(evt) {
  var doc = evt.target;
  var win = doc.defaultView;

  var msgData = evt.detail;
  msgData.top = win === win.top;
  msgData.url = doc.location.href;

  var remoteObj = sendSyncMessage("multifox-remote-msg", msgData)[0];
  if (remoteObj !== null) {
    // send remote data to page (e.g. cookie value)
    var evt = doc.createEvent("CustomEvent");
    evt.initCustomEvent(m_nameSentByChrome, true, true, remoteObj.responseData);
    doc.dispatchEvent(evt);
  }
}


function shutdown(data) {
  removeMessageListener("multifox-shutdown", shutdown);
  removeEventListener("DOMWindowCreated", customDoc, false);
  if (m_src === null) {
    return;
  }
  removeEventListener(m_nameSentByContent, onContentCustomEvent, false);
  m_src = null;
  m_nameSentByChrome = null;
  m_nameSentByContent = null;
}

var m_src = null;
var m_nameSentByChrome = null;
var m_nameSentByContent = null;

addMessageListener("multifox-shutdown", shutdown);
addEventListener("DOMWindowCreated", customDoc, false);

})(Components.utils);
