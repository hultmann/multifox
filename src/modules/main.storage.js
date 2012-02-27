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
    default:
      throw new Error("onContentEvent: " + obj.from);
  }

  if (rv === undefined) {
    // no response
    return;
  }

  // send data to content
  var evt2 = contentDoc.createEvent("MessageEvent");
  evt2.initMessageEvent(DocOverlay.eventNameSentByChrome, false, false, rv, null, null, null);
  var success = contentDoc.dispatchEvent(evt2);
}


function windowLocalStorage(obj, contentDoc) {
  var tabLogin = getJsCookieLogin(contentDoc.defaultView);
  var uri = tabLogin.formatUri(contentDoc.documentURIObject);

  var principal = Cc["@mozilla.org/scriptsecuritymanager;1"]
                  .getService(Ci.nsIScriptSecurityManager)
                  .getCodebasePrincipal(uri);

  var storage = Cc["@mozilla.org/dom/storagemanager;1"]
                .getService(Ci.nsIDOMStorageManager)
                .getLocalStorageForPrincipal(principal, "");

  var rv = undefined;
  switch (obj.cmd) {
    case "clear":
      storage.clear();
      break;
    case "removeItem":
      storage.removeItem(obj.key);
      break;
    case "setItem":
      storage.setItem(obj.key, obj.val); // BUG it's ignoring https
      break;
    case "getItem":
      rv = storage.getItem(obj.key);
      break;
    case "key":
      rv = storage.key(obj.index);
      break;
    case "length":
      rv = storage.length;
      break;
    default:
      throw new Error("localStorage interface unknown: " + obj.cmd);
  }

  return rv;
}


function documentCookie(obj, contentDoc) {
  switch (obj.cmd) {
    case "set":
      documentCookieSetter(obj, contentDoc);
      return undefined;
    case "get":
      var rv = "foo";
      try {
        rv = documentCookieGetter(obj, contentDoc);
        return rv;
      } catch (ex) {
        console.trace(ex);
      }
      break;
    default:
      throw new Error("documentCookie " + obj.cmd);
  }
}


function documentCookieSetter(obj, contentDoc) {
  // tabLogin can be anon and the new tabLogin can be a different login (e.g. facebook iframe)
  var tabLogin = getJsCookieLogin(contentDoc.defaultView);
  console.assert(tabLogin.isLoggedIn, "documentCookieSetter not logged in=" + tabLogin.toString()); // login cancelado, mas document já foi interceptado
  Cookies.setCookie(tabLogin, contentDoc.documentURIObject, obj.value, true);
}


function documentCookieGetter(obj, contentDoc) {
  var tabLogin = getJsCookieLogin(contentDoc.defaultView);
  console.assert(tabLogin.isLoggedIn, "documentCookieGetter not logged=" + tabLogin.toString() + "," + contentDoc.documentURI);

  var cookie2 = Cookies.getCookie(true, contentDoc.documentURIObject, tabLogin);
  var cookie = cookie2 === null ? "" : cookie2;
  return cookie; // send cookie value to content
}


function getJsCookieLogin(domWin) { // getJsMethodLogin
  // tabLogin can be anon and the new tabLogin can be a different login (e.g. domWin=facebook iframe)
  var tabLogin = TabLoginHelper.getFromDomWindow(domWin);
  console.assert(tabLogin !== null, "is contentDoc not from a tab?");

  if (isTopWindow(domWin)) {
    if (tabLogin.isLoginInProgress) {
      if (tabLogin.hasLoginInProgressMoveData) {
        // data already moved to new user
        tabLogin = TabLoginHelper.getLoginInProgress(tabLogin.tabElement);
      }
    }
    return tabLogin;
  }


  // domWin=iframe


  if (tabLogin.isLoginInProgress) {
    if (tabLogin.hasLoginInProgressMoveData) {
      return TabLoginHelper.getLoginInProgress(tabLogin.tabElement);
    } else {
      return tabLogin;
    }
  }


  var tld = getTldFromHost(domWin.document.location.hostname);
  var iframeLogin = LoginDB.getDefaultLogin(tld, tabLogin);
  if (iframeLogin !== null) {
    return iframeLogin;

  } else {
    // iframe tld is not a logged in tab ==> third party iframe
    console.log("getJsCookieLogin - executing method from anon iframe", tld, "- top", domWin.top.document.location);
    // BUG qdo google pergunta soh a senha, começa a validar youtube etc, mas nao ha logininprogress e login falha
    return tabLogin.toAnon();
  }
}
