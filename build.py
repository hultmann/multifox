#!/usr/bin/python
# -*- coding: utf-8 -*-

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import build_tools
import sys

b = build_tools.BuildExtension()

b.add_binary("icon.png")
b.add_binary("content/favicon.ico")
b.add_binary("content/logo-about.png")
b.add_binary("content/logo-popup.png")

b.add_text("install.rdf")
b.add_text("chrome.manifest")
#b.add_text("bootstrap.js")
b.add_text("components/protocol.js")

b.add_text("content/content-injection.js")
b.add_text("content/content-injection-reset.js")
b.add_text("content/overlays.js")
b.add_text("content/about-multifox.html")
b.add_text("content/about-multifox.js")
b.add_text("content/about-badges.html")

b.add_text("modules/main.js")
b.add_text("modules/error.js")
b.add_text("modules/popup.js")
b.add_text("modules/welcome.js")
b.add_text("modules/maintenance.js")
b.add_text("modules/remote-browser.js")


b.add_locale("en-US")
#b.add_locale("pt-BR")
#b.add_locale("es-ES")


b.add_text("locale/${locale}/general.properties")
b.add_text("locale/${locale}/about.properties")
b.add_text("locale/${locale}/welcome.properties")


b.set_var("SOURCE_URL",      "https://github.com/hultmann/multifox/tree/" + sys.argv[1] #changeset
                             if len(sys.argv) > 1 else
                             "https://github.com/hultmann/multifox/tree/master/src")
b.set_var("EXT_VERSION",     "2.0b7")
b.set_var("EXT_ID",          "{42f25d10-4944-11e2-96c0-0b6a95a8daf0}")
b.set_var("EXT_NAME",        "Multifox 2 (BETA)")
b.set_var("EXT_SITE",        "http://br.mozdev.org/multifox/")
b.set_var("APP_MIN_VERSION", "17.0.1")
b.set_var("APP_MAX_VERSION", "20.*")
b.set_var("CHROME_NAME",     "multifox")
b.set_var("RESOURCE_NAME",   "multifox-modules")
b.set_var("PATH_CONTENT",    "chrome://multifox/content")
b.set_var("PATH_LOCALE",     "chrome://multifox/locale")
b.set_var("PATH_MODULE",     "resource://multifox-modules")

b.set_var("BASE_ID",         "multifox2")

b.set_var("INTERNAL_DOMAIN_SUFFIX_LOGGEDIN", "multifox-auth-2")
b.set_var("INTERNAL_DOMAIN_SUFFIX_ANON",     "multifox-anon-2") #external anon 3party

b.set_var("XPCOM_ABOUT_CLASS",      "{347c41b6-1417-411c-b87a-422bcfc1899a}")
b.set_var("XPCOM_ABOUT_CONTRACT",   "@mozilla.org/network/protocol/about;1?what=multifox")

xpi = b.get_var("CHROME_NAME") + "-" + b.get_var("EXT_VERSION") + ".xpi"
b.build("src", "build", xpi)
