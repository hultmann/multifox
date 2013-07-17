/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const httpListeners = {
  request: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),

    // nsIObserver
    observe: function(aSubject, aTopic, aData) {
      var httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);
      var ctx = getLoadContext(httpChannel)
      if ((ctx === null) || (ctx.usePrivateBrowsing)) {
        return;
      }
      var winChannel = ctx.associatedWindow;
      var profileId = FindIdentity.fromContent(winChannel).profileNumber;
      switch (profileId) {
        case Profile.DefaultIdentity:
        case Profile.UndefinedIdentity: // favicon, updates
          return;
      }

      var myHeaders = HttpHeaders.fromRequest(httpChannel);
      if (myHeaders["authorization"] !== null) {
        showError(winChannel, "authorization", "-");
        return;
      }

      var cook = Cookies.getCookie(false, httpChannel.URI, profileId);
      httpChannel.setRequestHeader("Cookie", cook, false);
    }
  },

  response: {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver]),

    // nsIObserver
    observe: function(aSubject, aTopic, aData) {
      var httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);
      var ctx = getLoadContext(httpChannel)
      if ((ctx === null) || (ctx.usePrivateBrowsing)) {
        return;
      }
      var winChannel = ctx.associatedWindow;
      var profileId = FindIdentity.fromContent(winChannel).profileNumber;
      switch (profileId) {
        case Profile.DefaultIdentity:
        case Profile.UndefinedIdentity:
          /*
          var myHeaders = HttpHeaders.fromResponse(httpChannel);
          var setCookies = myHeaders["set-cookie"];
          if (setCookies !== null) {
            console.log("req "+profileId+"--"+httpChannel.URI.spec+"\n"+setCookies);
          }
          */
          return;
      }


      var myHeaders = HttpHeaders.fromResponse(httpChannel);
      if (myHeaders["www-authenticate"] !== null) {
        showError(winChannel, "www-authenticate", "-");
        return;
      }

      var setCookies = myHeaders["set-cookie"];
      if (setCookies === null) {
        return;
      }

      // server sent "Set-Cookie"
      httpChannel.setResponseHeader("Set-Cookie", null, false);
      Cookies.setCookie(profileId, httpChannel.URI, setCookies, false);
    }
  }
};


const HttpHeaders = {
  visitLoop: {
    values: null,
    visitHeader: function(name, value) {
      var n = name.toLowerCase();
      if (n in this.values) {
        this.values[n] = value;
      }
    }
  },

  fromRequest: function(request) {
    var nameValues = {
      //"cookie": null, //for debug only
      "authorization": null
    }
    this.visitLoop.values = nameValues;
    request.visitRequestHeaders(this.visitLoop);
    return nameValues;
  },

  fromResponse: function(response) {
    var nameValues = {
      "set-cookie": null,
      "www-authenticate": null
    }
    this.visitLoop.values = nameValues;
    response.visitResponseHeaders(this.visitLoop);
    return nameValues;
  }
};


function getLoadContext(channel) {
  if (channel.notificationCallbacks) {
    try {
      return channel
              .notificationCallbacks
              .getInterface(Ci.nsILoadContext);
    } catch (ex) {
      //console.trace("channel.notificationCallbacks ", channel.notificationCallbacks, channel.URI.spec, ex);
    }
  }

  if (channel.loadGroup && channel.loadGroup.notificationCallbacks) {
    try {
      return channel
              .loadGroup
              .notificationCallbacks
              .getInterface(Ci.nsILoadContext);
    } catch (ex) {
      console.trace("channel.loadGroup", channel.loadGroup, channel.URI.spec, ex);
    }
  }

  //var isChrome = context.associatedWindow instanceof Ci.nsIDOMChromeWindow;
  //return context.isContent ? context.associatedWindow : null;
  //console.log("LOAD CONTEXT FAIL " + channel.URI.spec);
  return null; // e.g. <link rel=prefetch> <link rel=next> ...
}
