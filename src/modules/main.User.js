/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */


function UserId(encUser, encTld) {
  console.assert(typeof encUser === "string", "invalid user =", encUser);
  console.assert(typeof encTld  === "string", "invalid loginTld =", encTld);
  this._encName = encUser;
  this._encTld = encTld;
}


UserId.prototype = {

  toString: function() {
    return JSON.stringify(this);
  },


  toJSON: function() { // indirectly called by toString
    return {
      "encodedUser":this.encodedName, "encodedTld":this.encodedTld,
      "x-user": this.plainName + " " + this.plainTld
    };
  },


  equals: function(user) {
    return (user._encName === this._encName) && (user._encTld  === this._encTld);
  },


  toNewAccount: function() {
    return this.isNewAccount ? this : new UserId(UserUtils.NewAccount, this._encTld);
  },


  isTldValid: function(encTld) {
    console.assert(LoginDB.isLoggedIn(encTld), "not logged in");
    var x = LoginDB._loggedInTabs[encTld];
    return x.indexOf(this._encTld) > -1;
  },


  get isNewAccount() {
    return this._encName === UserUtils.NewAccount;
  },


  get plainTld() {
    return StringEncoding.decode(this._encTld);
  },


  get plainName() {
    return StringEncoding.decode(this._encName);
  },


  get encodedTld() {
    return this._encTld;
  },


  get encodedName() {
    return this._encName;
  }
};



function DocumentUser(user, plainDocTld, topInnerId) {
  console.assert(typeof user        === "object", "invalid user =", user);
  console.assert(typeof plainDocTld === "string", "invalid plainDocTld =", plainDocTld);
  console.assert(typeof topInnerId  === "number", "invalid topInnerId =", topInnerId);
  this._user = user; // may be null (anon doc)
  this._topInnerId = topInnerId;
  this._ownerDocTld = plainDocTld;
  this._ownerEncodedDocTld = StringEncoding.encode(plainDocTld);


  if (WinMap.isInvalidTopInnerId(topInnerId)) {
    // top request: topInnerId is undefined (it won't be used anyway)
    this._topDocTld = plainDocTld;
    return;
  }

  var topData = WinMap.getInnerEntry(topInnerId);
  console.assert(WinMap.isTabId(topData.parentInnerId), "not a top id", user, plainDocTld, topInnerId);
  var topUri = Services.io.newURI(topData.url, null, null);
  this._topDocTld = getTldFromUri(topUri);
  if (this._topDocTld === null) {
    this._topDocTld = getTldForUnsupportedScheme(topUri); // "about:"
  }
}


DocumentUser.prototype = {

  toString: function() {
    return JSON.stringify(this);
  },


  toJSON: function() {
    var hostJar = new HostJar(this._ownerDocTld, this);
    return {
      "x-topJar":   this._topDocTld,
      "x-ownerTld": this._ownerDocTld,
      "topInnerId": this._topInnerId,
      "x-jar-mode": hostJar._mode,
      "x-jar-user": hostJar._user,
      "x-jar-top":  hostJar._tldTop,
      "x-jar-host": hostJar.toJar(),
      "x-user": this.user ? (this.user.plainName + " " + this.user.plainTld) : "null"
    };
  },


  get topDocId() {
    console.assert(this._topInnerId !== WinMap.TopWindowFlag, "_topInnerId is not valid");
    return this._topInnerId;
  },


  get user() {
    return this._user;
  },


  get ownerTld() {
    return this._ownerDocTld;
  },


  get encodedDocTld() {
    return this._ownerEncodedDocTld;
  },


  getHost: function(host) {
    return new HostJar(host, this);
  },


  appendLoginToUri: function(uri) {
    var u = uri.clone();
    u.host = this.getHost(uri.host).toJar();
    return u;
  },


  appendLogin: function(assetDomain) {
    console.assert(typeof assetDomain === "string", "invalid appendLogin =", assetDomain);
    return this.getHost(assetDomain).toJar();
  }


};



function HostJar(host, docUser) {
  var tld = getTldFromHost(host);
  var hostUser;
  if (tld === docUser._ownerDocTld) {
    hostUser = docUser;
  } else {
    var assetUri = Services.io.newURI("http://" + tld, null, null);
    hostUser = WinMap.findUser(assetUri, docUser.topDocId);
  }

  this._host = host;
  this._hostIsAnon = hostUser === null;

  if (this._hostIsAnon) {
    if (docUser.user === null) {
      this._mode = "nop";    // topdoc=www.foo.com frame=www.foo.com img=www.bar.com
      this._user = null;
      this._tldTop = docUser._topDocTld;
    } else if (docUser.user.isNewAccount) {
      this._mode = "by_top";            // topdoc=www.google.com img=www.foo.com
      this._user = null;
      this._tldTop = docUser._topDocTld;
    } else {
      this._mode = "by_inherited_user"; // topdoc=www.google.com, img=www.foo.com
      this._user = docUser.user;
      this._tldTop = docUser._topDocTld;
    }
    return;
  }


  if (hostUser.user.isNewAccount) {
    if (tld === docUser._topDocTld) {
      this._mode = "by_user";     // topdoc=google.com img=www.google.com
      this._user = hostUser.user;
      this._tldUrl = tld;
      this._tldTop = null;
    } else {
      // 3rd-party
      this._mode = "by_top";      // topdoc=whatever.com img=www.google.com
      this._user = hostUser.user; // not used by string; flag for addRequest
      this._tldTop = docUser._topDocTld;
    }

  } else {
    this._mode = "by_user";       // topdoc=whatever.com img=www.google.com
    this._user = hostUser.user;
    this._tldUrl = tld;
    this._tldTop = null;
  }
}


HostJar.prototype = {

  get user() {
    return this._hostIsAnon ? null : this._user;
  },


  toJar: function() {
    switch (this._mode) {
      case "nop":
        return this._host;
      case "by_top":
        return this._host + "." + StringEncoding.encode(this._tldTop) + ".${INTERNAL_DOMAIN_SUFFIX_ANON}";
      case "by_inherited_user":
        return this._host + "." + StringEncoding.encode(this._tldTop) + "-" + this._user.encodedName + "-" + this._user.encodedTld + ".${INTERNAL_DOMAIN_SUFFIX_ANON}";
      case "by_user":
        // We need to use tld(host) ==> otherwise, we couldn't (easily) locate the cookie for different subdomains
        return this._host + "." + StringEncoding.encode(this._tldUrl)  + "-" + this._user.encodedName + "-" + this._user.encodedTld + ".${INTERNAL_DOMAIN_SUFFIX_LOGGEDIN}";
    }
    throw new Error(this._mode);
  }

};



var UserUtils = {

  NewAccount: "",

  equalsUser: function(user1, user2) {
    if ((user1 === null) && (user2 === null)) {
      return true;
    }
    if ((user1 !== null) && (user2 !== null)) {
      return user1.equals(user2);
    }
    return false;
  },


  _getLabels: function(internalHost) {
    if (hasRootDomain("${INTERNAL_DOMAIN_SUFFIX_LOGGEDIN}", internalHost) === false) {
      return null;
    }

    // internalHost = .youtube.com.[youtube.com]-[user@foo]-[google.com].multifox-auth-X
    // [0] multifox-auth-X
    // [1] [youtube.com]-[user@gmail.com]-[google.com]
    // [2] com
    // [3] youtube
    // [4] (empty?)
    var labels = internalHost.split(".").reverse();
    console.assert(labels[0] === "${INTERNAL_DOMAIN_SUFFIX_LOGGEDIN}", "_getLabels", internalHost);
    return labels;
  },


  // returns ".example.com", "example.com" ...
  getRealHost: function(internalHost) {
    var labels = this._getLabels(internalHost);
    return labels === null ? null // normal host
                           : labels.slice(2).reverse().join(".");
  },


  getEncodedLogin: function(internalHost) {
    var labels = this._getLabels(internalHost);
    if (labels === null) {
      return null;
    }
    var strip = labels[1].split("-");
    if (strip.length !== 3) {
      return null;
    }
    return {
      rawData:   labels[1],
      tabTld:    strip[0], // TODO could be replaced by labels[3]+[4]...
      loginUser: strip[1],
      loginTld:  strip[2]
    };
  }

};
