/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";


function createMsgPanel(doc) {
  var panel = doc.getElementById("multifox-popup");
  if (panel) {
    //bug
    console.trace("createMsgPanel dup popup " + panel.state);
    panel.hidePopup();
    return panel;
  }

  panel = doc.getElementById("mainPopupSet").appendChild(doc.createElement("panel"));
  panel.setAttribute("id", "multifox-popup");
  panel.setAttribute("type", "arrow");

  var container = panel.appendChild(doc.createElement("vbox"));
  container.style.width = "50ch";

  var but = appendContent(container, panel);

  panel.addEventListener("popupshown", function(evt) {
    but.focus();
  }, false);

  panel.addEventListener("popuphidden", function(evt) {
    panel.parentNode.removeChild(panel);
  }, false);

  return panel;
}


function appendContent(container, panel) {
  var tab = UIUtils.getSelectedTab(container.ownerDocument.defaultView);
  var errorId = tab.getAttribute("multifox-tab-error");
  if (errorId.length === 0) {
    return null;
  }

  var ns = util.loadSubScript("${PATH_MODULE}/error.js");
  return ns.appendErrorToPanel(container, panel);
}


function createLoginsMenu(menupopup, onHidden) {
  menupopup.addEventListener("command", onLoginCommand, false);
  menupopup.addEventListener("click", onLoginMiddleClick, false);
  menupopup.addEventListener("popuphidden", function(evt) {
    if (evt.currentTarget === evt.target) { // bubbled event?
      onHidden();
      menupopup.removeEventListener("command", onLoginCommand, false);
      menupopup.parentNode.removeChild(menupopup);
    }
  }, false);


  var doc = menupopup.ownerDocument;
  var topInnerId = getCurrentTopInnerId(UIUtils.getSelectedTab(doc.defaultView));
  var topInnerData = WinMap.getInnerEntry(topInnerId);

  // list all accounts
  var docUser = "docUserObj" in topInnerData ? topInnerData.docUserObj : null;
  if (docUser !== null) {
    populateUsers(docUser, menupopup);
  }

  // new account
  var newAccount = menupopup.appendChild(doc.createElement("menuitem"));
  newAccount.setAttribute("label", util.getText("icon.user.new.label"));
  newAccount.setAttribute("accesskey", util.getText("icon.user.new.accesskey"));
  newAccount.setAttribute("cmd", "new account");
  if (docUser === null) {
    newAccount.setAttribute("disabled", "true"); // no top logins, 3rd-party only
  } else if (docUser.user.isNewAccount) {
    newAccount.setAttribute("image", "${PATH_CONTENT}/favicon.ico");
    newAccount.className = "menuitem-iconic";
  }

  // list 3rd-party users
  populate3rdPartyUsers(topInnerData.thirdPartyUsers, menupopup);

  // about
  menupopup.appendChild(doc.createElement("menuseparator"));
  var item4 = menupopup.appendChild(doc.createElement("menuitem"));
  item4.setAttribute("label", util.getText("icon.user.about.label", "${EXT_NAME}"));
  item4.setAttribute("accesskey", util.getText("icon.user.about.accesskey"));
  item4.setAttribute("cmd", "about");
}


function populateUsers(docUser, menupopup) {
  var users = LoginDB.getUsers(docUser.encodedDocTld);
  if (users.length === 0) {
    return;
  }

  var doc = menupopup.ownerDocument;

  for (var idx = users.length - 1; idx > -1; idx--) {
    var myUser = users[idx];

    if (docUser.user.equals(myUser)) {
      // current user
      var userMenu = menupopup.appendChild(doc.createElement("menu"));
      userMenu.className = "menu-iconic";
      userMenu.setAttribute("image", "${PATH_CONTENT}/favicon.ico");
      userMenu.setAttribute("label", myUser.plainName);
      if (myUser.encodedTld !== docUser.encodedDocTld) {
        userMenu.setAttribute("tooltiptext", myUser.plainTld);
      }
      var userPopup = userMenu.appendChild(doc.createElement("menupopup"));
      var delItem = userPopup.appendChild(doc.createElement("menuitem"));

      delItem.setAttribute("label", util.getText("icon.user.current.remove.label"));
      delItem.setAttribute("accesskey", util.getText("icon.user.current.remove.accesskey"));
      delItem.setAttribute("cmd", "del user");
      delItem.setAttribute("login-user16", myUser.encodedName);
      delItem.setAttribute("login-tld", myUser.encodedTld);

    } else {
      var usernameItem = menupopup.appendChild(doc.createElement("menuitem"));
      usernameItem.setAttribute("type", "radio");
      usernameItem.setAttribute("label", myUser.plainName);
      usernameItem.setAttribute("cmd", "switch user");
      usernameItem.setAttribute("login-user16", myUser.encodedName);
      usernameItem.setAttribute("login-tld", myUser.encodedTld);
      if (myUser.encodedTld !== docUser.encodedDocTld) {
        usernameItem.setAttribute("tooltiptext", myUser.plainTld);
      }
    }
  }

  menupopup.appendChild(doc.createElement("menuseparator"));
}


function populate3rdPartyUsers(thirdParty, menupopup) {
  var users = [];
  for (var tld in thirdParty) {
    var encTld = StringEncoding.encode(tld);
    // tld may be anon, nut now there is logged in
    if (LoginDB.isLoggedIn(encTld)) {
      users.push(tld);
    }
  }
  if (users.length === 0) {
    return;
  }

  users.sort(function(a, b) {
    return b.localeCompare(a);
  });

  var doc = menupopup.ownerDocument;
  menupopup.appendChild(doc.createElement("menuseparator"));
  var username;
  var tld;
  var user;
  for (var idx = 0, len = users.length; idx < len; idx++) {
    tld = users[idx];
    user = thirdParty[tld];
    username = user.isNewAccount ? util.getText("icon.3rd-party.anon.label")
                                 : user.plainName;
    var item = menupopup.appendChild(doc.createElement("menuitem"));
    item.setAttribute("disabled", "true");
    item.setAttribute("label", tld + " (" + username + ")");
  }
}


function onLoginMiddleClick(evt){
  if ((evt.button !== 1) || (evt.detail !== 1)) {
    // allow only middle clicks/single clicks
    return;
  }

  var menuItem = evt.target;
  switch (menuItem.getAttribute("cmd")) {
    case "switch user":
    case "new account":
      break;
    default:
      return;
  }

  if (menuItem.hasAttribute("disabled") && (menuItem.getAttribute("disabled") === "true")) {
    // ignore disabled items
    return;
  }

  menuItem.parentNode.hidePopup();
  loginCommandCore(menuItem, true);
}


function onLoginCommand(evt){
  loginCommandCore(evt.target, evt.ctrlKey);
}


function loginCommandCore(menuItem, newTab) {
  var win = menuItem.ownerDocument.defaultView;
  var tab = UIUtils.getSelectedTab(win);
  var uri = tab.linkedBrowser.currentURI;
  if (isSupportedScheme(uri.scheme) === false) {
    // Error page:
    // documentURI = about:neterror?e=netTimeout...
    // location    = http://twitter.com/
    return;
  }

  switch (menuItem.getAttribute("cmd")) {
    case "new account":
      var tabTld = getTldFromHost(uri.host);
      console.log("removeTldData_cookies", tabTld);
      removeTldData_cookies(tabTld);
      removeTldData_LS(tabTld);
      var docUser = WinMap.getFirstPartyUser(getCurrentTopInnerId(tab));
      loadTab(newTab, tab, docUser.user.toNewAccount());
      break;

    case "switch user":
      var encUser = menuItem.getAttribute("login-user16");
      var encTld = menuItem.getAttribute("login-tld");
      loadTab(newTab, tab, new UserId(encUser, encTld));
      break;

    case "del user":
      var userId = new UserId(menuItem.getAttribute("login-user16"),
                              menuItem.getAttribute("login-tld"));
      removeCookies(CookieUtils.getUserCookies(userId));
      UserState.removeUserFromCurrentDocuments(getTldFromHost(uri.host), userId);
      loadTab(newTab, tab, userId.toNewAccount());
      break;

    case "about":
      openNewTab("about:multifox", win);
      break;

    default:
      console.trace();
      throw new Error("loginCommandCore:" + menuItem.getAttribute("cmd"));
  }
}


function loadTab(newTab, tab, user) {
  var browser = tab.linkedBrowser;
  var uri = browser.currentURI;
  var tldDoc = getTldFromHost(uri.host);

  if (newTab) {
    LoginDB.setDefaultUser(StringEncoding.encode(tldDoc), user); // BUG should twitpic set twitter as well?
    openNewTab(uri.spec, tab.ownerDocument.defaultView);
  } else {
    WinMap.setUserForTab(getIdFromTab(tab), tldDoc, user);
    updateUIAsync(tab, true); // show new user now, don't wait for new dom // BUG it doesn't working
    // don't use browser.reload(), it would reload POST requests
    browser.loadURIWithFlags(uri.spec, Ci.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE);
  }
}


function openNewTab(url, win) {
  var uri = Services.io.newURI(url, null, null);
  var where = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
  var win2 = win.browserDOMWindow.openURI(uri, null, where, 0); // TODO open tab at the right
}
