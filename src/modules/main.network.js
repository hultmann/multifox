/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const httpListeners = {
  request: {
    // nsIObserver
    observe: function(subject, topic, data) {
      if ((subject instanceof Ci.nsIHttpChannel) === false) {
        return;
      }

      var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
      var ctx = getLoadContext(httpChannel)
      if ((ctx === null) || ctx.usePrivateBrowsing) {
        return;
      }

      var profileId = Profile.getIdentityFromContent(ctx.associatedWindow);
      if (Profile.isNativeProfile(profileId)) {
        return; // default/private window, favicon, updates
      }

      if (isTopWindowChannel(httpChannel, ctx.associatedWindow)) {
        var browser = UIUtils.findOriginBrowser(ctx.associatedWindow);
        ErrorHandler.onNewWindowRequest(browser);
      }
      /*
      var myHeaders = HttpHeaders.fromRequest(httpChannel);
      if (myHeaders["authorization"] !== null) {
        ErrorHandler.addNetworkError(ctx.associatedWindow, "authorization");
        return;
      }
      */

      var cook = Cookies.getCookie(false, httpChannel.URI, profileId);
      httpChannel.setRequestHeader("Cookie", cook, false);
    }
  },

  response: {
    // nsIObserver
    observe: function(subject, topic, data) {
      if ((subject instanceof Ci.nsIHttpChannel) === false) {
        return;
      }

      var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
      var ctx = getLoadContext(httpChannel)
      if ((ctx === null) || ctx.usePrivateBrowsing) {
        return;
      }

      var winChannel = ctx.associatedWindow;
      var profileId = Profile.getIdentityFromContent(winChannel);
      if (Profile.isNativeProfile(profileId)) {
        return;
      }


      var myHeaders = HttpHeaders.fromResponse(httpChannel);
      if (myHeaders["www-authenticate"] !== null) {
        ErrorHandler.addNetworkError(winChannel, "www-authenticate");
        return;
      }

      // BUG cookies from multipart responses are lost

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

  /*
  fromRequest: function(request) {
    var nameValues = {
      //"cookie": null, //for debug only
      "authorization": null
    }
    this.visitLoop.values = nameValues;
    request.visitRequestHeaders(this.visitLoop);
    return nameValues;
  },
  */

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


function isTopWindowChannel(channel, associatedWin) {
  if ((channel.loadFlags & Ci.nsIChannel.LOAD_DOCUMENT_URI) === 0) {
    return false;
  }
  return associatedWin === associatedWin.top;
}
