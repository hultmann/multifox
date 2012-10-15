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
 * Portions created by the Initial Developer are Copyright (C) 2011
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


var SubmitObserver = {
  start: function() {
    Services.obs.addObserver(this, "earlyformsubmit", false);
  },

  stop: function() {
    Services.obs.removeObserver(this, "earlyformsubmit");
  },

  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFormSubmitObserver]),

  notify: function (form, win, actionURI, cancelSubmit) {
    console.assert(form.ownerDocument.defaultView === win, "form.ownerDocument.defaultView != win");
    this._notify(form, win);
    return true;
  },

  _notify: function(form, win) {
    if (form.method.toUpperCase() !== "POST") {
      return;
    }

    if (isSupportedScheme(win.location.protocol) === false) {
      return;
    }

    var tab = WindowParents.getTabElement(win);
    if (tab === null) {
      return null; // chrome form?
    }

    if (countPasswordFields(form, true) === 0) {
      return; // no password provided => not a login form
    }

    var username = findUserName(form);
    if (username === null) {
      console.log("SubmitObserver: NOP, username not found, confirm pw form?");
      WinMap.loginSubmitted(win, "pw");
      return; // TODO username = "random" or error message (icon);
    }

    var tldDoc = getTldFromHost(win.location.hostname);
    var tabId = getDOMUtils(win.top).outerWindowID;
    var currentDocUser = WinMap.getUserFromDocument(Services.io.newURI(win.location.href, null, null), tabId, false);

    var userId = new UserId(StringEncoding.encode(username), StringEncoding.encode(tldDoc));
    var docUser = new DocumentUser(userId, tldDoc, tabId);
    WinMap.setUserForTab(docUser, tabId);
    WinMap.loginSubmitted(win, "login");

    if (UserUtils.isAnon(currentDocUser)) {
      // TODO apply sandbox right now (all iframes)
      // TODO clear 3rd party?
      copyData_fromDefault(tldDoc, docUser);
    } else {
      copyDataToAnotherUser(tldDoc, docUser, currentDocUser);
    }
    updateUIAsync(tab, true); // TODO remove current ID now, new doc will update it // BUG doesn't it load a new doc? eg: l10n dashboard
    tab.setAttribute("multifox-logging-in", "true"); // activate transition
  }

};


function copyDataToAnotherUser(tabTld, newLogin, prevLogin) {
  console.assert(prevLogin.user.encodedTld === newLogin.user.encodedTld, "copyDataToAnotherUser tld");
  console.assert(tabTld === prevLogin._ownerDocTld, "anon");
  if (prevLogin.equals(newLogin)) { // TODO do not test tabId
    return; // same user, do nothing
  }

  var tld = prevLogin.appendLogin(tabTld);
  // don't remove data from current user, it may contain data used by other apps
  // some cookies may be unrelated to this login
  var all = getAllCookiesFromHost(tld); // BUG ignore anon cookies?
  //var all = removeTldData_cookies(tld);

  console.log("copyDataToAnotherUser", tabTld, all.length, "cookies.", prevLogin.toString(), newLogin.toString());
  var cookie;
  var realHost;
  for (var idx = all.length - 1; idx > -1; idx--) {
    cookie = all[idx];
    realHost = UserUtils.getRealHost(cookie.host);
    if (realHost !== null) {
      copyCookieToNewHost(cookie, newLogin.appendLogin(realHost));
    }
  }

  //var all2 = removeTldData_LS(tld);
}


// isolate cookies from domain
function copyData_fromDefault(domain, docUser) { // BUG if tabLogin.plainUser="" -> NewAccount // TODO domain=>tld
  var all = getAllCookiesFromHost(domain);
  //var all = removeTldData_cookies(domain);

  console.log("copyData_fromDefault 1", domain, docUser, "cookies:", all.length);
  var cookie;
  for (var idx = all.length - 1; idx > -1; idx--) {
    cookie = all[idx];
    copyCookieToNewHost(cookie, docUser.appendLogin(cookie.host));
  }

  console.log("copyData_fromDefault 3");
  var all2 = removeTldData_LS(domain);
  console.log("/copyData_fromDefault");
}


function countPasswordFields(form, populatedOnly) {
  var qty = 0;
  var all = form.elements;
  var INPUT = Ci.nsIDOMHTMLInputElement;
  for (var idx = all.length - 1; idx > -1; idx--) {
    var elem = all[idx];
    if ((elem instanceof INPUT) && (elem.type === "password")) {
      if (isElementVisible(elem)) {
        if (populatedOnly && (elem.value.trim().length === 0)) {
          continue;
        }
        qty++;
      }
    }
  }
  return qty;
}


function findUserName(form) {
  console.log("findUserName");
  var INPUT = Ci.nsIDOMHTMLInputElement;
  var lastTextField = null;
  var all = form.elements;
  var elem;

  for (var idx = 0, len = all.length; idx < len; idx++) {
    elem = all[idx];
    if ((elem instanceof INPUT) === false) {
      continue;
    }
    switch (elem.type) {
      case "text":
      case "email":
      case "url":
      case "tel":
      case "number":
      case "password":
        break;
      default:
        continue;
    }
    if ((elem.value.trim().length === 0) || isElementVisible(elem) === false) {
      // ignore empty/hidden fields
      console.log("findUserName", "element ignored", elem.name);
      continue;
    }
    if (elem.type === "password") {
      if (lastTextField !== null) {
        return lastTextField;
      }
    } else {
      lastTextField = elem.value;
      console.log("findUserName", "found", lastTextField);
    }
  }
  return lastTextField;
}


function isElementVisible(elem) {
  // some elements with display:none/visibility:hidden are already removed from form
  var win = elem.ownerDocument.defaultView;
  var val = win.getComputedStyle(elem, "").getPropertyValue("visibility");
  console.assert(val === "visible", "visibility", val);
  console.log("isElementVisible", "getBoundingClientRect().width " + elem.getBoundingClientRect().width, typeof elem.getBoundingClientRect().width, elem.tagName, elem.type, " name:" + elem.name);

  return elem.getBoundingClientRect().width > 0;
}
