/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


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

    var tab = UIUtils.getLinkedTab(win);
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
