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
 * Portions created by the Initial Developer are Copyright (C) 2010
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

function initContext(win, doc, sentByChrome, sentByContent) {

  function sendCmd(obj) {
    var evt = doc.createEvent("MessageEvent");
    evt.initMessageEvent(sentByContent, true, true, JSON.stringify(obj), null, null, null);
    doc.dispatchEvent(evt);
  }

  function sendCmdRv(obj) {
    var rv = null;
    function chromeListener(evt) {
      rv = evt.data;
      evt.stopPropagation();
    };
    win.addEventListener(sentByChrome, chromeListener, true);
    sendCmd(obj); // set rv
    win.removeEventListener(sentByChrome, chromeListener, true);
    return rv;
  }


  doc.__defineSetter__("cookie", function(jsCookie) {
    sendCmd({from:"cookie", cmd:"set", value:jsCookie});
  });

  doc.__defineGetter__("cookie", function() {
    var rv = sendCmdRv({from:"cookie", cmd:"get"});
    return rv === null ? "multifox=error!" : rv;
  });

  win.__defineGetter__("localStorage", function() {
    function setItemCore(k, v) {
      sendCmd({from:"localStorage", cmd:"setItem", key:k, val:v});
      custom[k] = v;
    }

    var custom = {
      setItem: function(k, v) {setItemCore(k, v);},
      removeItem: function(k) {sendCmd({from:"localStorage", cmd:"removeItem", key:k});},
      clear: function() {      sendCmd({from:"localStorage", cmd:"clear"});},
      getItem: function(k) {return sendCmdRv({from:"localStorage", cmd:"getItem", key:k});},
      key: function(idx) {  return sendCmdRv({from:"localStorage", cmd:"key", index:idx});},
      get length() {        return sendCmdRv({from:"localStorage", cmd:"length"});}
    };

    win.__defineGetter__("localStorage", function() {return custom;});

    // copy current keys/values to object
    for (var idx = 0; idx < custom.length; idx++) {
      var k = custom.key(idx);
      custom[k] = custom.getItem(k);
    }

    // not supported message
    sendCmd({from:"error", cmd:"localStorage"});

    return custom;
  });

  win.__defineGetter__("globalStorage", function() {
    sendCmd({from:"error", cmd:"globalStorage"});
    return null;
  });

}
