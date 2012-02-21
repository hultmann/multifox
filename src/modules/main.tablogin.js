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


var TabLoginHelper = {
  NewAccount: "",

  create: function(tabElement, encUser, encTld) {
    return new TabLogin(tabElement, encUser, encTld);
  },

  getLoginInProgress: function(tab) { // BUG should new TabLoginHelper be aware it is LoginInProgress?
    //var tab = this.tabElement; // BUG?
    if (tab.hasAttribute("multifox-login-submit-domain")) { // BUG tab undef while checking update
      var usr = tab.getAttribute("multifox-login-submit-user")
      var tld = tab.getAttribute("multifox-login-submit-domain");
      return TabLoginHelper.create(tab, StringEncoding.encode(usr), StringEncoding.encode(tld));
    } else {
      return null;
    }
  },

  removeLoginInProgress: function(tab) {
    var moveMode = tab.getAttribute("multifox-login-submit-data-moved");
    tab.removeAttribute("multifox-login-submit-domain");
    tab.removeAttribute("multifox-login-submit-user");
    tab.removeAttribute("multifox-login-submit-data-moved");
    return moveMode;
  },

  setLoginInProgress: function(username, host, tab) {
    console.assert(username.length > 0, "no username");
    tab.setAttribute("multifox-login-submit-user", username);
    tab.setAttribute("multifox-login-submit-domain", getTldFromHost(host));
  },

  getFromDomWindow: function(contentWin) {
    if (contentWin === null) {
      return null;
    }

    var url = contentWin.document.documentURI;
    if (url.length === 0) {
      return null;
    }

    var tab = WindowParents.getTabElement(contentWin);
    return (tab === null) ? null : new TabLogin(tab);
  }

};


function TabLogin(tabElement, usr, tld) {
  console.assert(tabElement !== null, "tab is invalid");

  // usr,tld ==> optional params
  if (usr === undefined) {
    console.assert(tld === undefined, "usr=undefined");
    if (tabElement.hasAttribute("multifox-tab-id-provider-tld-enc")) {
      usr = tabElement.getAttribute("multifox-tab-id-provider-user-enc");
      tld = tabElement.getAttribute("multifox-tab-id-provider-tld-enc");
    } else {
      usr = null;
      tld = null;
    }
  }
  this._userEncoded = usr;
  this._tldEncoded = tld;
  this.tabElement = tabElement;
}


TabLogin.prototype = {

  formatUri: function(uri) {
    var u = uri.clone();
    u.host = this.formatHost(u.host);
    return u;
  },

  formatHost: function(hostname) {
    if (this.isNewUser) {
      return hostname;
    }

    console.assert(typeof hostname === "string", "invalid domain2 ="+hostname);
    console.assert(typeof this._userEncoded === "string", "invalid user=" + this._userEncoded);
    console.assert(typeof this._tldEncoded === "string", "invalid loginTld=" + this._tldEncoded);
    //console.assert(this._userEncoded.indexOf(".${INTERNAL__DOMAIN__SUFFIX}") === -1, "invalid user");

    // We need to use tld(hostname) ==> otherwise, we couldn't (easily) locate the cookie for different subdomains
    return hostname + "." +
           StringEncoding.encode(getTldFromHost(hostname)) + "-" + this._userEncoded + "-" + this._tldEncoded +
           (this.isExternalAnonResource ? ".${INTERNAL_DOMAIN_SUFFIX_ANON}"
                                        : ".${INTERNAL_DOMAIN_SUFFIX_LOGGEDIN}");
  },


  equals: function(tabLogin) {
    return (tabLogin._userEncoded === this._userEncoded) && (tabLogin._tldEncoded === this._tldEncoded);
  },

  toString: function() {
    return "loginTld=" + this.plainTld + " loginUser=" + this.plainUser;
  },

  get plainTld() {
    return this._tldEncoded === null ? null : StringEncoding.decode(this._tldEncoded);
  },

  get plainUser() {
    return this._tldEncoded === null ? null : StringEncoding.decode(this._userEncoded);
  },

  get encodedTld() {
    return this._tldEncoded;
  },

  get encodedUser() {
    return this._userEncoded;
  },

  get hasUser() {
    return this._userEncoded !== null;
  },

  get isNewUser() {
    return this._userEncoded === TabLoginHelper.NewAccount;
  },

  get isLoggedIn() {
    var usr = this._userEncoded;
    return (usr !== null) && (usr !== TabLoginHelper.NewAccount);
  },

  getPlainTabTld: function() {
    // use "location" — "documentURI" may not reflect changes in hash (e.g. Twitter)
    return getTldFromHost(this.tabElement.linkedBrowser.contentDocument.location.hostname);
  },

  getEncodedTabTld: function() {
    return StringEncoding.encode(this.getPlainTabTld());
  },

  toAnon: function() { // toUnlogged
    var tabLogin = new TabLogin(this.tabElement, this.encodedUser, this.encodedTld);
    tabLogin.anonResource = true;
    Object.freeze(tabLogin);
    return tabLogin;
  },

  get isExternalAnonResource() {
    return "anonResource" in this;
  },

  setTabAsAnon: function() {
    var tab = this.tabElement;
    if (tab.hasAttribute("multifox-tab-id-provider-tld-enc")) {
      tab.removeAttribute("multifox-tab-id-provider-tld-enc");
      tab.removeAttribute("multifox-tab-id-provider-user-enc");
      invalidateUI(tab);
    }
  },

  saveToTab: function() {
    var tab = this.tabElement;
    if (tab.hasAttribute("multifox-tab-error")) {
      // reset error icon
      tab.removeAttribute("multifox-tab-error");
    }

    var domain = this._tldEncoded;
    var user = this._userEncoded;

    console.assert(domain !== null, "setLogin tld=null");
    console.assert(typeof(domain) === "string", "setLogin tld="+domain);
    console.assert(typeof(user) === "string", "setLogin user="+user);

    if (tab.hasAttribute("multifox-tab-id-provider-tld-enc") === false) {
      tab.setAttribute("multifox-logging-in", "true"); // TODO
    }

    tab.setAttribute("multifox-tab-id-provider-tld-enc", domain);
    tab.setAttribute("multifox-tab-id-provider-user-enc", user);

    invalidateUI(tab);
  },


  get isLoginInProgress() {
    return this.tabElement.hasAttribute("multifox-login-submit-domain");
  },

  get hasLoginInProgressMoveData() {
    return this.tabElement.hasAttribute("multifox-login-submit-data-moved");
  },

  setLoginInProgressMoveData: function(mode) {
    this.tabElement.setAttribute("multifox-login-submit-data-moved", mode);
  }

};
