/**
 * An Angular module that gives you access to the browsers local storage
 * @version v0.5.2 - 2016-09-28
 * @link https://github.com/grevory/angular-local-storage
 * @author grevory <greg@gregpike.ca>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
(function (window, angular) {
var isDefined = angular.isDefined,
  isUndefined = angular.isUndefined,
  isNumber = angular.isNumber,
  isObject = angular.isObject,
  isArray = angular.isArray,
  isString = angular.isString,
  extend = angular.extend,
  toJson = angular.toJson;

angular
  .module('LocalStorageModule', [])
  .provider('localStorageService', function() {
    // You should set a prefix to avoid overwriting any local storage variables from the rest of your app
    // e.g. localStorageServiceProvider.setPrefix('yourAppName');
    // With provider you can use config as this:
    // myApp.config(function (localStorageServiceProvider) {
    //    localStorageServiceProvider.prefix = 'yourAppName';
    // });
    this.prefix = 'ls';

    // You could change web storage type localstorage or sessionStorage
    this.storageType = 'localStorage';

    // Cookie options (usually in case of fallback)
    // expiry = Number of days before cookies expire // 0 = Does not expire
    // path = The web path the cookie represents
    // secure = Wether the cookies should be secure (i.e only sent on HTTPS requests)
    this.cookie = {
      expiry: 30,
      path: '/',
      secure: false
    };

    // Decides wether we should default to cookies if localstorage is not supported.
    this.defaultToCookie = true;

    // Send signals for each of the following actions?
    this.notify = {
      setItem: true,
      removeItem: false
    };

    // Setter for the prefix
    this.setPrefix = function(prefix) {
      this.prefix = prefix;
      return this;
    };

    // Setter for the storageType
    this.setStorageType = function(storageType) {
      this.storageType = storageType;
      return this;
    };
    // Setter for defaultToCookie value, default is true.
    this.setDefaultToCookie = function (shouldDefault) {
      this.defaultToCookie = !!shouldDefault; // Double-not to make sure it's a bool value.
      return this;
    };
    // Setter for cookie config
    this.setStorageCookie = function(exp, path, secure) {
      this.cookie.expiry = exp;
      this.cookie.path = path;
      this.cookie.secure = secure;
      return this;
    };

    // Setter for cookie domain
    this.setStorageCookieDomain = function(domain) {
      this.cookie.domain = domain;
      return this;
    };

    // Setter for notification config
    // itemSet & itemRemove should be booleans
    this.setNotify = function(itemSet, itemRemove) {
      this.notify = {
        setItem: itemSet,
        removeItem: itemRemove
      };
      return this;
    };

    this.$get = ['$rootScope', '$window', '$document', '$parse','$timeout', function($rootScope, $window, $document, $parse, $timeout) {
      var self = this;
      var prefix = self.prefix;
      var cookie = self.cookie;
      var notify = self.notify;
      var storageType = self.storageType;
      var webStorage;

      // When Angular's $document is not available
      if (!$document) {
        $document = document;
      } else if ($document[0]) {
        $document = $document[0];
      }

      // If there is a prefix set in the config lets use that with an appended period for readability
      if (prefix.substr(-1) !== '.') {
        prefix = !!prefix ? prefix + '.' : '';
      }
      var deriveQualifiedKey = function(key) {
        return prefix + key;
      };

      // Removes prefix from the key.
      var underiveQualifiedKey = function (key) {
        return key.replace(new RegExp('^' + prefix, 'g'), '');
      };

      // Check if the key is within our prefix namespace.
      var isKeyPrefixOurs = function (key) {
        return key.indexOf(prefix) === 0;
      };

      // Checks the browser to see if local storage is supported
      var checkSupport = function () {
        try {
          var supported = (storageType in $window && $window[storageType] !== null);

          // When Safari (OS X or iOS) is in private browsing mode, it appears as though localStorage
          // is available, but trying to call .setItem throws an exception.
          //
          // "QUOTA_EXCEEDED_ERR: DOM Exception 22: An attempt was made to add something to storage
          // that exceeded the quota."
          var key = deriveQualifiedKey('__' + Math.round(Math.random() * 1e7));
          if (supported) {
            webStorage = $window[storageType];
            webStorage.setItem(key, '');
            webStorage.removeItem(key);
          }

          return supported;
        } catch (e) {
          // Only change storageType to cookies if defaulting is enabled.
          if (self.defaultToCookie)
            storageType = 'cookie';
          $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
          return false;
        }
      };
      var browserSupportsLocalStorage = checkSupport();

      // Directly adds a value to local storage
      // If local storage is not available in the browser use cookies
      // Example use: localStorageService.add('library','angular');
      var addToLocalStorage = function (key, value, type) {
        setStorageType(type);

        // Let's convert undefined values to null to get the value consistent
        if (isUndefined(value)) {
          value = null;
        } else {
          value = toJson(value);
        }

        // If this browser does not support local storage use cookies
        if (!browserSupportsLocalStorage && self.defaultToCookie || self.storageType === 'cookie') {
          if (!browserSupportsLocalStorage) {
            $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
          }

          if (notify.setItem) {
            $rootScope.$broadcast('LocalStorageModule.notification.setitem', {key: key, newvalue: value, storageType: 'cookie'});
          }
          return addToCookies(key, value);
        }

        try {
          if (webStorage) {
            webStorage.setItem(deriveQualifiedKey(key), value);
          }
          if (notify.setItem) {
            $rootScope.$broadcast('LocalStorageModule.notification.setitem', {key: key, newvalue: value, storageType: self.storageType});
          }
        } catch (e) {
          $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
          return addToCookies(key, value);
        }
        return true;
      };

      // Directly get a value from local storage
      // Example use: localStorageService.get('library'); // returns 'angular'
      var getFromLocalStorage = function (key, type) {
        setStorageType(type);

        if (!browserSupportsLocalStorage && self.defaultToCookie  || self.storageType === 'cookie') {
          if (!browserSupportsLocalStorage) {
            $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
          }

          return getFromCookies(key);
        }

        var item = webStorage ? webStorage.getItem(deriveQualifiedKey(key)) : null;
        // angular.toJson will convert null to 'null', so a proper conversion is needed
        // FIXME not a perfect solution, since a valid 'null' string can't be stored
        if (!item || item === 'null') {
          return null;
        }

        try {
          return JSON.parse(item);
        } catch (e) {
          return item;
        }
      };

      // Remove an item from local storage
      // Example use: localStorageService.remove('library'); // removes the key/value pair of library='angular'
      //
      // This is var-arg removal, check the last argument to see if it is a storageType
      // and set type accordingly before removing.
      //
      var removeFromLocalStorage = function () {
        // can't pop on arguments, so we do this
        var consumed = 0;
        if (arguments.length >= 1 &&
            (arguments[arguments.length - 1] === 'localStorage' ||
             arguments[arguments.length - 1] === 'sessionStorage')) {
          consumed = 1;
          setStorageType(arguments[arguments.length - 1]);
        }

        var i, key;
        for (i = 0; i < arguments.length - consumed; i++) {
          key = arguments[i];
          if (!browserSupportsLocalStorage && self.defaultToCookie || self.storageType === 'cookie') {
            if (!browserSupportsLocalStorage) {
              $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
            }

            if (notify.removeItem) {
              $rootScope.$broadcast('LocalStorageModule.notification.removeitem', {key: key, storageType: 'cookie'});
            }
            removeFromCookies(key);
          }
          else {
            try {
              webStorage.removeItem(deriveQualifiedKey(key));
              if (notify.removeItem) {
                $rootScope.$broadcast('LocalStorageModule.notification.removeitem', {
                  key: key,
                  storageType: self.storageType
                });
              }
            } catch (e) {
              $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
              removeFromCookies(key);
            }
          }
        }
      };

      // Return array of keys for local storage
      // Example use: var keys = localStorageService.keys()
      var getKeysForLocalStorage = function (type) {
        setStorageType(type);

        if (!browserSupportsLocalStorage) {
          $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
          return [];
        }

        var prefixLength = prefix.length;
        var keys = [];
        for (var key in webStorage) {
          // Only return keys that are for this app
          if (key.substr(0, prefixLength) === prefix) {
            try {
              keys.push(key.substr(prefixLength));
            } catch (e) {
              $rootScope.$broadcast('LocalStorageModule.notification.error', e.Description);
              return [];
            }
          }
        }
        return keys;
      };

      // Remove all data for this app from local storage
      // Also optionally takes a regular expression string and removes the matching key-value pairs
      // Example use: localStorageService.clearAll();
      // Should be used mostly for development purposes
      var clearAllFromLocalStorage = function (regularExpression, type) {
        setStorageType(type);

        // Setting both regular expressions independently
        // Empty strings result in catchall RegExp
        var prefixRegex = !!prefix ? new RegExp('^' + prefix) : new RegExp();
        var testRegex = !!regularExpression ? new RegExp(regularExpression) : new RegExp();

        if (!browserSupportsLocalStorage && self.defaultToCookie  || self.storageType === 'cookie') {
          if (!browserSupportsLocalStorage) {
            $rootScope.$broadcast('LocalStorageModule.notification.warning', 'LOCAL_STORAGE_NOT_SUPPORTED');
          }
          return clearAllFromCookies();
        }
        if (!browserSupportsLocalStorage && !self.defaultToCookie)
          return false;
        var prefixLength = prefix.length;

        for (var key in webStorage) {
          // Only remove items that are for this app and match the regular expression
          if (prefixRegex.test(key) && testRegex.test(key.substr(prefixLength))) {
            try {
              removeFromLocalStorage(key.substr(prefixLength));
            } catch (e) {
              $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
              return clearAllFromCookies();
            }
          }
        }
        return true;
      };

      // Checks the browser to see if cookies are supported
      var browserSupportsCookies = (function() {
        try {
          return $window.navigator.cookieEnabled ||
          ("cookie" in $document && ($document.cookie.length > 0 ||
            ($document.cookie = "test").indexOf.call($document.cookie, "test") > -1));
          } catch (e) {
            $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
            return false;
          }
        }());

        // Directly adds a value to cookies
        // Typically used as a fallback if local storage is not available in the browser
        // Example use: localStorageService.cookie.add('library','angular');
        var addToCookies = function (key, value, daysToExpiry, secure) {

          if (isUndefined(value)) {
            return false;
          } else if(isArray(value) || isObject(value)) {
            value = toJson(value);
          }

          if (!browserSupportsCookies) {
            $rootScope.$broadcast('LocalStorageModule.notification.error', 'COOKIES_NOT_SUPPORTED');
            return false;
          }

          try {
            var expiry = '',
            expiryDate = new Date(),
            cookieDomain = '';

            if (value === null) {
              // Mark that the cookie has expired one day ago
              expiryDate.setTime(expiryDate.getTime() + (-1 * 24 * 60 * 60 * 1000));
              expiry = "; expires=" + expiryDate.toGMTString();
              value = '';
            } else if (isNumber(daysToExpiry) && daysToExpiry !== 0) {
              expiryDate.setTime(expiryDate.getTime() + (daysToExpiry * 24 * 60 * 60 * 1000));
              expiry = "; expires=" + expiryDate.toGMTString();
            } else if (cookie.expiry !== 0) {
              expiryDate.setTime(expiryDate.getTime() + (cookie.expiry * 24 * 60 * 60 * 1000));
              expiry = "; expires=" + expiryDate.toGMTString();
            }
            if (!!key) {
              var cookiePath = "; path=" + cookie.path;
              if (cookie.domain) {
                cookieDomain = "; domain=" + cookie.domain;
              }
              /* Providing the secure parameter always takes precedence over config
               * (allows developer to mix and match secure + non-secure) */
              if (typeof secure === 'boolean') {
                  if (secure === true) {
                      /* We've explicitly specified secure,
                       * add the secure attribute to the cookie (after domain) */
                      cookieDomain += "; secure";
                  }
                  // else - secure has been supplied but isn't true - so don't set secure flag, regardless of what config says
              }
              else if (cookie.secure === true) {
                  // secure parameter wasn't specified, get default from config
                  cookieDomain += "; secure";
              }
              $document.cookie = deriveQualifiedKey(key) + "=" + encodeURIComponent(value) + expiry + cookiePath + cookieDomain;
            }
          } catch (e) {
            $rootScope.$broadcast('LocalStorageModule.notification.error', e.message);
            return false;
          }
          return true;
        };

        // Directly get a value from a cookie
        // Example use: localStorageService.cookie.get('library'); // returns 'angular'
        var getFromCookies = function (key) {
          if (!browserSupportsCookies) {
            $rootScope.$broadcast('LocalStorageModule.notification.error', 'COOKIES_NOT_SUPPORTED');
            return false;
          }

          var cookies = $document.cookie && $document.cookie.split(';') || [];
          for(var i=0; i < cookies.length; i++) {
            var thisCookie = cookies[i];
            while (thisCookie.charAt(0) === ' ') {
              thisCookie = thisCookie.substring(1,thisCookie.length);
            }
            if (thisCookie.indexOf(deriveQualifiedKey(key) + '=') === 0) {
              var storedValues = decodeURIComponent(thisCookie.substring(prefix.length + key.length + 1, thisCookie.length));
              try {
                var parsedValue = JSON.parse(storedValues);
                return typeof(parsedValue) === 'number' ? storedValues : parsedValue;
              } catch(e) {
                return storedValues;
              }
            }
          }
          return null;
        };

        var removeFromCookies = function (key) {
          addToCookies(key,null);
        };

        var clearAllFromCookies = function () {
          var thisCookie = null;
          var prefixLength = prefix.length;
          var cookies = $document.cookie.split(';');
          for(var i = 0; i < cookies.length; i++) {
            thisCookie = cookies[i];

            while (thisCookie.charAt(0) === ' ') {
              thisCookie = thisCookie.substring(1, thisCookie.length);
            }

            var key = thisCookie.substring(prefixLength, thisCookie.indexOf('='));
            removeFromCookies(key);
          }
        };

        var getStorageType = function() {
          return storageType;
        };

        var setStorageType = function(type) {
          if (type && storageType !== type) {
            storageType = type;
            browserSupportsLocalStorage = checkSupport();
          }
          return browserSupportsLocalStorage;
        };

        // Add a listener on scope variable to save its changes to local storage
        // Return a function which when called cancels binding
        var bindToScope = function(scope, key, def, lsKey, type) {
          lsKey = lsKey || key;
          var value = getFromLocalStorage(lsKey, type);

          if (value === null && isDefined(def)) {
            value = def;
          } else if (isObject(value) && isObject(def)) {
            value = extend(value, def);
          }

          $parse(key).assign(scope, value);

          return scope.$watch(key, function(newVal) {
            addToLocalStorage(lsKey, newVal, type);
          }, isObject(scope[key]));
        };

        // Add listener to local storage, for update callbacks.
        if (browserSupportsLocalStorage) {
            if ($window.addEventListener) {
                $window.addEventListener("storage", handleStorageChangeCallback, false);
                $rootScope.$on('$destroy', function() {
                    $window.removeEventListener("storage", handleStorageChangeCallback);
                });
            } else if($window.attachEvent){
                // attachEvent and detachEvent are proprietary to IE v6-10
                $window.attachEvent("onstorage", handleStorageChangeCallback);
                $rootScope.$on('$destroy', function() {
                    $window.detachEvent("onstorage", handleStorageChangeCallback);
                });
            }
        }

        // Callback handler for storage changed.
        function handleStorageChangeCallback(e) {
            if (!e) { e = $window.event; }
            if (notify.setItem) {
                if (isString(e.key) && isKeyPrefixOurs(e.key)) {
                    var key = underiveQualifiedKey(e.key);
                    // Use timeout, to avoid using $rootScope.$apply.
                    $timeout(function () {
                        $rootScope.$broadcast('LocalStorageModule.notification.changed', { key: key, newvalue: e.newValue, storageType: self.storageType });
                    });
                }
            }
        }

        // Return localStorageService.length
        // ignore keys that not owned
        var lengthOfLocalStorage = function(type) {
          setStorageType(type);

          var count = 0;
          var storage = $window[storageType];
          for(var i = 0; i < storage.length; i++) {
            if(storage.key(i).indexOf(prefix) === 0 ) {
              count++;
            }
          }
          return count;
        };

        return {
          isSupported: browserSupportsLocalStorage,
          getStorageType: getStorageType,
          setStorageType: setStorageType,
          set: addToLocalStorage,
          add: addToLocalStorage, //DEPRECATED
          get: getFromLocalStorage,
          keys: getKeysForLocalStorage,
          remove: removeFromLocalStorage,
          clearAll: clearAllFromLocalStorage,
          bind: bindToScope,
          deriveKey: deriveQualifiedKey,
          underiveKey: underiveQualifiedKey,
          length: lengthOfLocalStorage,
          defaultToCookie: this.defaultToCookie,
          cookie: {
            isSupported: browserSupportsCookies,
            set: addToCookies,
            add: addToCookies, //DEPRECATED
            get: getFromCookies,
            remove: removeFromCookies,
            clearAll: clearAllFromCookies
          }
        };
      }];
  });
})(window, window.angular);
(function() {
	'use strict';

	angular
		.module('angular-marquee', [])
		.directive('angularMarquee', angularMarquee);

	function angularMarquee($timeout) {
		return {
			restrict: 'A',
			scope: true,
			compile: function(tElement, tAttrs) {
				if (tElement.children().length === 0) {
					tElement.append('<div>' + tElement.text() + '</div>');
				}
				var content = tElement.children();
      	var $element = $(tElement);
				$(tElement).empty();
				tElement.append('<div class="angular-marquee" style="float:left;">' + content.clone()[0].outerHTML + '</div>');
        var $item = $element.find('.angular-marquee');
        $item.clone().css('display','none').appendTo($element);
				$element.wrapInner('<div style="width:100000px" class="angular-marquee-wrapper"></div>');
					return {
						post: function(scope, element, attrs) {
							//direction, duration,
							var $element = $(element);
							var $item = $element.find('.angular-marquee:first');
							var $marquee = $element.find('.angular-marquee-wrapper');
							var $cloneItem = $element.find('.angular-marquee:last');
							var duplicated = false;

							var containerWidth = parseInt($element.width());
							var itemWidth = parseInt($item.width());
							var defaultOffset = 20;
							var duration = 3000;
							var scroll = false;
							var animationCssName = '';

							function calculateWidthAndHeight() {
								containerWidth = parseInt($element.width());
								itemWidth = parseInt($item.width());
								if (itemWidth > containerWidth) {
									duplicated = true;
								} else {
									duplicated = false;
								}

								if (duplicated) {
								$cloneItem.show();
								} else {
									$cloneItem.hide();
								}

								$element.height($item.height());
							}

							function _objToString(obj) {
								var tabjson = [];
								for (var p in obj) {
										if (obj.hasOwnProperty(p)) {
												tabjson.push(p + ':' + obj[p]);
										}
								}
								tabjson.push();
								return '{' + tabjson.join(',') + '}';
							};

							function calculateAnimationDuration(newDuration) {
								var result = (itemWidth + containerWidth) / containerWidth * newDuration / 1000;
								if (duplicated) {
									result = result / 2;
								}
								return result;
							}

							function getAnimationPrefix() {
								var elm = document.body || document.createElement('div');
								var domPrefixes = ['webkit', 'moz','O','ms','Khtml'];

								for (var i = 0; i < domPrefixes.length; i++) {
									if (elm.style[domPrefixes[i] + 'AnimationName'] !== undefined) {
										var prefix = domPrefixes[i].toLowerCase();
										return prefix;
									}
								}
							}

							function createKeyframe(number) {
								var prefix = getAnimationPrefix();

								var margin = itemWidth;
								// if (duplicated) {
								// 	margin = itemWidth
								// } else {
								// 	margin = itemWidth + containerWidth;
								// }
								var keyframeString = '@-' + prefix + '-keyframes ' + 'simpleMarquee' + number;
								var css = {
									'margin-left': - (margin) +'px'
								}
								var keyframeCss = keyframeString + '{ 100%' + _objToString(css) + '}';
								var $styles = $('style');

								//Now add the keyframe animation to the head
								if ($styles.length !== 0) {
										//Bug fixed for jQuery 1.3.x - Instead of using .last(), use following
										$styles.filter(":last").append(keyframeCss);
								} else {
										$('head').append('<style>' + keyframeCss + '</style>');
								}
							}

							function stopAnimation() {
								$marquee.css('margin-left',0);
								if (animationCssName != '') {
									$marquee.css(animationCssName, '');
								}

							}


							function createAnimationCss(number) {
								var time = calculateAnimationDuration(duration);
								var prefix = getAnimationPrefix();
								animationCssName = '-' + prefix +'-animation';
								var cssValue = 'simpleMarquee' + number + ' ' + time + 's 0s linear infinite';
								$marquee.css(animationCssName, cssValue);
								if (duplicated) {
									$marquee.css('margin-left', 0);
								} else {
									var margin = containerWidth + defaultOffset;
									$marquee.css('margin-left', margin);
								}
							}

							function animate() {
								//create css style
								//create keyframe
								calculateWidthAndHeight();
								var number = Math.floor(Math.random() * 1000000);
								createKeyframe(number);
								createAnimationCss(number);
							}

							scope.$watch(attrs.scroll, function(scrollAttrValue) {
								scroll = scrollAttrValue;
								recalculateMarquee();
							});

							function recalculateMarquee() {
								if (scroll) {
									animate();
								} else {
									stopAnimation();
								}
							}

							var timer;
							scope.$on('recalculateMarquee', function(event, data) {
								console.log('receive recalculateMarquee event');
								if (timer) {
									$timeout.cancel(timer);
								}
								timer = $timeout(function() {
									recalculateMarquee();
								}, 500);

							});

							scope.$watch(attrs.duration, function(durationText) {
								duration = parseInt(durationText);
								if (scroll) {
									animate();
								}
							});
						}
					}
				}
			};
	}

})();
/* global YT */
angular.module('youtube-embed', [])
.service ('youtubeEmbedUtils', ['$window', '$rootScope', function ($window, $rootScope) {
    var Service = {}

    // adapted from http://stackoverflow.com/a/5831191/1614967
    var youtubeRegexp = /https?:\/\/(?:[0-9A-Z-]+\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\S*[^\w\s-])([\w-]{11})(?=[^\w-]|$)(?![?=&+%\w.-]*(?:['"][^<>]*>|<\/a>))[?=&+%\w.-]*/ig;
    var timeRegexp = /t=(\d+)[ms]?(\d+)?s?/;

    function contains(str, substr) {
        return (str.indexOf(substr) > -1);
    }

    Service.getIdFromURL = function getIdFromURL(url) {
        var id = url.replace(youtubeRegexp, '$1');

        if (contains(id, ';')) {
            var pieces = id.split(';');

            if (contains(pieces[1], '%')) {
                // links like this:
                // "http://www.youtube.com/attribution_link?a=pxa6goHqzaA&amp;u=%2Fwatch%3Fv%3DdPdgx30w9sU%26feature%3Dshare"
                // have the real query string URI encoded behind a ';'.
                // at this point, `id is 'pxa6goHqzaA;u=%2Fwatch%3Fv%3DdPdgx30w9sU%26feature%3Dshare'
                var uriComponent = decodeURIComponent(pieces[1]);
                id = ('http://youtube.com' + uriComponent)
                        .replace(youtubeRegexp, '$1');
            } else {
                // https://www.youtube.com/watch?v=VbNF9X1waSc&amp;feature=youtu.be
                // `id` looks like 'VbNF9X1waSc;feature=youtu.be' currently.
                // strip the ';feature=youtu.be'
                id = pieces[0];
            }
        } else if (contains(id, '#')) {
            // id might look like '93LvTKF_jW0#t=1'
            // and we want '93LvTKF_jW0'
            id = id.split('#')[0];
        }

        return id;
    };

    Service.getTimeFromURL = function getTimeFromURL(url) {
        url = url || '';

        // t=4m20s
        // returns ['t=4m20s', '4', '20']
        // t=46s
        // returns ['t=46s', '46']
        // t=46
        // returns ['t=46', '46']
        var times = url.match(timeRegexp);

        if (!times) {
            // zero seconds
            return 0;
        }

        // assume the first
        var full = times[0],
            minutes = times[1],
            seconds = times[2];

        // t=4m20s
        if (typeof seconds !== 'undefined') {
            seconds = parseInt(seconds, 10);
            minutes = parseInt(minutes, 10);

        // t=4m
        } else if (contains(full, 'm')) {
            minutes = parseInt(minutes, 10);
            seconds = 0;

        // t=4s
        // t=4
        } else {
            seconds = parseInt(minutes, 10);
            minutes = 0;
        }

        // in seconds
        return seconds + (minutes * 60);
    };

    Service.ready = false;

    function applyServiceIsReady() {
        $rootScope.$apply(function () {
            Service.ready = true;
        });
    };

    // If the library isn't here at all,
    if (typeof YT === "undefined") {
        // ...grab on to global callback, in case it's eventually loaded
        $window.onYouTubeIframeAPIReady = applyServiceIsReady;
        console.log('Unable to find YouTube iframe library on this page.')
    } else if (YT.loaded) {
        Service.ready = true;
    } else {
        YT.ready(applyServiceIsReady);
    }

    return Service;
}])
.directive('youtubeVideo', ['$window', 'youtubeEmbedUtils', function ($window, youtubeEmbedUtils) {
    var uniqId = 1;

    // from YT.PlayerState
    var stateNames = {
        '-1': 'unstarted',
        0: 'ended',
        1: 'playing',
        2: 'paused',
        3: 'buffering',
        5: 'queued'
    };

    var eventPrefix = 'youtube.player.';

    $window.YTConfig = {
        host: 'https://www.youtube.com'
    };

    return {
        restrict: 'EA',
        scope: {
            videoId: '=?',
            videoUrl: '=?',
            player: '=?',
            playerVars: '=?',
            playerHeight: '=?',
            playerWidth: '=?'
        },
        link: function (scope, element, attrs) {
            // allows us to $watch `ready`
            scope.utils = youtubeEmbedUtils;

            // player-id attr > id attr > directive-generated ID
            var playerId = attrs.playerId || element[0].id || 'unique-youtube-embed-id-' + uniqId++;
            element[0].id = playerId;

            // Attach to element
            scope.playerHeight = scope.playerHeight || 390;
            scope.playerWidth = scope.playerWidth || 640;
            scope.playerVars = scope.playerVars || {};

            // YT calls callbacks outside of digest cycle
            function applyBroadcast () {
                var args = Array.prototype.slice.call(arguments);
                scope.$apply(function () {
                    scope.$emit.apply(scope, args);
                });
            }

            function onPlayerStateChange (event) {
                var state = stateNames[event.data];
                if (typeof state !== 'undefined') {
                    applyBroadcast(eventPrefix + state, scope.player, event);
                }
                scope.$apply(function () {
                    scope.player.currentState = state;
                });
            }

            function onPlayerReady (event) {
                applyBroadcast(eventPrefix + 'ready', scope.player, event);
            }

            function onPlayerError (event) {
                applyBroadcast(eventPrefix + 'error', scope.player, event);
            }

            function createPlayer () {
                var playerVars = angular.copy(scope.playerVars);
                playerVars.start = playerVars.start || scope.urlStartTime;
                var player = new YT.Player(playerId, {
                    height: scope.playerHeight,
                    width: scope.playerWidth,
                    videoId: scope.videoId,
                    playerVars: playerVars,
                    events: {
                        onReady: onPlayerReady,
                        onStateChange: onPlayerStateChange,
                        onError: onPlayerError
                    }
                });

                player.id = playerId;
                return player;
            }

            function loadPlayer () {
                if (scope.videoId || scope.playerVars.list) {
                    if (scope.player && typeof scope.player.destroy === 'function') {
                        scope.player.destroy();
                    }

                    scope.player = createPlayer();
                }
            };

            var stopWatchingReady = scope.$watch(
                function () {
                    return scope.utils.ready
                        // Wait until one of them is defined...
                        && (typeof scope.videoUrl !== 'undefined'
                        ||  typeof scope.videoId !== 'undefined'
                        ||  typeof scope.playerVars.list !== 'undefined');
                },
                function (ready) {
                    if (ready) {
                        stopWatchingReady();

                        // URL takes first priority
                        if (typeof scope.videoUrl !== 'undefined') {
                            scope.$watch('videoUrl', function (url) {
                                scope.videoId = scope.utils.getIdFromURL(url);
                                scope.urlStartTime = scope.utils.getTimeFromURL(url);

                                loadPlayer();
                            });

                        // then, a video ID
                        } else if (typeof scope.videoId !== 'undefined') {
                            scope.$watch('videoId', function () {
                                scope.urlStartTime = null;
                                loadPlayer();
                            });

                        // finally, a list
                        } else {
                            scope.$watch('playerVars.list', function () {
                                scope.urlStartTime = null;
                                loadPlayer();
                            });
                        }
                    }
            });

            scope.$watchCollection(['playerHeight', 'playerWidth'], function() {
                if (scope.player) {
                    scope.player.setSize(scope.playerWidth, scope.playerHeight);
                }
            });

            scope.$on('$destroy', function () {
                scope.player && scope.player.destroy();
            });
        }
    };
}]);

var app = angular.module("ntuApp", ['mgo-mousetrap', 'LocalStorageModule', 'angular-marquee', 'youtube-embed', 'rzModule']);


app.config(function(localStorageServiceProvider) {
    localStorageServiceProvider
        .setPrefix('NTU-ICAN-PLAYER');
});

app.directive('pressEnter', function() {
    return function(scope, element, attrs) {
        element.bind("keydown keypress", function(event) {
            if (event.which === 13) {
                scope.$apply(function() {
                    scope.$eval(attrs.pressEnter);
                });

                event.preventDefault();
            }
        });
    };
});
app.controller("MusicPlayerController", function($scope, $timeout, $location, $http, PlayerFactory, googleService, localStorageService) {
    $scope.searching = false;
    $scope.musicLists = [];
    $scope.searchQuery = "";
    $scope.currentYoutubeVideo = undefined;
    $scope.isFavoriteMode = false;
    $scope.favoriteLists = [];
    $scope.labMode = false;

    //標題跑馬燈 Marquee
    $scope.duration = 10000;

    function addMarquee(musicLists) {
        if (musicLists.length > 0)
            musicLists.forEach(function(m, i) {
                m.marquee = { scroll: false };

            });
    }

    //youtube
    $scope.playerVars = {
        controls: 0,
        autoplay: 1
    };



    //$scope.priceSlider = 150;
    $scope.slider = {
        value: 50,
        options: {
            id: 'ntu-id',
            floor: 0,
            ceil: 100,
            showSelectionBar: true,
            hidePointerLabels: true,
            hidePointerLabels: true,
            hideLimitLabels: true,
            // showSelectionBarFromValue: true,
            onChange: function(id, value) {
                console.log('on change ' + value);
                PlayerFactory.setVolume(value).then(function(data) {
                    console.log(data);
                });
            }
        }
    };


    $scope.init = function() {
        $scope.musicLists = loadSearch();
        var favoriteLists = loadFavorite();
        $scope.favoriteLists = favoriteLists;
        if (favoriteLists)
            $scope.musicLists.forEach(function(m, i) {
                favoriteLists.forEach(function(f, j) {
                    if (m._id == f._id) m.isFavorite = true;
                });
            });
        addMarquee($scope.musicLists);



        if ($scope.labMode) {
            //實驗室模式
            //讀取音量
            PlayerFactory.loadVolume(value).then(function(data) {
                console.log(data);
                $scope.slider.value = data;
            });

        }

    }


    $scope.switchLabMode = function(event) {
        event.preventDefault();
        console.log("WELCOME TO NTU ICAN LAB!")
        $scope.labMode = !$scope.labMode;

        if ($scope.labMode) {
            //實驗室模式
            //讀取音量
            PlayerFactory.loadVolume(value).then(function(data) {
                console.log(data);
                $scope.slider.value = data;
            });

        }
    }

    $scope.switchFavorite = function() {
        $scope.isFavoriteMode = !$scope.isFavoriteMode;
        if ($scope.isFavoriteMode) {
            var favoriteLists = loadFavorite();
            $scope.favoriteLists = favoriteLists;
            $scope.musicLists = favoriteLists;
        } else {
            $scope.init();
        }

    }


    $scope.labPause = function() {
        PlayerFactory.pause().then(function(data) {
            console.log(data);
        });
    }

    $scope.labStop = function() {
        PlayerFactory.play("").then(function(data) {
            console.log(data);
        });
    }

    $scope.search = function(query) {

        $scope.musicLists = [];
        $scope.searching = true;
        googleService.googleApiClientReady(query).then(function(data) {

            if (data.items) {
                data.items.forEach(function(item, i) {
                    if (item['id']['videoId']) {
                        var musicCard = {};
                        musicCard._id = item['id']['videoId'];
                        musicCard.title = item['snippet']['title'];
                        musicCard.url = "https://www.youtube.com/embed/" + musicCard._id;
                        musicCard.image = "http://img.youtube.com/vi/" + musicCard._id + "/0.jpg";
                        musicCard.description = item['snippet']['description'];
                        musicCard.isSelect = false;
                        musicCard.isFavorite = false;
                        $scope.musicLists.push(musicCard);
                    }
                });


            } else {
                alert("搜尋錯誤");
            }
            $scope.searching = false;
            saveSearch($scope.musicLists);
            addMarquee($scope.musicLists);
        });


    }


    function loadSearch() {
        console.log("讀取上次搜尋狀態..");
        if (localStorageService.isSupported) {
            return getLocalStorge('NTU-ICAN-PLAYER-SEARCH');
        }

    }

    function saveSearch(musicLists) {

        if (localStorageService.isSupported) {

            setLocalStorge('NTU-ICAN-PLAYER-SEARCH', musicLists)
        }


    }



    $scope.playVideo = function(event, musicCard) {
        event.preventDefault();
        event.stopPropagation();
        console.log(musicCard);
        // playVideoSetting(musicCard);

        playVideoInPlayer(musicCard._id);
    }

    // function playVideoSetting(musicCard) {
    //     var toggle = true;
    //     if (musicCard.isPlayingVideo == true)
    //         toggle = false;

    //     cleanIsPlaying();
    //     musicCard.isSelect = toggle;

    // }

    // function cleanIsPlaying() {
    //     $scope.musicLists.forEach(function(musicCard, i) {
    //         musicCard.isPlayingVideo = false;

    //     });

    // }

    function playVideoInPlayer(_id) {
        $scope.currentYoutubeVideo = _id;

    }

    $scope.addToMyFavorite = function(event, musicCard) {
        event.preventDefault();
        event.stopPropagation();
        musicCard.isFavorite = !musicCard.isFavorite;



        // var favoriteLists = $scope.musicLists.filter(function(m) {
        //     if (m.isFavorite)
        //         return m;
        //     else
        //         return 0;
        // });
        if (musicCard.isFavorite)
            $scope.favoriteLists.push(musicCard);
        else {

            var idx = $scope.favoriteLists.indexOf(musicCard);
            $scope.favoriteLists.splice(idx, 1);

        }



        addMarquee($scope.favoriteLists);
        saveFavorite($scope.favoriteLists);

    }

    function loadFavorite() {
        if (localStorageService.isSupported) {
            return getLocalStorge('NTU-ICAN-PLAYER-FAVORITE');
        }
    }

    function saveFavorite(musicLists) {

        if (localStorageService.isSupported) {

            setLocalStorge('NTU-ICAN-PLAYER-FAVORITE', musicLists)
        }


    }

    function setLocalStorge(key, val) {
        return localStorageService.set(key, val);
    }

    function getLocalStorge(key) {
        return localStorageService.get(key);
    }


    $scope.addToPlayerList = function(event, musicCard) {
        event.preventDefault();
        event.stopPropagation();



        // console.log(musicCard);

    }



    $scope.selectMusicCard = function(musicCard) {
        var toggle = true;
        if (musicCard.isSelect == true)
            toggle = false;

        cleanSelected();

        musicCard.isSelect = toggle;

    }


    function saveMyFavorite() {
        $scope.musicLists.forEach(function(musicCard, i) {
            musicCard.isSelect = false;

        });

    }

    function cleanSelected() {
        $scope.musicLists.forEach(function(musicCard, i) {
            musicCard.isSelect = false;

        });

    }

});

app.factory('PlayerFactory', function($q, $http) {

    var _factory = {};
    _factory.play = function(id) {
        return $http.get("http://140.112.26.236:80/music?id=" + id);
    };
    _factory.loadVolume = function() {
        return $http.get("http://140.112.26.236:80/get_volume");
    };
    _factory.setVolume = function(range) {
        return $http.get("http://140.112.26.236:80/set_volume?volume=" + range);
    };
    _factory.pause = function() {
        return $http.get("http://140.112.26.236:80/pause_and_play");
    };


    // _factory.acceptInivte = function(inviteId) {
    //     return $http.post("/api/invite/accept", {
    //         id: inviteId
    //     });
    // };



    return _factory;
});

app.factory('googleService', function($q, $http) {

    var _factory = {};
    _factory.listInvites = function(projectId) {
        return $http.get("/api/invite/list-invites?projectId=" + projectId);
    };

    _factory.acceptInivte = function(inviteId) {
        return $http.post("/api/invite/accept", {
            id: inviteId
        });
    };

    _factory.googleApiClientReady = function(query) {
        var deferred = $q.defer();

        gapi.client.load('youtube', 'v3', function() {
            gapi.client.setApiKey('AIzaSyCRwMuGP50aOvrptyXRZtveE50faOLb8R0');
            var request = gapi.client.youtube.search.list({
                part: 'snippet',
                q: query,
                maxResults: 24
            });
            request.execute(function(response) {

                deferred.resolve(response.result);
            });
        });

        return deferred.promise;
    };

    return _factory;
});



var debounce = function(func, wait) {
    // we need to save these in the closure
    var timeout, args, context, timestamp;

    return function() {

        // save details of latest call
        context = this;
        args = [].slice.call(arguments, 0);
        timestamp = new Date();

        // this is where the magic happens
        var later = function() {

            // how long ago was the last call
            var last = (new Date()) - timestamp;

            // if the latest call was less that the wait period ago
            // then we reset the timeout to wait for the difference
            if (last < wait) {
                timeout = setTimeout(later, wait - last);

                // or if not we can null out the timer and run the latest
            } else {
                timeout = null;
                func.apply(context, args);
            }
        };

        // we only need to set the timer now if one isn't already running
        if (!timeout) {
            timeout = setTimeout(later, wait);
        }
    }
};

/*!
 * MizJs v1.0.0 
 * Copyright MizTech
 * Licensed MikeZheng
 * http://mike-zheng.github.io/
 */
 
// ! jQuery v1.9.1 | (c) 2005, 2012 jQuery Foundation, Inc. | jquery.org/license
//@ sourceMappingURL=jquery.min.map
(function(e,t){var n,r,i=typeof t,o=e.document,a=e.location,s=e.jQuery,u=e.$,l={},c=[],p="1.9.1",f=c.concat,d=c.push,h=c.slice,g=c.indexOf,m=l.toString,y=l.hasOwnProperty,v=p.trim,b=function(e,t){return new b.fn.init(e,t,r)},x=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,w=/\S+/g,T=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,N=/^(?:(<[\w\W]+>)[^>]*|#([\w-]*))$/,C=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,k=/^[\],:{}\s]*$/,E=/(?:^|:|,)(?:\s*\[)+/g,S=/\\(?:["\\\/bfnrt]|u[\da-fA-F]{4})/g,A=/"[^"\\\r\n]*"|true|false|null|-?(?:\d+\.|)\d+(?:[eE][+-]?\d+|)/g,j=/^-ms-/,D=/-([\da-z])/gi,L=function(e,t){return t.toUpperCase()},H=function(e){(o.addEventListener||"load"===e.type||"complete"===o.readyState)&&(q(),b.ready())},q=function(){o.addEventListener?(o.removeEventListener("DOMContentLoaded",H,!1),e.removeEventListener("load",H,!1)):(o.detachEvent("onreadystatechange",H),e.detachEvent("onload",H))};b.fn=b.prototype={jquery:p,constructor:b,init:function(e,n,r){var i,a;if(!e)return this;if("string"==typeof e){if(i="<"===e.charAt(0)&&">"===e.charAt(e.length-1)&&e.length>=3?[null,e,null]:N.exec(e),!i||!i[1]&&n)return!n||n.jquery?(n||r).find(e):this.constructor(n).find(e);if(i[1]){if(n=n instanceof b?n[0]:n,b.merge(this,b.parseHTML(i[1],n&&n.nodeType?n.ownerDocument||n:o,!0)),C.test(i[1])&&b.isPlainObject(n))for(i in n)b.isFunction(this[i])?this[i](n[i]):this.attr(i,n[i]);return this}if(a=o.getElementById(i[2]),a&&a.parentNode){if(a.id!==i[2])return r.find(e);this.length=1,this[0]=a}return this.context=o,this.selector=e,this}return e.nodeType?(this.context=this[0]=e,this.length=1,this):b.isFunction(e)?r.ready(e):(e.selector!==t&&(this.selector=e.selector,this.context=e.context),b.makeArray(e,this))},selector:"",length:0,size:function(){return this.length},toArray:function(){return h.call(this)},get:function(e){return null==e?this.toArray():0>e?this[this.length+e]:this[e]},pushStack:function(e){var t=b.merge(this.constructor(),e);return t.prevObject=this,t.context=this.context,t},each:function(e,t){return b.each(this,e,t)},ready:function(e){return b.ready.promise().done(e),this},slice:function(){return this.pushStack(h.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(e){var t=this.length,n=+e+(0>e?t:0);return this.pushStack(n>=0&&t>n?[this[n]]:[])},map:function(e){return this.pushStack(b.map(this,function(t,n){return e.call(t,n,t)}))},end:function(){return this.prevObject||this.constructor(null)},push:d,sort:[].sort,splice:[].splice},b.fn.init.prototype=b.fn,b.extend=b.fn.extend=function(){var e,n,r,i,o,a,s=arguments[0]||{},u=1,l=arguments.length,c=!1;for("boolean"==typeof s&&(c=s,s=arguments[1]||{},u=2),"object"==typeof s||b.isFunction(s)||(s={}),l===u&&(s=this,--u);l>u;u++)if(null!=(o=arguments[u]))for(i in o)e=s[i],r=o[i],s!==r&&(c&&r&&(b.isPlainObject(r)||(n=b.isArray(r)))?(n?(n=!1,a=e&&b.isArray(e)?e:[]):a=e&&b.isPlainObject(e)?e:{},s[i]=b.extend(c,a,r)):r!==t&&(s[i]=r));return s},b.extend({noConflict:function(t){return e.$===b&&(e.$=u),t&&e.jQuery===b&&(e.jQuery=s),b},isReady:!1,readyWait:1,holdReady:function(e){e?b.readyWait++:b.ready(!0)},ready:function(e){if(e===!0?!--b.readyWait:!b.isReady){if(!o.body)return setTimeout(b.ready);b.isReady=!0,e!==!0&&--b.readyWait>0||(n.resolveWith(o,[b]),b.fn.trigger&&b(o).trigger("ready").off("ready"))}},isFunction:function(e){return"function"===b.type(e)},isArray:Array.isArray||function(e){return"array"===b.type(e)},isWindow:function(e){return null!=e&&e==e.window},isNumeric:function(e){return!isNaN(parseFloat(e))&&isFinite(e)},type:function(e){return null==e?e+"":"object"==typeof e||"function"==typeof e?l[m.call(e)]||"object":typeof e},isPlainObject:function(e){if(!e||"object"!==b.type(e)||e.nodeType||b.isWindow(e))return!1;try{if(e.constructor&&!y.call(e,"constructor")&&!y.call(e.constructor.prototype,"isPrototypeOf"))return!1}catch(n){return!1}var r;for(r in e);return r===t||y.call(e,r)},isEmptyObject:function(e){var t;for(t in e)return!1;return!0},error:function(e){throw Error(e)},parseHTML:function(e,t,n){if(!e||"string"!=typeof e)return null;"boolean"==typeof t&&(n=t,t=!1),t=t||o;var r=C.exec(e),i=!n&&[];return r?[t.createElement(r[1])]:(r=b.buildFragment([e],t,i),i&&b(i).remove(),b.merge([],r.childNodes))},parseJSON:function(n){return e.JSON&&e.JSON.parse?e.JSON.parse(n):null===n?n:"string"==typeof n&&(n=b.trim(n),n&&k.test(n.replace(S,"@").replace(A,"]").replace(E,"")))?Function("return "+n)():(b.error("Invalid JSON: "+n),t)},parseXML:function(n){var r,i;if(!n||"string"!=typeof n)return null;try{e.DOMParser?(i=new DOMParser,r=i.parseFromString(n,"text/xml")):(r=new ActiveXObject("Microsoft.XMLDOM"),r.async="false",r.loadXML(n))}catch(o){r=t}return r&&r.documentElement&&!r.getElementsByTagName("parsererror").length||b.error("Invalid XML: "+n),r},noop:function(){},globalEval:function(t){t&&b.trim(t)&&(e.execScript||function(t){e.eval.call(e,t)})(t)},camelCase:function(e){return e.replace(j,"ms-").replace(D,L)},nodeName:function(e,t){return e.nodeName&&e.nodeName.toLowerCase()===t.toLowerCase()},each:function(e,t,n){var r,i=0,o=e.length,a=M(e);if(n){if(a){for(;o>i;i++)if(r=t.apply(e[i],n),r===!1)break}else for(i in e)if(r=t.apply(e[i],n),r===!1)break}else if(a){for(;o>i;i++)if(r=t.call(e[i],i,e[i]),r===!1)break}else for(i in e)if(r=t.call(e[i],i,e[i]),r===!1)break;return e},trim:v&&!v.call("\ufeff\u00a0")?function(e){return null==e?"":v.call(e)}:function(e){return null==e?"":(e+"").replace(T,"")},makeArray:function(e,t){var n=t||[];return null!=e&&(M(Object(e))?b.merge(n,"string"==typeof e?[e]:e):d.call(n,e)),n},inArray:function(e,t,n){var r;if(t){if(g)return g.call(t,e,n);for(r=t.length,n=n?0>n?Math.max(0,r+n):n:0;r>n;n++)if(n in t&&t[n]===e)return n}return-1},merge:function(e,n){var r=n.length,i=e.length,o=0;if("number"==typeof r)for(;r>o;o++)e[i++]=n[o];else while(n[o]!==t)e[i++]=n[o++];return e.length=i,e},grep:function(e,t,n){var r,i=[],o=0,a=e.length;for(n=!!n;a>o;o++)r=!!t(e[o],o),n!==r&&i.push(e[o]);return i},map:function(e,t,n){var r,i=0,o=e.length,a=M(e),s=[];if(a)for(;o>i;i++)r=t(e[i],i,n),null!=r&&(s[s.length]=r);else for(i in e)r=t(e[i],i,n),null!=r&&(s[s.length]=r);return f.apply([],s)},guid:1,proxy:function(e,n){var r,i,o;return"string"==typeof n&&(o=e[n],n=e,e=o),b.isFunction(e)?(r=h.call(arguments,2),i=function(){return e.apply(n||this,r.concat(h.call(arguments)))},i.guid=e.guid=e.guid||b.guid++,i):t},access:function(e,n,r,i,o,a,s){var u=0,l=e.length,c=null==r;if("object"===b.type(r)){o=!0;for(u in r)b.access(e,n,u,r[u],!0,a,s)}else if(i!==t&&(o=!0,b.isFunction(i)||(s=!0),c&&(s?(n.call(e,i),n=null):(c=n,n=function(e,t,n){return c.call(b(e),n)})),n))for(;l>u;u++)n(e[u],r,s?i:i.call(e[u],u,n(e[u],r)));return o?e:c?n.call(e):l?n(e[0],r):a},now:function(){return(new Date).getTime()}}),b.ready.promise=function(t){if(!n)if(n=b.Deferred(),"complete"===o.readyState)setTimeout(b.ready);else if(o.addEventListener)o.addEventListener("DOMContentLoaded",H,!1),e.addEventListener("load",H,!1);else{o.attachEvent("onreadystatechange",H),e.attachEvent("onload",H);var r=!1;try{r=null==e.frameElement&&o.documentElement}catch(i){}r&&r.doScroll&&function a(){if(!b.isReady){try{r.doScroll("left")}catch(e){return setTimeout(a,50)}q(),b.ready()}}()}return n.promise(t)},b.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(e,t){l["[object "+t+"]"]=t.toLowerCase()});function M(e){var t=e.length,n=b.type(e);return b.isWindow(e)?!1:1===e.nodeType&&t?!0:"array"===n||"function"!==n&&(0===t||"number"==typeof t&&t>0&&t-1 in e)}r=b(o);var _={};function F(e){var t=_[e]={};return b.each(e.match(w)||[],function(e,n){t[n]=!0}),t}b.Callbacks=function(e){e="string"==typeof e?_[e]||F(e):b.extend({},e);var n,r,i,o,a,s,u=[],l=!e.once&&[],c=function(t){for(r=e.memory&&t,i=!0,a=s||0,s=0,o=u.length,n=!0;u&&o>a;a++)if(u[a].apply(t[0],t[1])===!1&&e.stopOnFalse){r=!1;break}n=!1,u&&(l?l.length&&c(l.shift()):r?u=[]:p.disable())},p={add:function(){if(u){var t=u.length;(function i(t){b.each(t,function(t,n){var r=b.type(n);"function"===r?e.unique&&p.has(n)||u.push(n):n&&n.length&&"string"!==r&&i(n)})})(arguments),n?o=u.length:r&&(s=t,c(r))}return this},remove:function(){return u&&b.each(arguments,function(e,t){var r;while((r=b.inArray(t,u,r))>-1)u.splice(r,1),n&&(o>=r&&o--,a>=r&&a--)}),this},has:function(e){return e?b.inArray(e,u)>-1:!(!u||!u.length)},empty:function(){return u=[],this},disable:function(){return u=l=r=t,this},disabled:function(){return!u},lock:function(){return l=t,r||p.disable(),this},locked:function(){return!l},fireWith:function(e,t){return t=t||[],t=[e,t.slice?t.slice():t],!u||i&&!l||(n?l.push(t):c(t)),this},fire:function(){return p.fireWith(this,arguments),this},fired:function(){return!!i}};return p},b.extend({Deferred:function(e){var t=[["resolve","done",b.Callbacks("once memory"),"resolved"],["reject","fail",b.Callbacks("once memory"),"rejected"],["notify","progress",b.Callbacks("memory")]],n="pending",r={state:function(){return n},always:function(){return i.done(arguments).fail(arguments),this},then:function(){var e=arguments;return b.Deferred(function(n){b.each(t,function(t,o){var a=o[0],s=b.isFunction(e[t])&&e[t];i[o[1]](function(){var e=s&&s.apply(this,arguments);e&&b.isFunction(e.promise)?e.promise().done(n.resolve).fail(n.reject).progress(n.notify):n[a+"With"](this===r?n.promise():this,s?[e]:arguments)})}),e=null}).promise()},promise:function(e){return null!=e?b.extend(e,r):r}},i={};return r.pipe=r.then,b.each(t,function(e,o){var a=o[2],s=o[3];r[o[1]]=a.add,s&&a.add(function(){n=s},t[1^e][2].disable,t[2][2].lock),i[o[0]]=function(){return i[o[0]+"With"](this===i?r:this,arguments),this},i[o[0]+"With"]=a.fireWith}),r.promise(i),e&&e.call(i,i),i},when:function(e){var t=0,n=h.call(arguments),r=n.length,i=1!==r||e&&b.isFunction(e.promise)?r:0,o=1===i?e:b.Deferred(),a=function(e,t,n){return function(r){t[e]=this,n[e]=arguments.length>1?h.call(arguments):r,n===s?o.notifyWith(t,n):--i||o.resolveWith(t,n)}},s,u,l;if(r>1)for(s=Array(r),u=Array(r),l=Array(r);r>t;t++)n[t]&&b.isFunction(n[t].promise)?n[t].promise().done(a(t,l,n)).fail(o.reject).progress(a(t,u,s)):--i;return i||o.resolveWith(l,n),o.promise()}}),b.support=function(){var t,n,r,a,s,u,l,c,p,f,d=o.createElement("div");if(d.setAttribute("className","t"),d.innerHTML="  <link/><table></table><a href='/a'>a</a><input type='checkbox'/>",n=d.getElementsByTagName("*"),r=d.getElementsByTagName("a")[0],!n||!r||!n.length)return{};s=o.createElement("select"),l=s.appendChild(o.createElement("option")),a=d.getElementsByTagName("input")[0],r.style.cssText="top:1px;float:left;opacity:.5",t={getSetAttribute:"t"!==d.className,leadingWhitespace:3===d.firstChild.nodeType,tbody:!d.getElementsByTagName("tbody").length,htmlSerialize:!!d.getElementsByTagName("link").length,style:/top/.test(r.getAttribute("style")),hrefNormalized:"/a"===r.getAttribute("href"),opacity:/^0.5/.test(r.style.opacity),cssFloat:!!r.style.cssFloat,checkOn:!!a.value,optSelected:l.selected,enctype:!!o.createElement("form").enctype,html5Clone:"<:nav></:nav>"!==o.createElement("nav").cloneNode(!0).outerHTML,boxModel:"CSS1Compat"===o.compatMode,deleteExpando:!0,noCloneEvent:!0,inlineBlockNeedsLayout:!1,shrinkWrapBlocks:!1,reliableMarginRight:!0,boxSizingReliable:!0,pixelPosition:!1},a.checked=!0,t.noCloneChecked=a.cloneNode(!0).checked,s.disabled=!0,t.optDisabled=!l.disabled;try{delete d.test}catch(h){t.deleteExpando=!1}a=o.createElement("input"),a.setAttribute("value",""),t.input=""===a.getAttribute("value"),a.value="t",a.setAttribute("type","radio"),t.radioValue="t"===a.value,a.setAttribute("checked","t"),a.setAttribute("name","t"),u=o.createDocumentFragment(),u.appendChild(a),t.appendChecked=a.checked,t.checkClone=u.cloneNode(!0).cloneNode(!0).lastChild.checked,d.attachEvent&&(d.attachEvent("onclick",function(){t.noCloneEvent=!1}),d.cloneNode(!0).click());for(f in{submit:!0,change:!0,focusin:!0})d.setAttribute(c="on"+f,"t"),t[f+"Bubbles"]=c in e||d.attributes[c].expando===!1;return d.style.backgroundClip="content-box",d.cloneNode(!0).style.backgroundClip="",t.clearCloneStyle="content-box"===d.style.backgroundClip,b(function(){var n,r,a,s="padding:0;margin:0;border:0;display:block;box-sizing:content-box;-moz-box-sizing:content-box;-webkit-box-sizing:content-box;",u=o.getElementsByTagName("body")[0];u&&(n=o.createElement("div"),n.style.cssText="border:0;width:0;height:0;position:absolute;top:0;left:-9999px;margin-top:1px",u.appendChild(n).appendChild(d),d.innerHTML="<table><tr><td></td><td>t</td></tr></table>",a=d.getElementsByTagName("td"),a[0].style.cssText="padding:0;margin:0;border:0;display:none",p=0===a[0].offsetHeight,a[0].style.display="",a[1].style.display="none",t.reliableHiddenOffsets=p&&0===a[0].offsetHeight,d.innerHTML="",d.style.cssText="box-sizing:border-box;-moz-box-sizing:border-box;-webkit-box-sizing:border-box;padding:1px;border:1px;display:block;width:4px;margin-top:1%;position:absolute;top:1%;",t.boxSizing=4===d.offsetWidth,t.doesNotIncludeMarginInBodyOffset=1!==u.offsetTop,e.getComputedStyle&&(t.pixelPosition="1%"!==(e.getComputedStyle(d,null)||{}).top,t.boxSizingReliable="4px"===(e.getComputedStyle(d,null)||{width:"4px"}).width,r=d.appendChild(o.createElement("div")),r.style.cssText=d.style.cssText=s,r.style.marginRight=r.style.width="0",d.style.width="1px",t.reliableMarginRight=!parseFloat((e.getComputedStyle(r,null)||{}).marginRight)),typeof d.style.zoom!==i&&(d.innerHTML="",d.style.cssText=s+"width:1px;padding:1px;display:inline;zoom:1",t.inlineBlockNeedsLayout=3===d.offsetWidth,d.style.display="block",d.innerHTML="<div></div>",d.firstChild.style.width="5px",t.shrinkWrapBlocks=3!==d.offsetWidth,t.inlineBlockNeedsLayout&&(u.style.zoom=1)),u.removeChild(n),n=d=a=r=null)}),n=s=u=l=r=a=null,t}();var O=/(?:\{[\s\S]*\}|\[[\s\S]*\])$/,B=/([A-Z])/g;function P(e,n,r,i){if(b.acceptData(e)){var o,a,s=b.expando,u="string"==typeof n,l=e.nodeType,p=l?b.cache:e,f=l?e[s]:e[s]&&s;if(f&&p[f]&&(i||p[f].data)||!u||r!==t)return f||(l?e[s]=f=c.pop()||b.guid++:f=s),p[f]||(p[f]={},l||(p[f].toJSON=b.noop)),("object"==typeof n||"function"==typeof n)&&(i?p[f]=b.extend(p[f],n):p[f].data=b.extend(p[f].data,n)),o=p[f],i||(o.data||(o.data={}),o=o.data),r!==t&&(o[b.camelCase(n)]=r),u?(a=o[n],null==a&&(a=o[b.camelCase(n)])):a=o,a}}function R(e,t,n){if(b.acceptData(e)){var r,i,o,a=e.nodeType,s=a?b.cache:e,u=a?e[b.expando]:b.expando;if(s[u]){if(t&&(o=n?s[u]:s[u].data)){b.isArray(t)?t=t.concat(b.map(t,b.camelCase)):t in o?t=[t]:(t=b.camelCase(t),t=t in o?[t]:t.split(" "));for(r=0,i=t.length;i>r;r++)delete o[t[r]];if(!(n?$:b.isEmptyObject)(o))return}(n||(delete s[u].data,$(s[u])))&&(a?b.cleanData([e],!0):b.support.deleteExpando||s!=s.window?delete s[u]:s[u]=null)}}}b.extend({cache:{},expando:"jQuery"+(p+Math.random()).replace(/\D/g,""),noData:{embed:!0,object:"clsid:D27CDB6E-AE6D-11cf-96B8-444553540000",applet:!0},hasData:function(e){return e=e.nodeType?b.cache[e[b.expando]]:e[b.expando],!!e&&!$(e)},data:function(e,t,n){return P(e,t,n)},removeData:function(e,t){return R(e,t)},_data:function(e,t,n){return P(e,t,n,!0)},_removeData:function(e,t){return R(e,t,!0)},acceptData:function(e){if(e.nodeType&&1!==e.nodeType&&9!==e.nodeType)return!1;var t=e.nodeName&&b.noData[e.nodeName.toLowerCase()];return!t||t!==!0&&e.getAttribute("classid")===t}}),b.fn.extend({data:function(e,n){var r,i,o=this[0],a=0,s=null;if(e===t){if(this.length&&(s=b.data(o),1===o.nodeType&&!b._data(o,"parsedAttrs"))){for(r=o.attributes;r.length>a;a++)i=r[a].name,i.indexOf("data-")||(i=b.camelCase(i.slice(5)),W(o,i,s[i]));b._data(o,"parsedAttrs",!0)}return s}return"object"==typeof e?this.each(function(){b.data(this,e)}):b.access(this,function(n){return n===t?o?W(o,e,b.data(o,e)):null:(this.each(function(){b.data(this,e,n)}),t)},null,n,arguments.length>1,null,!0)},removeData:function(e){return this.each(function(){b.removeData(this,e)})}});function W(e,n,r){if(r===t&&1===e.nodeType){var i="data-"+n.replace(B,"-$1").toLowerCase();if(r=e.getAttribute(i),"string"==typeof r){try{r="true"===r?!0:"false"===r?!1:"null"===r?null:+r+""===r?+r:O.test(r)?b.parseJSON(r):r}catch(o){}b.data(e,n,r)}else r=t}return r}function $(e){var t;for(t in e)if(("data"!==t||!b.isEmptyObject(e[t]))&&"toJSON"!==t)return!1;return!0}b.extend({queue:function(e,n,r){var i;return e?(n=(n||"fx")+"queue",i=b._data(e,n),r&&(!i||b.isArray(r)?i=b._data(e,n,b.makeArray(r)):i.push(r)),i||[]):t},dequeue:function(e,t){t=t||"fx";var n=b.queue(e,t),r=n.length,i=n.shift(),o=b._queueHooks(e,t),a=function(){b.dequeue(e,t)};"inprogress"===i&&(i=n.shift(),r--),o.cur=i,i&&("fx"===t&&n.unshift("inprogress"),delete o.stop,i.call(e,a,o)),!r&&o&&o.empty.fire()},_queueHooks:function(e,t){var n=t+"queueHooks";return b._data(e,n)||b._data(e,n,{empty:b.Callbacks("once memory").add(function(){b._removeData(e,t+"queue"),b._removeData(e,n)})})}}),b.fn.extend({queue:function(e,n){var r=2;return"string"!=typeof e&&(n=e,e="fx",r--),r>arguments.length?b.queue(this[0],e):n===t?this:this.each(function(){var t=b.queue(this,e,n);b._queueHooks(this,e),"fx"===e&&"inprogress"!==t[0]&&b.dequeue(this,e)})},dequeue:function(e){return this.each(function(){b.dequeue(this,e)})},delay:function(e,t){return e=b.fx?b.fx.speeds[e]||e:e,t=t||"fx",this.queue(t,function(t,n){var r=setTimeout(t,e);n.stop=function(){clearTimeout(r)}})},clearQueue:function(e){return this.queue(e||"fx",[])},promise:function(e,n){var r,i=1,o=b.Deferred(),a=this,s=this.length,u=function(){--i||o.resolveWith(a,[a])};"string"!=typeof e&&(n=e,e=t),e=e||"fx";while(s--)r=b._data(a[s],e+"queueHooks"),r&&r.empty&&(i++,r.empty.add(u));return u(),o.promise(n)}});var I,z,X=/[\t\r\n]/g,U=/\r/g,V=/^(?:input|select|textarea|button|object)$/i,Y=/^(?:a|area)$/i,J=/^(?:checked|selected|autofocus|autoplay|async|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped)$/i,G=/^(?:checked|selected)$/i,Q=b.support.getSetAttribute,K=b.support.input;b.fn.extend({attr:function(e,t){return b.access(this,b.attr,e,t,arguments.length>1)},removeAttr:function(e){return this.each(function(){b.removeAttr(this,e)})},prop:function(e,t){return b.access(this,b.prop,e,t,arguments.length>1)},removeProp:function(e){return e=b.propFix[e]||e,this.each(function(){try{this[e]=t,delete this[e]}catch(n){}})},addClass:function(e){var t,n,r,i,o,a=0,s=this.length,u="string"==typeof e&&e;if(b.isFunction(e))return this.each(function(t){b(this).addClass(e.call(this,t,this.className))});if(u)for(t=(e||"").match(w)||[];s>a;a++)if(n=this[a],r=1===n.nodeType&&(n.className?(" "+n.className+" ").replace(X," "):" ")){o=0;while(i=t[o++])0>r.indexOf(" "+i+" ")&&(r+=i+" ");n.className=b.trim(r)}return this},removeClass:function(e){var t,n,r,i,o,a=0,s=this.length,u=0===arguments.length||"string"==typeof e&&e;if(b.isFunction(e))return this.each(function(t){b(this).removeClass(e.call(this,t,this.className))});if(u)for(t=(e||"").match(w)||[];s>a;a++)if(n=this[a],r=1===n.nodeType&&(n.className?(" "+n.className+" ").replace(X," "):"")){o=0;while(i=t[o++])while(r.indexOf(" "+i+" ")>=0)r=r.replace(" "+i+" "," ");n.className=e?b.trim(r):""}return this},toggleClass:function(e,t){var n=typeof e,r="boolean"==typeof t;return b.isFunction(e)?this.each(function(n){b(this).toggleClass(e.call(this,n,this.className,t),t)}):this.each(function(){if("string"===n){var o,a=0,s=b(this),u=t,l=e.match(w)||[];while(o=l[a++])u=r?u:!s.hasClass(o),s[u?"addClass":"removeClass"](o)}else(n===i||"boolean"===n)&&(this.className&&b._data(this,"__className__",this.className),this.className=this.className||e===!1?"":b._data(this,"__className__")||"")})},hasClass:function(e){var t=" "+e+" ",n=0,r=this.length;for(;r>n;n++)if(1===this[n].nodeType&&(" "+this[n].className+" ").replace(X," ").indexOf(t)>=0)return!0;return!1},val:function(e){var n,r,i,o=this[0];{if(arguments.length)return i=b.isFunction(e),this.each(function(n){var o,a=b(this);1===this.nodeType&&(o=i?e.call(this,n,a.val()):e,null==o?o="":"number"==typeof o?o+="":b.isArray(o)&&(o=b.map(o,function(e){return null==e?"":e+""})),r=b.valHooks[this.type]||b.valHooks[this.nodeName.toLowerCase()],r&&"set"in r&&r.set(this,o,"value")!==t||(this.value=o))});if(o)return r=b.valHooks[o.type]||b.valHooks[o.nodeName.toLowerCase()],r&&"get"in r&&(n=r.get(o,"value"))!==t?n:(n=o.value,"string"==typeof n?n.replace(U,""):null==n?"":n)}}}),b.extend({valHooks:{option:{get:function(e){var t=e.attributes.value;return!t||t.specified?e.value:e.text}},select:{get:function(e){var t,n,r=e.options,i=e.selectedIndex,o="select-one"===e.type||0>i,a=o?null:[],s=o?i+1:r.length,u=0>i?s:o?i:0;for(;s>u;u++)if(n=r[u],!(!n.selected&&u!==i||(b.support.optDisabled?n.disabled:null!==n.getAttribute("disabled"))||n.parentNode.disabled&&b.nodeName(n.parentNode,"optgroup"))){if(t=b(n).val(),o)return t;a.push(t)}return a},set:function(e,t){var n=b.makeArray(t);return b(e).find("option").each(function(){this.selected=b.inArray(b(this).val(),n)>=0}),n.length||(e.selectedIndex=-1),n}}},attr:function(e,n,r){var o,a,s,u=e.nodeType;if(e&&3!==u&&8!==u&&2!==u)return typeof e.getAttribute===i?b.prop(e,n,r):(a=1!==u||!b.isXMLDoc(e),a&&(n=n.toLowerCase(),o=b.attrHooks[n]||(J.test(n)?z:I)),r===t?o&&a&&"get"in o&&null!==(s=o.get(e,n))?s:(typeof e.getAttribute!==i&&(s=e.getAttribute(n)),null==s?t:s):null!==r?o&&a&&"set"in o&&(s=o.set(e,r,n))!==t?s:(e.setAttribute(n,r+""),r):(b.removeAttr(e,n),t))},removeAttr:function(e,t){var n,r,i=0,o=t&&t.match(w);if(o&&1===e.nodeType)while(n=o[i++])r=b.propFix[n]||n,J.test(n)?!Q&&G.test(n)?e[b.camelCase("default-"+n)]=e[r]=!1:e[r]=!1:b.attr(e,n,""),e.removeAttribute(Q?n:r)},attrHooks:{type:{set:function(e,t){if(!b.support.radioValue&&"radio"===t&&b.nodeName(e,"input")){var n=e.value;return e.setAttribute("type",t),n&&(e.value=n),t}}}},propFix:{tabindex:"tabIndex",readonly:"readOnly","for":"htmlFor","class":"className",maxlength:"maxLength",cellspacing:"cellSpacing",cellpadding:"cellPadding",rowspan:"rowSpan",colspan:"colSpan",usemap:"useMap",frameborder:"frameBorder",contenteditable:"contentEditable"},prop:function(e,n,r){var i,o,a,s=e.nodeType;if(e&&3!==s&&8!==s&&2!==s)return a=1!==s||!b.isXMLDoc(e),a&&(n=b.propFix[n]||n,o=b.propHooks[n]),r!==t?o&&"set"in o&&(i=o.set(e,r,n))!==t?i:e[n]=r:o&&"get"in o&&null!==(i=o.get(e,n))?i:e[n]},propHooks:{tabIndex:{get:function(e){var n=e.getAttributeNode("tabindex");return n&&n.specified?parseInt(n.value,10):V.test(e.nodeName)||Y.test(e.nodeName)&&e.href?0:t}}}}),z={get:function(e,n){var r=b.prop(e,n),i="boolean"==typeof r&&e.getAttribute(n),o="boolean"==typeof r?K&&Q?null!=i:G.test(n)?e[b.camelCase("default-"+n)]:!!i:e.getAttributeNode(n);return o&&o.value!==!1?n.toLowerCase():t},set:function(e,t,n){return t===!1?b.removeAttr(e,n):K&&Q||!G.test(n)?e.setAttribute(!Q&&b.propFix[n]||n,n):e[b.camelCase("default-"+n)]=e[n]=!0,n}},K&&Q||(b.attrHooks.value={get:function(e,n){var r=e.getAttributeNode(n);return b.nodeName(e,"input")?e.defaultValue:r&&r.specified?r.value:t},set:function(e,n,r){return b.nodeName(e,"input")?(e.defaultValue=n,t):I&&I.set(e,n,r)}}),Q||(I=b.valHooks.button={get:function(e,n){var r=e.getAttributeNode(n);return r&&("id"===n||"name"===n||"coords"===n?""!==r.value:r.specified)?r.value:t},set:function(e,n,r){var i=e.getAttributeNode(r);return i||e.setAttributeNode(i=e.ownerDocument.createAttribute(r)),i.value=n+="","value"===r||n===e.getAttribute(r)?n:t}},b.attrHooks.contenteditable={get:I.get,set:function(e,t,n){I.set(e,""===t?!1:t,n)}},b.each(["width","height"],function(e,n){b.attrHooks[n]=b.extend(b.attrHooks[n],{set:function(e,r){return""===r?(e.setAttribute(n,"auto"),r):t}})})),b.support.hrefNormalized||(b.each(["href","src","width","height"],function(e,n){b.attrHooks[n]=b.extend(b.attrHooks[n],{get:function(e){var r=e.getAttribute(n,2);return null==r?t:r}})}),b.each(["href","src"],function(e,t){b.propHooks[t]={get:function(e){return e.getAttribute(t,4)}}})),b.support.style||(b.attrHooks.style={get:function(e){return e.style.cssText||t},set:function(e,t){return e.style.cssText=t+""}}),b.support.optSelected||(b.propHooks.selected=b.extend(b.propHooks.selected,{get:function(e){var t=e.parentNode;return t&&(t.selectedIndex,t.parentNode&&t.parentNode.selectedIndex),null}})),b.support.enctype||(b.propFix.enctype="encoding"),b.support.checkOn||b.each(["radio","checkbox"],function(){b.valHooks[this]={get:function(e){return null===e.getAttribute("value")?"on":e.value}}}),b.each(["radio","checkbox"],function(){b.valHooks[this]=b.extend(b.valHooks[this],{set:function(e,n){return b.isArray(n)?e.checked=b.inArray(b(e).val(),n)>=0:t}})});var Z=/^(?:input|select|textarea)$/i,et=/^key/,tt=/^(?:mouse|contextmenu)|click/,nt=/^(?:focusinfocus|focusoutblur)$/,rt=/^([^.]*)(?:\.(.+)|)$/;function it(){return!0}function ot(){return!1}b.event={global:{},add:function(e,n,r,o,a){var s,u,l,c,p,f,d,h,g,m,y,v=b._data(e);if(v){r.handler&&(c=r,r=c.handler,a=c.selector),r.guid||(r.guid=b.guid++),(u=v.events)||(u=v.events={}),(f=v.handle)||(f=v.handle=function(e){return typeof b===i||e&&b.event.triggered===e.type?t:b.event.dispatch.apply(f.elem,arguments)},f.elem=e),n=(n||"").match(w)||[""],l=n.length;while(l--)s=rt.exec(n[l])||[],g=y=s[1],m=(s[2]||"").split(".").sort(),p=b.event.special[g]||{},g=(a?p.delegateType:p.bindType)||g,p=b.event.special[g]||{},d=b.extend({type:g,origType:y,data:o,handler:r,guid:r.guid,selector:a,needsContext:a&&b.expr.match.needsContext.test(a),namespace:m.join(".")},c),(h=u[g])||(h=u[g]=[],h.delegateCount=0,p.setup&&p.setup.call(e,o,m,f)!==!1||(e.addEventListener?e.addEventListener(g,f,!1):e.attachEvent&&e.attachEvent("on"+g,f))),p.add&&(p.add.call(e,d),d.handler.guid||(d.handler.guid=r.guid)),a?h.splice(h.delegateCount++,0,d):h.push(d),b.event.global[g]=!0;e=null}},remove:function(e,t,n,r,i){var o,a,s,u,l,c,p,f,d,h,g,m=b.hasData(e)&&b._data(e);if(m&&(c=m.events)){t=(t||"").match(w)||[""],l=t.length;while(l--)if(s=rt.exec(t[l])||[],d=g=s[1],h=(s[2]||"").split(".").sort(),d){p=b.event.special[d]||{},d=(r?p.delegateType:p.bindType)||d,f=c[d]||[],s=s[2]&&RegExp("(^|\\.)"+h.join("\\.(?:.*\\.|)")+"(\\.|$)"),u=o=f.length;while(o--)a=f[o],!i&&g!==a.origType||n&&n.guid!==a.guid||s&&!s.test(a.namespace)||r&&r!==a.selector&&("**"!==r||!a.selector)||(f.splice(o,1),a.selector&&f.delegateCount--,p.remove&&p.remove.call(e,a));u&&!f.length&&(p.teardown&&p.teardown.call(e,h,m.handle)!==!1||b.removeEvent(e,d,m.handle),delete c[d])}else for(d in c)b.event.remove(e,d+t[l],n,r,!0);b.isEmptyObject(c)&&(delete m.handle,b._removeData(e,"events"))}},trigger:function(n,r,i,a){var s,u,l,c,p,f,d,h=[i||o],g=y.call(n,"type")?n.type:n,m=y.call(n,"namespace")?n.namespace.split("."):[];if(l=f=i=i||o,3!==i.nodeType&&8!==i.nodeType&&!nt.test(g+b.event.triggered)&&(g.indexOf(".")>=0&&(m=g.split("."),g=m.shift(),m.sort()),u=0>g.indexOf(":")&&"on"+g,n=n[b.expando]?n:new b.Event(g,"object"==typeof n&&n),n.isTrigger=!0,n.namespace=m.join("."),n.namespace_re=n.namespace?RegExp("(^|\\.)"+m.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,n.result=t,n.target||(n.target=i),r=null==r?[n]:b.makeArray(r,[n]),p=b.event.special[g]||{},a||!p.trigger||p.trigger.apply(i,r)!==!1)){if(!a&&!p.noBubble&&!b.isWindow(i)){for(c=p.delegateType||g,nt.test(c+g)||(l=l.parentNode);l;l=l.parentNode)h.push(l),f=l;f===(i.ownerDocument||o)&&h.push(f.defaultView||f.parentWindow||e)}d=0;while((l=h[d++])&&!n.isPropagationStopped())n.type=d>1?c:p.bindType||g,s=(b._data(l,"events")||{})[n.type]&&b._data(l,"handle"),s&&s.apply(l,r),s=u&&l[u],s&&b.acceptData(l)&&s.apply&&s.apply(l,r)===!1&&n.preventDefault();if(n.type=g,!(a||n.isDefaultPrevented()||p._default&&p._default.apply(i.ownerDocument,r)!==!1||"click"===g&&b.nodeName(i,"a")||!b.acceptData(i)||!u||!i[g]||b.isWindow(i))){f=i[u],f&&(i[u]=null),b.event.triggered=g;try{i[g]()}catch(v){}b.event.triggered=t,f&&(i[u]=f)}return n.result}},dispatch:function(e){e=b.event.fix(e);var n,r,i,o,a,s=[],u=h.call(arguments),l=(b._data(this,"events")||{})[e.type]||[],c=b.event.special[e.type]||{};if(u[0]=e,e.delegateTarget=this,!c.preDispatch||c.preDispatch.call(this,e)!==!1){s=b.event.handlers.call(this,e,l),n=0;while((o=s[n++])&&!e.isPropagationStopped()){e.currentTarget=o.elem,a=0;while((i=o.handlers[a++])&&!e.isImmediatePropagationStopped())(!e.namespace_re||e.namespace_re.test(i.namespace))&&(e.handleObj=i,e.data=i.data,r=((b.event.special[i.origType]||{}).handle||i.handler).apply(o.elem,u),r!==t&&(e.result=r)===!1&&(e.preventDefault(),e.stopPropagation()))}return c.postDispatch&&c.postDispatch.call(this,e),e.result}},handlers:function(e,n){var r,i,o,a,s=[],u=n.delegateCount,l=e.target;if(u&&l.nodeType&&(!e.button||"click"!==e.type))for(;l!=this;l=l.parentNode||this)if(1===l.nodeType&&(l.disabled!==!0||"click"!==e.type)){for(o=[],a=0;u>a;a++)i=n[a],r=i.selector+" ",o[r]===t&&(o[r]=i.needsContext?b(r,this).index(l)>=0:b.find(r,this,null,[l]).length),o[r]&&o.push(i);o.length&&s.push({elem:l,handlers:o})}return n.length>u&&s.push({elem:this,handlers:n.slice(u)}),s},fix:function(e){if(e[b.expando])return e;var t,n,r,i=e.type,a=e,s=this.fixHooks[i];s||(this.fixHooks[i]=s=tt.test(i)?this.mouseHooks:et.test(i)?this.keyHooks:{}),r=s.props?this.props.concat(s.props):this.props,e=new b.Event(a),t=r.length;while(t--)n=r[t],e[n]=a[n];return e.target||(e.target=a.srcElement||o),3===e.target.nodeType&&(e.target=e.target.parentNode),e.metaKey=!!e.metaKey,s.filter?s.filter(e,a):e},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(e,t){return null==e.which&&(e.which=null!=t.charCode?t.charCode:t.keyCode),e}},mouseHooks:{props:"button buttons clientX clientY fromElement offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(e,n){var r,i,a,s=n.button,u=n.fromElement;return null==e.pageX&&null!=n.clientX&&(i=e.target.ownerDocument||o,a=i.documentElement,r=i.body,e.pageX=n.clientX+(a&&a.scrollLeft||r&&r.scrollLeft||0)-(a&&a.clientLeft||r&&r.clientLeft||0),e.pageY=n.clientY+(a&&a.scrollTop||r&&r.scrollTop||0)-(a&&a.clientTop||r&&r.clientTop||0)),!e.relatedTarget&&u&&(e.relatedTarget=u===e.target?n.toElement:u),e.which||s===t||(e.which=1&s?1:2&s?3:4&s?2:0),e}},special:{load:{noBubble:!0},click:{trigger:function(){return b.nodeName(this,"input")&&"checkbox"===this.type&&this.click?(this.click(),!1):t}},focus:{trigger:function(){if(this!==o.activeElement&&this.focus)try{return this.focus(),!1}catch(e){}},delegateType:"focusin"},blur:{trigger:function(){return this===o.activeElement&&this.blur?(this.blur(),!1):t},delegateType:"focusout"},beforeunload:{postDispatch:function(e){e.result!==t&&(e.originalEvent.returnValue=e.result)}}},simulate:function(e,t,n,r){var i=b.extend(new b.Event,n,{type:e,isSimulated:!0,originalEvent:{}});r?b.event.trigger(i,null,t):b.event.dispatch.call(t,i),i.isDefaultPrevented()&&n.preventDefault()}},b.removeEvent=o.removeEventListener?function(e,t,n){e.removeEventListener&&e.removeEventListener(t,n,!1)}:function(e,t,n){var r="on"+t;e.detachEvent&&(typeof e[r]===i&&(e[r]=null),e.detachEvent(r,n))},b.Event=function(e,n){return this instanceof b.Event?(e&&e.type?(this.originalEvent=e,this.type=e.type,this.isDefaultPrevented=e.defaultPrevented||e.returnValue===!1||e.getPreventDefault&&e.getPreventDefault()?it:ot):this.type=e,n&&b.extend(this,n),this.timeStamp=e&&e.timeStamp||b.now(),this[b.expando]=!0,t):new b.Event(e,n)},b.Event.prototype={isDefaultPrevented:ot,isPropagationStopped:ot,isImmediatePropagationStopped:ot,preventDefault:function(){var e=this.originalEvent;this.isDefaultPrevented=it,e&&(e.preventDefault?e.preventDefault():e.returnValue=!1)},stopPropagation:function(){var e=this.originalEvent;this.isPropagationStopped=it,e&&(e.stopPropagation&&e.stopPropagation(),e.cancelBubble=!0)},stopImmediatePropagation:function(){this.isImmediatePropagationStopped=it,this.stopPropagation()}},b.each({mouseenter:"mouseover",mouseleave:"mouseout"},function(e,t){b.event.special[e]={delegateType:t,bindType:t,handle:function(e){var n,r=this,i=e.relatedTarget,o=e.handleObj;
return(!i||i!==r&&!b.contains(r,i))&&(e.type=o.origType,n=o.handler.apply(this,arguments),e.type=t),n}}}),b.support.submitBubbles||(b.event.special.submit={setup:function(){return b.nodeName(this,"form")?!1:(b.event.add(this,"click._submit keypress._submit",function(e){var n=e.target,r=b.nodeName(n,"input")||b.nodeName(n,"button")?n.form:t;r&&!b._data(r,"submitBubbles")&&(b.event.add(r,"submit._submit",function(e){e._submit_bubble=!0}),b._data(r,"submitBubbles",!0))}),t)},postDispatch:function(e){e._submit_bubble&&(delete e._submit_bubble,this.parentNode&&!e.isTrigger&&b.event.simulate("submit",this.parentNode,e,!0))},teardown:function(){return b.nodeName(this,"form")?!1:(b.event.remove(this,"._submit"),t)}}),b.support.changeBubbles||(b.event.special.change={setup:function(){return Z.test(this.nodeName)?(("checkbox"===this.type||"radio"===this.type)&&(b.event.add(this,"propertychange._change",function(e){"checked"===e.originalEvent.propertyName&&(this._just_changed=!0)}),b.event.add(this,"click._change",function(e){this._just_changed&&!e.isTrigger&&(this._just_changed=!1),b.event.simulate("change",this,e,!0)})),!1):(b.event.add(this,"beforeactivate._change",function(e){var t=e.target;Z.test(t.nodeName)&&!b._data(t,"changeBubbles")&&(b.event.add(t,"change._change",function(e){!this.parentNode||e.isSimulated||e.isTrigger||b.event.simulate("change",this.parentNode,e,!0)}),b._data(t,"changeBubbles",!0))}),t)},handle:function(e){var n=e.target;return this!==n||e.isSimulated||e.isTrigger||"radio"!==n.type&&"checkbox"!==n.type?e.handleObj.handler.apply(this,arguments):t},teardown:function(){return b.event.remove(this,"._change"),!Z.test(this.nodeName)}}),b.support.focusinBubbles||b.each({focus:"focusin",blur:"focusout"},function(e,t){var n=0,r=function(e){b.event.simulate(t,e.target,b.event.fix(e),!0)};b.event.special[t]={setup:function(){0===n++&&o.addEventListener(e,r,!0)},teardown:function(){0===--n&&o.removeEventListener(e,r,!0)}}}),b.fn.extend({on:function(e,n,r,i,o){var a,s;if("object"==typeof e){"string"!=typeof n&&(r=r||n,n=t);for(a in e)this.on(a,n,r,e[a],o);return this}if(null==r&&null==i?(i=n,r=n=t):null==i&&("string"==typeof n?(i=r,r=t):(i=r,r=n,n=t)),i===!1)i=ot;else if(!i)return this;return 1===o&&(s=i,i=function(e){return b().off(e),s.apply(this,arguments)},i.guid=s.guid||(s.guid=b.guid++)),this.each(function(){b.event.add(this,e,i,r,n)})},one:function(e,t,n,r){return this.on(e,t,n,r,1)},off:function(e,n,r){var i,o;if(e&&e.preventDefault&&e.handleObj)return i=e.handleObj,b(e.delegateTarget).off(i.namespace?i.origType+"."+i.namespace:i.origType,i.selector,i.handler),this;if("object"==typeof e){for(o in e)this.off(o,n,e[o]);return this}return(n===!1||"function"==typeof n)&&(r=n,n=t),r===!1&&(r=ot),this.each(function(){b.event.remove(this,e,r,n)})},bind:function(e,t,n){return this.on(e,null,t,n)},unbind:function(e,t){return this.off(e,null,t)},delegate:function(e,t,n,r){return this.on(t,e,n,r)},undelegate:function(e,t,n){return 1===arguments.length?this.off(e,"**"):this.off(t,e||"**",n)},trigger:function(e,t){return this.each(function(){b.event.trigger(e,t,this)})},triggerHandler:function(e,n){var r=this[0];return r?b.event.trigger(e,n,r,!0):t}}),function(e,t){var n,r,i,o,a,s,u,l,c,p,f,d,h,g,m,y,v,x="sizzle"+-new Date,w=e.document,T={},N=0,C=0,k=it(),E=it(),S=it(),A=typeof t,j=1<<31,D=[],L=D.pop,H=D.push,q=D.slice,M=D.indexOf||function(e){var t=0,n=this.length;for(;n>t;t++)if(this[t]===e)return t;return-1},_="[\\x20\\t\\r\\n\\f]",F="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",O=F.replace("w","w#"),B="([*^$|!~]?=)",P="\\["+_+"*("+F+")"+_+"*(?:"+B+_+"*(?:(['\"])((?:\\\\.|[^\\\\])*?)\\3|("+O+")|)|)"+_+"*\\]",R=":("+F+")(?:\\(((['\"])((?:\\\\.|[^\\\\])*?)\\3|((?:\\\\.|[^\\\\()[\\]]|"+P.replace(3,8)+")*)|.*)\\)|)",W=RegExp("^"+_+"+|((?:^|[^\\\\])(?:\\\\.)*)"+_+"+$","g"),$=RegExp("^"+_+"*,"+_+"*"),I=RegExp("^"+_+"*([\\x20\\t\\r\\n\\f>+~])"+_+"*"),z=RegExp(R),X=RegExp("^"+O+"$"),U={ID:RegExp("^#("+F+")"),CLASS:RegExp("^\\.("+F+")"),NAME:RegExp("^\\[name=['\"]?("+F+")['\"]?\\]"),TAG:RegExp("^("+F.replace("w","w*")+")"),ATTR:RegExp("^"+P),PSEUDO:RegExp("^"+R),CHILD:RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+_+"*(even|odd|(([+-]|)(\\d*)n|)"+_+"*(?:([+-]|)"+_+"*(\\d+)|))"+_+"*\\)|)","i"),needsContext:RegExp("^"+_+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+_+"*((?:-\\d)?\\d*)"+_+"*\\)|)(?=[^-]|$)","i")},V=/[\x20\t\r\n\f]*[+~]/,Y=/^[^{]+\{\s*\[native code/,J=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,G=/^(?:input|select|textarea|button)$/i,Q=/^h\d$/i,K=/'|\\/g,Z=/\=[\x20\t\r\n\f]*([^'"\]]*)[\x20\t\r\n\f]*\]/g,et=/\\([\da-fA-F]{1,6}[\x20\t\r\n\f]?|.)/g,tt=function(e,t){var n="0x"+t-65536;return n!==n?t:0>n?String.fromCharCode(n+65536):String.fromCharCode(55296|n>>10,56320|1023&n)};try{q.call(w.documentElement.childNodes,0)[0].nodeType}catch(nt){q=function(e){var t,n=[];while(t=this[e++])n.push(t);return n}}function rt(e){return Y.test(e+"")}function it(){var e,t=[];return e=function(n,r){return t.push(n+=" ")>i.cacheLength&&delete e[t.shift()],e[n]=r}}function ot(e){return e[x]=!0,e}function at(e){var t=p.createElement("div");try{return e(t)}catch(n){return!1}finally{t=null}}function st(e,t,n,r){var i,o,a,s,u,l,f,g,m,v;if((t?t.ownerDocument||t:w)!==p&&c(t),t=t||p,n=n||[],!e||"string"!=typeof e)return n;if(1!==(s=t.nodeType)&&9!==s)return[];if(!d&&!r){if(i=J.exec(e))if(a=i[1]){if(9===s){if(o=t.getElementById(a),!o||!o.parentNode)return n;if(o.id===a)return n.push(o),n}else if(t.ownerDocument&&(o=t.ownerDocument.getElementById(a))&&y(t,o)&&o.id===a)return n.push(o),n}else{if(i[2])return H.apply(n,q.call(t.getElementsByTagName(e),0)),n;if((a=i[3])&&T.getByClassName&&t.getElementsByClassName)return H.apply(n,q.call(t.getElementsByClassName(a),0)),n}if(T.qsa&&!h.test(e)){if(f=!0,g=x,m=t,v=9===s&&e,1===s&&"object"!==t.nodeName.toLowerCase()){l=ft(e),(f=t.getAttribute("id"))?g=f.replace(K,"\\$&"):t.setAttribute("id",g),g="[id='"+g+"'] ",u=l.length;while(u--)l[u]=g+dt(l[u]);m=V.test(e)&&t.parentNode||t,v=l.join(",")}if(v)try{return H.apply(n,q.call(m.querySelectorAll(v),0)),n}catch(b){}finally{f||t.removeAttribute("id")}}}return wt(e.replace(W,"$1"),t,n,r)}a=st.isXML=function(e){var t=e&&(e.ownerDocument||e).documentElement;return t?"HTML"!==t.nodeName:!1},c=st.setDocument=function(e){var n=e?e.ownerDocument||e:w;return n!==p&&9===n.nodeType&&n.documentElement?(p=n,f=n.documentElement,d=a(n),T.tagNameNoComments=at(function(e){return e.appendChild(n.createComment("")),!e.getElementsByTagName("*").length}),T.attributes=at(function(e){e.innerHTML="<select></select>";var t=typeof e.lastChild.getAttribute("multiple");return"boolean"!==t&&"string"!==t}),T.getByClassName=at(function(e){return e.innerHTML="<div class='hidden e'></div><div class='hidden'></div>",e.getElementsByClassName&&e.getElementsByClassName("e").length?(e.lastChild.className="e",2===e.getElementsByClassName("e").length):!1}),T.getByName=at(function(e){e.id=x+0,e.innerHTML="<a name='"+x+"'></a><div name='"+x+"'></div>",f.insertBefore(e,f.firstChild);var t=n.getElementsByName&&n.getElementsByName(x).length===2+n.getElementsByName(x+0).length;return T.getIdNotName=!n.getElementById(x),f.removeChild(e),t}),i.attrHandle=at(function(e){return e.innerHTML="<a href='#'></a>",e.firstChild&&typeof e.firstChild.getAttribute!==A&&"#"===e.firstChild.getAttribute("href")})?{}:{href:function(e){return e.getAttribute("href",2)},type:function(e){return e.getAttribute("type")}},T.getIdNotName?(i.find.ID=function(e,t){if(typeof t.getElementById!==A&&!d){var n=t.getElementById(e);return n&&n.parentNode?[n]:[]}},i.filter.ID=function(e){var t=e.replace(et,tt);return function(e){return e.getAttribute("id")===t}}):(i.find.ID=function(e,n){if(typeof n.getElementById!==A&&!d){var r=n.getElementById(e);return r?r.id===e||typeof r.getAttributeNode!==A&&r.getAttributeNode("id").value===e?[r]:t:[]}},i.filter.ID=function(e){var t=e.replace(et,tt);return function(e){var n=typeof e.getAttributeNode!==A&&e.getAttributeNode("id");return n&&n.value===t}}),i.find.TAG=T.tagNameNoComments?function(e,n){return typeof n.getElementsByTagName!==A?n.getElementsByTagName(e):t}:function(e,t){var n,r=[],i=0,o=t.getElementsByTagName(e);if("*"===e){while(n=o[i++])1===n.nodeType&&r.push(n);return r}return o},i.find.NAME=T.getByName&&function(e,n){return typeof n.getElementsByName!==A?n.getElementsByName(name):t},i.find.CLASS=T.getByClassName&&function(e,n){return typeof n.getElementsByClassName===A||d?t:n.getElementsByClassName(e)},g=[],h=[":focus"],(T.qsa=rt(n.querySelectorAll))&&(at(function(e){e.innerHTML="<select><option selected=''></option></select>",e.querySelectorAll("[selected]").length||h.push("\\["+_+"*(?:checked|disabled|ismap|multiple|readonly|selected|value)"),e.querySelectorAll(":checked").length||h.push(":checked")}),at(function(e){e.innerHTML="<input type='hidden' i=''/>",e.querySelectorAll("[i^='']").length&&h.push("[*^$]="+_+"*(?:\"\"|'')"),e.querySelectorAll(":enabled").length||h.push(":enabled",":disabled"),e.querySelectorAll("*,:x"),h.push(",.*:")})),(T.matchesSelector=rt(m=f.matchesSelector||f.mozMatchesSelector||f.webkitMatchesSelector||f.oMatchesSelector||f.msMatchesSelector))&&at(function(e){T.disconnectedMatch=m.call(e,"div"),m.call(e,"[s!='']:x"),g.push("!=",R)}),h=RegExp(h.join("|")),g=RegExp(g.join("|")),y=rt(f.contains)||f.compareDocumentPosition?function(e,t){var n=9===e.nodeType?e.documentElement:e,r=t&&t.parentNode;return e===r||!(!r||1!==r.nodeType||!(n.contains?n.contains(r):e.compareDocumentPosition&&16&e.compareDocumentPosition(r)))}:function(e,t){if(t)while(t=t.parentNode)if(t===e)return!0;return!1},v=f.compareDocumentPosition?function(e,t){var r;return e===t?(u=!0,0):(r=t.compareDocumentPosition&&e.compareDocumentPosition&&e.compareDocumentPosition(t))?1&r||e.parentNode&&11===e.parentNode.nodeType?e===n||y(w,e)?-1:t===n||y(w,t)?1:0:4&r?-1:1:e.compareDocumentPosition?-1:1}:function(e,t){var r,i=0,o=e.parentNode,a=t.parentNode,s=[e],l=[t];if(e===t)return u=!0,0;if(!o||!a)return e===n?-1:t===n?1:o?-1:a?1:0;if(o===a)return ut(e,t);r=e;while(r=r.parentNode)s.unshift(r);r=t;while(r=r.parentNode)l.unshift(r);while(s[i]===l[i])i++;return i?ut(s[i],l[i]):s[i]===w?-1:l[i]===w?1:0},u=!1,[0,0].sort(v),T.detectDuplicates=u,p):p},st.matches=function(e,t){return st(e,null,null,t)},st.matchesSelector=function(e,t){if((e.ownerDocument||e)!==p&&c(e),t=t.replace(Z,"='$1']"),!(!T.matchesSelector||d||g&&g.test(t)||h.test(t)))try{var n=m.call(e,t);if(n||T.disconnectedMatch||e.document&&11!==e.document.nodeType)return n}catch(r){}return st(t,p,null,[e]).length>0},st.contains=function(e,t){return(e.ownerDocument||e)!==p&&c(e),y(e,t)},st.attr=function(e,t){var n;return(e.ownerDocument||e)!==p&&c(e),d||(t=t.toLowerCase()),(n=i.attrHandle[t])?n(e):d||T.attributes?e.getAttribute(t):((n=e.getAttributeNode(t))||e.getAttribute(t))&&e[t]===!0?t:n&&n.specified?n.value:null},st.error=function(e){throw Error("Syntax error, unrecognized expression: "+e)},st.uniqueSort=function(e){var t,n=[],r=1,i=0;if(u=!T.detectDuplicates,e.sort(v),u){for(;t=e[r];r++)t===e[r-1]&&(i=n.push(r));while(i--)e.splice(n[i],1)}return e};function ut(e,t){var n=t&&e,r=n&&(~t.sourceIndex||j)-(~e.sourceIndex||j);if(r)return r;if(n)while(n=n.nextSibling)if(n===t)return-1;return e?1:-1}function lt(e){return function(t){var n=t.nodeName.toLowerCase();return"input"===n&&t.type===e}}function ct(e){return function(t){var n=t.nodeName.toLowerCase();return("input"===n||"button"===n)&&t.type===e}}function pt(e){return ot(function(t){return t=+t,ot(function(n,r){var i,o=e([],n.length,t),a=o.length;while(a--)n[i=o[a]]&&(n[i]=!(r[i]=n[i]))})})}o=st.getText=function(e){var t,n="",r=0,i=e.nodeType;if(i){if(1===i||9===i||11===i){if("string"==typeof e.textContent)return e.textContent;for(e=e.firstChild;e;e=e.nextSibling)n+=o(e)}else if(3===i||4===i)return e.nodeValue}else for(;t=e[r];r++)n+=o(t);return n},i=st.selectors={cacheLength:50,createPseudo:ot,match:U,find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(e){return e[1]=e[1].replace(et,tt),e[3]=(e[4]||e[5]||"").replace(et,tt),"~="===e[2]&&(e[3]=" "+e[3]+" "),e.slice(0,4)},CHILD:function(e){return e[1]=e[1].toLowerCase(),"nth"===e[1].slice(0,3)?(e[3]||st.error(e[0]),e[4]=+(e[4]?e[5]+(e[6]||1):2*("even"===e[3]||"odd"===e[3])),e[5]=+(e[7]+e[8]||"odd"===e[3])):e[3]&&st.error(e[0]),e},PSEUDO:function(e){var t,n=!e[5]&&e[2];return U.CHILD.test(e[0])?null:(e[4]?e[2]=e[4]:n&&z.test(n)&&(t=ft(n,!0))&&(t=n.indexOf(")",n.length-t)-n.length)&&(e[0]=e[0].slice(0,t),e[2]=n.slice(0,t)),e.slice(0,3))}},filter:{TAG:function(e){return"*"===e?function(){return!0}:(e=e.replace(et,tt).toLowerCase(),function(t){return t.nodeName&&t.nodeName.toLowerCase()===e})},CLASS:function(e){var t=k[e+" "];return t||(t=RegExp("(^|"+_+")"+e+"("+_+"|$)"))&&k(e,function(e){return t.test(e.className||typeof e.getAttribute!==A&&e.getAttribute("class")||"")})},ATTR:function(e,t,n){return function(r){var i=st.attr(r,e);return null==i?"!="===t:t?(i+="","="===t?i===n:"!="===t?i!==n:"^="===t?n&&0===i.indexOf(n):"*="===t?n&&i.indexOf(n)>-1:"$="===t?n&&i.slice(-n.length)===n:"~="===t?(" "+i+" ").indexOf(n)>-1:"|="===t?i===n||i.slice(0,n.length+1)===n+"-":!1):!0}},CHILD:function(e,t,n,r,i){var o="nth"!==e.slice(0,3),a="last"!==e.slice(-4),s="of-type"===t;return 1===r&&0===i?function(e){return!!e.parentNode}:function(t,n,u){var l,c,p,f,d,h,g=o!==a?"nextSibling":"previousSibling",m=t.parentNode,y=s&&t.nodeName.toLowerCase(),v=!u&&!s;if(m){if(o){while(g){p=t;while(p=p[g])if(s?p.nodeName.toLowerCase()===y:1===p.nodeType)return!1;h=g="only"===e&&!h&&"nextSibling"}return!0}if(h=[a?m.firstChild:m.lastChild],a&&v){c=m[x]||(m[x]={}),l=c[e]||[],d=l[0]===N&&l[1],f=l[0]===N&&l[2],p=d&&m.childNodes[d];while(p=++d&&p&&p[g]||(f=d=0)||h.pop())if(1===p.nodeType&&++f&&p===t){c[e]=[N,d,f];break}}else if(v&&(l=(t[x]||(t[x]={}))[e])&&l[0]===N)f=l[1];else while(p=++d&&p&&p[g]||(f=d=0)||h.pop())if((s?p.nodeName.toLowerCase()===y:1===p.nodeType)&&++f&&(v&&((p[x]||(p[x]={}))[e]=[N,f]),p===t))break;return f-=i,f===r||0===f%r&&f/r>=0}}},PSEUDO:function(e,t){var n,r=i.pseudos[e]||i.setFilters[e.toLowerCase()]||st.error("unsupported pseudo: "+e);return r[x]?r(t):r.length>1?(n=[e,e,"",t],i.setFilters.hasOwnProperty(e.toLowerCase())?ot(function(e,n){var i,o=r(e,t),a=o.length;while(a--)i=M.call(e,o[a]),e[i]=!(n[i]=o[a])}):function(e){return r(e,0,n)}):r}},pseudos:{not:ot(function(e){var t=[],n=[],r=s(e.replace(W,"$1"));return r[x]?ot(function(e,t,n,i){var o,a=r(e,null,i,[]),s=e.length;while(s--)(o=a[s])&&(e[s]=!(t[s]=o))}):function(e,i,o){return t[0]=e,r(t,null,o,n),!n.pop()}}),has:ot(function(e){return function(t){return st(e,t).length>0}}),contains:ot(function(e){return function(t){return(t.textContent||t.innerText||o(t)).indexOf(e)>-1}}),lang:ot(function(e){return X.test(e||"")||st.error("unsupported lang: "+e),e=e.replace(et,tt).toLowerCase(),function(t){var n;do if(n=d?t.getAttribute("xml:lang")||t.getAttribute("lang"):t.lang)return n=n.toLowerCase(),n===e||0===n.indexOf(e+"-");while((t=t.parentNode)&&1===t.nodeType);return!1}}),target:function(t){var n=e.location&&e.location.hash;return n&&n.slice(1)===t.id},root:function(e){return e===f},focus:function(e){return e===p.activeElement&&(!p.hasFocus||p.hasFocus())&&!!(e.type||e.href||~e.tabIndex)},enabled:function(e){return e.disabled===!1},disabled:function(e){return e.disabled===!0},checked:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&!!e.checked||"option"===t&&!!e.selected},selected:function(e){return e.parentNode&&e.parentNode.selectedIndex,e.selected===!0},empty:function(e){for(e=e.firstChild;e;e=e.nextSibling)if(e.nodeName>"@"||3===e.nodeType||4===e.nodeType)return!1;return!0},parent:function(e){return!i.pseudos.empty(e)},header:function(e){return Q.test(e.nodeName)},input:function(e){return G.test(e.nodeName)},button:function(e){var t=e.nodeName.toLowerCase();return"input"===t&&"button"===e.type||"button"===t},text:function(e){var t;return"input"===e.nodeName.toLowerCase()&&"text"===e.type&&(null==(t=e.getAttribute("type"))||t.toLowerCase()===e.type)},first:pt(function(){return[0]}),last:pt(function(e,t){return[t-1]}),eq:pt(function(e,t,n){return[0>n?n+t:n]}),even:pt(function(e,t){var n=0;for(;t>n;n+=2)e.push(n);return e}),odd:pt(function(e,t){var n=1;for(;t>n;n+=2)e.push(n);return e}),lt:pt(function(e,t,n){var r=0>n?n+t:n;for(;--r>=0;)e.push(r);return e}),gt:pt(function(e,t,n){var r=0>n?n+t:n;for(;t>++r;)e.push(r);return e})}};for(n in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})i.pseudos[n]=lt(n);for(n in{submit:!0,reset:!0})i.pseudos[n]=ct(n);function ft(e,t){var n,r,o,a,s,u,l,c=E[e+" "];if(c)return t?0:c.slice(0);s=e,u=[],l=i.preFilter;while(s){(!n||(r=$.exec(s)))&&(r&&(s=s.slice(r[0].length)||s),u.push(o=[])),n=!1,(r=I.exec(s))&&(n=r.shift(),o.push({value:n,type:r[0].replace(W," ")}),s=s.slice(n.length));for(a in i.filter)!(r=U[a].exec(s))||l[a]&&!(r=l[a](r))||(n=r.shift(),o.push({value:n,type:a,matches:r}),s=s.slice(n.length));if(!n)break}return t?s.length:s?st.error(e):E(e,u).slice(0)}function dt(e){var t=0,n=e.length,r="";for(;n>t;t++)r+=e[t].value;return r}function ht(e,t,n){var i=t.dir,o=n&&"parentNode"===i,a=C++;return t.first?function(t,n,r){while(t=t[i])if(1===t.nodeType||o)return e(t,n,r)}:function(t,n,s){var u,l,c,p=N+" "+a;if(s){while(t=t[i])if((1===t.nodeType||o)&&e(t,n,s))return!0}else while(t=t[i])if(1===t.nodeType||o)if(c=t[x]||(t[x]={}),(l=c[i])&&l[0]===p){if((u=l[1])===!0||u===r)return u===!0}else if(l=c[i]=[p],l[1]=e(t,n,s)||r,l[1]===!0)return!0}}function gt(e){return e.length>1?function(t,n,r){var i=e.length;while(i--)if(!e[i](t,n,r))return!1;return!0}:e[0]}function mt(e,t,n,r,i){var o,a=[],s=0,u=e.length,l=null!=t;for(;u>s;s++)(o=e[s])&&(!n||n(o,r,i))&&(a.push(o),l&&t.push(s));return a}function yt(e,t,n,r,i,o){return r&&!r[x]&&(r=yt(r)),i&&!i[x]&&(i=yt(i,o)),ot(function(o,a,s,u){var l,c,p,f=[],d=[],h=a.length,g=o||xt(t||"*",s.nodeType?[s]:s,[]),m=!e||!o&&t?g:mt(g,f,e,s,u),y=n?i||(o?e:h||r)?[]:a:m;if(n&&n(m,y,s,u),r){l=mt(y,d),r(l,[],s,u),c=l.length;while(c--)(p=l[c])&&(y[d[c]]=!(m[d[c]]=p))}if(o){if(i||e){if(i){l=[],c=y.length;while(c--)(p=y[c])&&l.push(m[c]=p);i(null,y=[],l,u)}c=y.length;while(c--)(p=y[c])&&(l=i?M.call(o,p):f[c])>-1&&(o[l]=!(a[l]=p))}}else y=mt(y===a?y.splice(h,y.length):y),i?i(null,a,y,u):H.apply(a,y)})}function vt(e){var t,n,r,o=e.length,a=i.relative[e[0].type],s=a||i.relative[" "],u=a?1:0,c=ht(function(e){return e===t},s,!0),p=ht(function(e){return M.call(t,e)>-1},s,!0),f=[function(e,n,r){return!a&&(r||n!==l)||((t=n).nodeType?c(e,n,r):p(e,n,r))}];for(;o>u;u++)if(n=i.relative[e[u].type])f=[ht(gt(f),n)];else{if(n=i.filter[e[u].type].apply(null,e[u].matches),n[x]){for(r=++u;o>r;r++)if(i.relative[e[r].type])break;return yt(u>1&&gt(f),u>1&&dt(e.slice(0,u-1)).replace(W,"$1"),n,r>u&&vt(e.slice(u,r)),o>r&&vt(e=e.slice(r)),o>r&&dt(e))}f.push(n)}return gt(f)}function bt(e,t){var n=0,o=t.length>0,a=e.length>0,s=function(s,u,c,f,d){var h,g,m,y=[],v=0,b="0",x=s&&[],w=null!=d,T=l,C=s||a&&i.find.TAG("*",d&&u.parentNode||u),k=N+=null==T?1:Math.random()||.1;for(w&&(l=u!==p&&u,r=n);null!=(h=C[b]);b++){if(a&&h){g=0;while(m=e[g++])if(m(h,u,c)){f.push(h);break}w&&(N=k,r=++n)}o&&((h=!m&&h)&&v--,s&&x.push(h))}if(v+=b,o&&b!==v){g=0;while(m=t[g++])m(x,y,u,c);if(s){if(v>0)while(b--)x[b]||y[b]||(y[b]=L.call(f));y=mt(y)}H.apply(f,y),w&&!s&&y.length>0&&v+t.length>1&&st.uniqueSort(f)}return w&&(N=k,l=T),x};return o?ot(s):s}s=st.compile=function(e,t){var n,r=[],i=[],o=S[e+" "];if(!o){t||(t=ft(e)),n=t.length;while(n--)o=vt(t[n]),o[x]?r.push(o):i.push(o);o=S(e,bt(i,r))}return o};function xt(e,t,n){var r=0,i=t.length;for(;i>r;r++)st(e,t[r],n);return n}function wt(e,t,n,r){var o,a,u,l,c,p=ft(e);if(!r&&1===p.length){if(a=p[0]=p[0].slice(0),a.length>2&&"ID"===(u=a[0]).type&&9===t.nodeType&&!d&&i.relative[a[1].type]){if(t=i.find.ID(u.matches[0].replace(et,tt),t)[0],!t)return n;e=e.slice(a.shift().value.length)}o=U.needsContext.test(e)?0:a.length;while(o--){if(u=a[o],i.relative[l=u.type])break;if((c=i.find[l])&&(r=c(u.matches[0].replace(et,tt),V.test(a[0].type)&&t.parentNode||t))){if(a.splice(o,1),e=r.length&&dt(a),!e)return H.apply(n,q.call(r,0)),n;break}}}return s(e,p)(r,t,d,n,V.test(e)),n}i.pseudos.nth=i.pseudos.eq;function Tt(){}i.filters=Tt.prototype=i.pseudos,i.setFilters=new Tt,c(),st.attr=b.attr,b.find=st,b.expr=st.selectors,b.expr[":"]=b.expr.pseudos,b.unique=st.uniqueSort,b.text=st.getText,b.isXMLDoc=st.isXML,b.contains=st.contains}(e);var at=/Until$/,st=/^(?:parents|prev(?:Until|All))/,ut=/^.[^:#\[\.,]*$/,lt=b.expr.match.needsContext,ct={children:!0,contents:!0,next:!0,prev:!0};b.fn.extend({find:function(e){var t,n,r,i=this.length;if("string"!=typeof e)return r=this,this.pushStack(b(e).filter(function(){for(t=0;i>t;t++)if(b.contains(r[t],this))return!0}));for(n=[],t=0;i>t;t++)b.find(e,this[t],n);return n=this.pushStack(i>1?b.unique(n):n),n.selector=(this.selector?this.selector+" ":"")+e,n},has:function(e){var t,n=b(e,this),r=n.length;return this.filter(function(){for(t=0;r>t;t++)if(b.contains(this,n[t]))return!0})},not:function(e){return this.pushStack(ft(this,e,!1))},filter:function(e){return this.pushStack(ft(this,e,!0))},is:function(e){return!!e&&("string"==typeof e?lt.test(e)?b(e,this.context).index(this[0])>=0:b.filter(e,this).length>0:this.filter(e).length>0)},closest:function(e,t){var n,r=0,i=this.length,o=[],a=lt.test(e)||"string"!=typeof e?b(e,t||this.context):0;for(;i>r;r++){n=this[r];while(n&&n.ownerDocument&&n!==t&&11!==n.nodeType){if(a?a.index(n)>-1:b.find.matchesSelector(n,e)){o.push(n);break}n=n.parentNode}}return this.pushStack(o.length>1?b.unique(o):o)},index:function(e){return e?"string"==typeof e?b.inArray(this[0],b(e)):b.inArray(e.jquery?e[0]:e,this):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(e,t){var n="string"==typeof e?b(e,t):b.makeArray(e&&e.nodeType?[e]:e),r=b.merge(this.get(),n);return this.pushStack(b.unique(r))},addBack:function(e){return this.add(null==e?this.prevObject:this.prevObject.filter(e))}}),b.fn.andSelf=b.fn.addBack;function pt(e,t){do e=e[t];while(e&&1!==e.nodeType);return e}b.each({parent:function(e){var t=e.parentNode;return t&&11!==t.nodeType?t:null},parents:function(e){return b.dir(e,"parentNode")},parentsUntil:function(e,t,n){return b.dir(e,"parentNode",n)},next:function(e){return pt(e,"nextSibling")},prev:function(e){return pt(e,"previousSibling")},nextAll:function(e){return b.dir(e,"nextSibling")},prevAll:function(e){return b.dir(e,"previousSibling")},nextUntil:function(e,t,n){return b.dir(e,"nextSibling",n)},prevUntil:function(e,t,n){return b.dir(e,"previousSibling",n)},siblings:function(e){return b.sibling((e.parentNode||{}).firstChild,e)},children:function(e){return b.sibling(e.firstChild)},contents:function(e){return b.nodeName(e,"iframe")?e.contentDocument||e.contentWindow.document:b.merge([],e.childNodes)}},function(e,t){b.fn[e]=function(n,r){var i=b.map(this,t,n);return at.test(e)||(r=n),r&&"string"==typeof r&&(i=b.filter(r,i)),i=this.length>1&&!ct[e]?b.unique(i):i,this.length>1&&st.test(e)&&(i=i.reverse()),this.pushStack(i)}}),b.extend({filter:function(e,t,n){return n&&(e=":not("+e+")"),1===t.length?b.find.matchesSelector(t[0],e)?[t[0]]:[]:b.find.matches(e,t)},dir:function(e,n,r){var i=[],o=e[n];while(o&&9!==o.nodeType&&(r===t||1!==o.nodeType||!b(o).is(r)))1===o.nodeType&&i.push(o),o=o[n];return i},sibling:function(e,t){var n=[];for(;e;e=e.nextSibling)1===e.nodeType&&e!==t&&n.push(e);return n}});function ft(e,t,n){if(t=t||0,b.isFunction(t))return b.grep(e,function(e,r){var i=!!t.call(e,r,e);return i===n});if(t.nodeType)return b.grep(e,function(e){return e===t===n});if("string"==typeof t){var r=b.grep(e,function(e){return 1===e.nodeType});if(ut.test(t))return b.filter(t,r,!n);t=b.filter(t,r)}return b.grep(e,function(e){return b.inArray(e,t)>=0===n})}function dt(e){var t=ht.split("|"),n=e.createDocumentFragment();if(n.createElement)while(t.length)n.createElement(t.pop());return n}var ht="abbr|article|aside|audio|bdi|canvas|data|datalist|details|figcaption|figure|footer|header|hgroup|mark|meter|nav|output|progress|section|summary|time|video",gt=/ jQuery\d+="(?:null|\d+)"/g,mt=RegExp("<(?:"+ht+")[\\s/>]","i"),yt=/^\s+/,vt=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,bt=/<([\w:]+)/,xt=/<tbody/i,wt=/<|&#?\w+;/,Tt=/<(?:script|style|link)/i,Nt=/^(?:checkbox|radio)$/i,Ct=/checked\s*(?:[^=]|=\s*.checked.)/i,kt=/^$|\/(?:java|ecma)script/i,Et=/^true\/(.*)/,St=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,At={option:[1,"<select multiple='multiple'>","</select>"],legend:[1,"<fieldset>","</fieldset>"],area:[1,"<map>","</map>"],param:[1,"<object>","</object>"],thead:[1,"<table>","</table>"],tr:[2,"<table><tbody>","</tbody></table>"],col:[2,"<table><tbody></tbody><colgroup>","</colgroup></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:b.support.htmlSerialize?[0,"",""]:[1,"X<div>","</div>"]},jt=dt(o),Dt=jt.appendChild(o.createElement("div"));At.optgroup=At.option,At.tbody=At.tfoot=At.colgroup=At.caption=At.thead,At.th=At.td,b.fn.extend({text:function(e){return b.access(this,function(e){return e===t?b.text(this):this.empty().append((this[0]&&this[0].ownerDocument||o).createTextNode(e))},null,e,arguments.length)},wrapAll:function(e){if(b.isFunction(e))return this.each(function(t){b(this).wrapAll(e.call(this,t))});if(this[0]){var t=b(e,this[0].ownerDocument).eq(0).clone(!0);this[0].parentNode&&t.insertBefore(this[0]),t.map(function(){var e=this;while(e.firstChild&&1===e.firstChild.nodeType)e=e.firstChild;return e}).append(this)}return this},wrapInner:function(e){return b.isFunction(e)?this.each(function(t){b(this).wrapInner(e.call(this,t))}):this.each(function(){var t=b(this),n=t.contents();n.length?n.wrapAll(e):t.append(e)})},wrap:function(e){var t=b.isFunction(e);return this.each(function(n){b(this).wrapAll(t?e.call(this,n):e)})},unwrap:function(){return this.parent().each(function(){b.nodeName(this,"body")||b(this).replaceWith(this.childNodes)}).end()},append:function(){return this.domManip(arguments,!0,function(e){(1===this.nodeType||11===this.nodeType||9===this.nodeType)&&this.appendChild(e)})},prepend:function(){return this.domManip(arguments,!0,function(e){(1===this.nodeType||11===this.nodeType||9===this.nodeType)&&this.insertBefore(e,this.firstChild)})},before:function(){return this.domManip(arguments,!1,function(e){this.parentNode&&this.parentNode.insertBefore(e,this)})},after:function(){return this.domManip(arguments,!1,function(e){this.parentNode&&this.parentNode.insertBefore(e,this.nextSibling)})},remove:function(e,t){var n,r=0;for(;null!=(n=this[r]);r++)(!e||b.filter(e,[n]).length>0)&&(t||1!==n.nodeType||b.cleanData(Ot(n)),n.parentNode&&(t&&b.contains(n.ownerDocument,n)&&Mt(Ot(n,"script")),n.parentNode.removeChild(n)));return this},empty:function(){var e,t=0;for(;null!=(e=this[t]);t++){1===e.nodeType&&b.cleanData(Ot(e,!1));while(e.firstChild)e.removeChild(e.firstChild);e.options&&b.nodeName(e,"select")&&(e.options.length=0)}return this},clone:function(e,t){return e=null==e?!1:e,t=null==t?e:t,this.map(function(){return b.clone(this,e,t)})},html:function(e){return b.access(this,function(e){var n=this[0]||{},r=0,i=this.length;if(e===t)return 1===n.nodeType?n.innerHTML.replace(gt,""):t;if(!("string"!=typeof e||Tt.test(e)||!b.support.htmlSerialize&&mt.test(e)||!b.support.leadingWhitespace&&yt.test(e)||At[(bt.exec(e)||["",""])[1].toLowerCase()])){e=e.replace(vt,"<$1></$2>");try{for(;i>r;r++)n=this[r]||{},1===n.nodeType&&(b.cleanData(Ot(n,!1)),n.innerHTML=e);n=0}catch(o){}}n&&this.empty().append(e)},null,e,arguments.length)},replaceWith:function(e){var t=b.isFunction(e);return t||"string"==typeof e||(e=b(e).not(this).detach()),this.domManip([e],!0,function(e){var t=this.nextSibling,n=this.parentNode;n&&(b(this).remove(),n.insertBefore(e,t))})},detach:function(e){return this.remove(e,!0)},domManip:function(e,n,r){e=f.apply([],e);var i,o,a,s,u,l,c=0,p=this.length,d=this,h=p-1,g=e[0],m=b.isFunction(g);if(m||!(1>=p||"string"!=typeof g||b.support.checkClone)&&Ct.test(g))return this.each(function(i){var o=d.eq(i);m&&(e[0]=g.call(this,i,n?o.html():t)),o.domManip(e,n,r)});if(p&&(l=b.buildFragment(e,this[0].ownerDocument,!1,this),i=l.firstChild,1===l.childNodes.length&&(l=i),i)){for(n=n&&b.nodeName(i,"tr"),s=b.map(Ot(l,"script"),Ht),a=s.length;p>c;c++)o=l,c!==h&&(o=b.clone(o,!0,!0),a&&b.merge(s,Ot(o,"script"))),r.call(n&&b.nodeName(this[c],"table")?Lt(this[c],"tbody"):this[c],o,c);if(a)for(u=s[s.length-1].ownerDocument,b.map(s,qt),c=0;a>c;c++)o=s[c],kt.test(o.type||"")&&!b._data(o,"globalEval")&&b.contains(u,o)&&(o.src?b.ajax({url:o.src,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0}):b.globalEval((o.text||o.textContent||o.innerHTML||"").replace(St,"")));l=i=null}return this}});function Lt(e,t){return e.getElementsByTagName(t)[0]||e.appendChild(e.ownerDocument.createElement(t))}function Ht(e){var t=e.getAttributeNode("type");return e.type=(t&&t.specified)+"/"+e.type,e}function qt(e){var t=Et.exec(e.type);return t?e.type=t[1]:e.removeAttribute("type"),e}function Mt(e,t){var n,r=0;for(;null!=(n=e[r]);r++)b._data(n,"globalEval",!t||b._data(t[r],"globalEval"))}function _t(e,t){if(1===t.nodeType&&b.hasData(e)){var n,r,i,o=b._data(e),a=b._data(t,o),s=o.events;if(s){delete a.handle,a.events={};for(n in s)for(r=0,i=s[n].length;i>r;r++)b.event.add(t,n,s[n][r])}a.data&&(a.data=b.extend({},a.data))}}function Ft(e,t){var n,r,i;if(1===t.nodeType){if(n=t.nodeName.toLowerCase(),!b.support.noCloneEvent&&t[b.expando]){i=b._data(t);for(r in i.events)b.removeEvent(t,r,i.handle);t.removeAttribute(b.expando)}"script"===n&&t.text!==e.text?(Ht(t).text=e.text,qt(t)):"object"===n?(t.parentNode&&(t.outerHTML=e.outerHTML),b.support.html5Clone&&e.innerHTML&&!b.trim(t.innerHTML)&&(t.innerHTML=e.innerHTML)):"input"===n&&Nt.test(e.type)?(t.defaultChecked=t.checked=e.checked,t.value!==e.value&&(t.value=e.value)):"option"===n?t.defaultSelected=t.selected=e.defaultSelected:("input"===n||"textarea"===n)&&(t.defaultValue=e.defaultValue)}}b.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(e,t){b.fn[e]=function(e){var n,r=0,i=[],o=b(e),a=o.length-1;for(;a>=r;r++)n=r===a?this:this.clone(!0),b(o[r])[t](n),d.apply(i,n.get());return this.pushStack(i)}});function Ot(e,n){var r,o,a=0,s=typeof e.getElementsByTagName!==i?e.getElementsByTagName(n||"*"):typeof e.querySelectorAll!==i?e.querySelectorAll(n||"*"):t;if(!s)for(s=[],r=e.childNodes||e;null!=(o=r[a]);a++)!n||b.nodeName(o,n)?s.push(o):b.merge(s,Ot(o,n));return n===t||n&&b.nodeName(e,n)?b.merge([e],s):s}function Bt(e){Nt.test(e.type)&&(e.defaultChecked=e.checked)}b.extend({clone:function(e,t,n){var r,i,o,a,s,u=b.contains(e.ownerDocument,e);if(b.support.html5Clone||b.isXMLDoc(e)||!mt.test("<"+e.nodeName+">")?o=e.cloneNode(!0):(Dt.innerHTML=e.outerHTML,Dt.removeChild(o=Dt.firstChild)),!(b.support.noCloneEvent&&b.support.noCloneChecked||1!==e.nodeType&&11!==e.nodeType||b.isXMLDoc(e)))for(r=Ot(o),s=Ot(e),a=0;null!=(i=s[a]);++a)r[a]&&Ft(i,r[a]);if(t)if(n)for(s=s||Ot(e),r=r||Ot(o),a=0;null!=(i=s[a]);a++)_t(i,r[a]);else _t(e,o);return r=Ot(o,"script"),r.length>0&&Mt(r,!u&&Ot(e,"script")),r=s=i=null,o},buildFragment:function(e,t,n,r){var i,o,a,s,u,l,c,p=e.length,f=dt(t),d=[],h=0;for(;p>h;h++)if(o=e[h],o||0===o)if("object"===b.type(o))b.merge(d,o.nodeType?[o]:o);else if(wt.test(o)){s=s||f.appendChild(t.createElement("div")),u=(bt.exec(o)||["",""])[1].toLowerCase(),c=At[u]||At._default,s.innerHTML=c[1]+o.replace(vt,"<$1></$2>")+c[2],i=c[0];while(i--)s=s.lastChild;if(!b.support.leadingWhitespace&&yt.test(o)&&d.push(t.createTextNode(yt.exec(o)[0])),!b.support.tbody){o="table"!==u||xt.test(o)?"<table>"!==c[1]||xt.test(o)?0:s:s.firstChild,i=o&&o.childNodes.length;while(i--)b.nodeName(l=o.childNodes[i],"tbody")&&!l.childNodes.length&&o.removeChild(l)
}b.merge(d,s.childNodes),s.textContent="";while(s.firstChild)s.removeChild(s.firstChild);s=f.lastChild}else d.push(t.createTextNode(o));s&&f.removeChild(s),b.support.appendChecked||b.grep(Ot(d,"input"),Bt),h=0;while(o=d[h++])if((!r||-1===b.inArray(o,r))&&(a=b.contains(o.ownerDocument,o),s=Ot(f.appendChild(o),"script"),a&&Mt(s),n)){i=0;while(o=s[i++])kt.test(o.type||"")&&n.push(o)}return s=null,f},cleanData:function(e,t){var n,r,o,a,s=0,u=b.expando,l=b.cache,p=b.support.deleteExpando,f=b.event.special;for(;null!=(n=e[s]);s++)if((t||b.acceptData(n))&&(o=n[u],a=o&&l[o])){if(a.events)for(r in a.events)f[r]?b.event.remove(n,r):b.removeEvent(n,r,a.handle);l[o]&&(delete l[o],p?delete n[u]:typeof n.removeAttribute!==i?n.removeAttribute(u):n[u]=null,c.push(o))}}});var Pt,Rt,Wt,$t=/alpha\([^)]*\)/i,It=/opacity\s*=\s*([^)]*)/,zt=/^(top|right|bottom|left)$/,Xt=/^(none|table(?!-c[ea]).+)/,Ut=/^margin/,Vt=RegExp("^("+x+")(.*)$","i"),Yt=RegExp("^("+x+")(?!px)[a-z%]+$","i"),Jt=RegExp("^([+-])=("+x+")","i"),Gt={BODY:"block"},Qt={position:"absolute",visibility:"hidden",display:"block"},Kt={letterSpacing:0,fontWeight:400},Zt=["Top","Right","Bottom","Left"],en=["Webkit","O","Moz","ms"];function tn(e,t){if(t in e)return t;var n=t.charAt(0).toUpperCase()+t.slice(1),r=t,i=en.length;while(i--)if(t=en[i]+n,t in e)return t;return r}function nn(e,t){return e=t||e,"none"===b.css(e,"display")||!b.contains(e.ownerDocument,e)}function rn(e,t){var n,r,i,o=[],a=0,s=e.length;for(;s>a;a++)r=e[a],r.style&&(o[a]=b._data(r,"olddisplay"),n=r.style.display,t?(o[a]||"none"!==n||(r.style.display=""),""===r.style.display&&nn(r)&&(o[a]=b._data(r,"olddisplay",un(r.nodeName)))):o[a]||(i=nn(r),(n&&"none"!==n||!i)&&b._data(r,"olddisplay",i?n:b.css(r,"display"))));for(a=0;s>a;a++)r=e[a],r.style&&(t&&"none"!==r.style.display&&""!==r.style.display||(r.style.display=t?o[a]||"":"none"));return e}b.fn.extend({css:function(e,n){return b.access(this,function(e,n,r){var i,o,a={},s=0;if(b.isArray(n)){for(o=Rt(e),i=n.length;i>s;s++)a[n[s]]=b.css(e,n[s],!1,o);return a}return r!==t?b.style(e,n,r):b.css(e,n)},e,n,arguments.length>1)},show:function(){return rn(this,!0)},hide:function(){return rn(this)},toggle:function(e){var t="boolean"==typeof e;return this.each(function(){(t?e:nn(this))?b(this).show():b(this).hide()})}}),b.extend({cssHooks:{opacity:{get:function(e,t){if(t){var n=Wt(e,"opacity");return""===n?"1":n}}}},cssNumber:{columnCount:!0,fillOpacity:!0,fontWeight:!0,lineHeight:!0,opacity:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":b.support.cssFloat?"cssFloat":"styleFloat"},style:function(e,n,r,i){if(e&&3!==e.nodeType&&8!==e.nodeType&&e.style){var o,a,s,u=b.camelCase(n),l=e.style;if(n=b.cssProps[u]||(b.cssProps[u]=tn(l,u)),s=b.cssHooks[n]||b.cssHooks[u],r===t)return s&&"get"in s&&(o=s.get(e,!1,i))!==t?o:l[n];if(a=typeof r,"string"===a&&(o=Jt.exec(r))&&(r=(o[1]+1)*o[2]+parseFloat(b.css(e,n)),a="number"),!(null==r||"number"===a&&isNaN(r)||("number"!==a||b.cssNumber[u]||(r+="px"),b.support.clearCloneStyle||""!==r||0!==n.indexOf("background")||(l[n]="inherit"),s&&"set"in s&&(r=s.set(e,r,i))===t)))try{l[n]=r}catch(c){}}},css:function(e,n,r,i){var o,a,s,u=b.camelCase(n);return n=b.cssProps[u]||(b.cssProps[u]=tn(e.style,u)),s=b.cssHooks[n]||b.cssHooks[u],s&&"get"in s&&(a=s.get(e,!0,r)),a===t&&(a=Wt(e,n,i)),"normal"===a&&n in Kt&&(a=Kt[n]),""===r||r?(o=parseFloat(a),r===!0||b.isNumeric(o)?o||0:a):a},swap:function(e,t,n,r){var i,o,a={};for(o in t)a[o]=e.style[o],e.style[o]=t[o];i=n.apply(e,r||[]);for(o in t)e.style[o]=a[o];return i}}),e.getComputedStyle?(Rt=function(t){return e.getComputedStyle(t,null)},Wt=function(e,n,r){var i,o,a,s=r||Rt(e),u=s?s.getPropertyValue(n)||s[n]:t,l=e.style;return s&&(""!==u||b.contains(e.ownerDocument,e)||(u=b.style(e,n)),Yt.test(u)&&Ut.test(n)&&(i=l.width,o=l.minWidth,a=l.maxWidth,l.minWidth=l.maxWidth=l.width=u,u=s.width,l.width=i,l.minWidth=o,l.maxWidth=a)),u}):o.documentElement.currentStyle&&(Rt=function(e){return e.currentStyle},Wt=function(e,n,r){var i,o,a,s=r||Rt(e),u=s?s[n]:t,l=e.style;return null==u&&l&&l[n]&&(u=l[n]),Yt.test(u)&&!zt.test(n)&&(i=l.left,o=e.runtimeStyle,a=o&&o.left,a&&(o.left=e.currentStyle.left),l.left="fontSize"===n?"1em":u,u=l.pixelLeft+"px",l.left=i,a&&(o.left=a)),""===u?"auto":u});function on(e,t,n){var r=Vt.exec(t);return r?Math.max(0,r[1]-(n||0))+(r[2]||"px"):t}function an(e,t,n,r,i){var o=n===(r?"border":"content")?4:"width"===t?1:0,a=0;for(;4>o;o+=2)"margin"===n&&(a+=b.css(e,n+Zt[o],!0,i)),r?("content"===n&&(a-=b.css(e,"padding"+Zt[o],!0,i)),"margin"!==n&&(a-=b.css(e,"border"+Zt[o]+"Width",!0,i))):(a+=b.css(e,"padding"+Zt[o],!0,i),"padding"!==n&&(a+=b.css(e,"border"+Zt[o]+"Width",!0,i)));return a}function sn(e,t,n){var r=!0,i="width"===t?e.offsetWidth:e.offsetHeight,o=Rt(e),a=b.support.boxSizing&&"border-box"===b.css(e,"boxSizing",!1,o);if(0>=i||null==i){if(i=Wt(e,t,o),(0>i||null==i)&&(i=e.style[t]),Yt.test(i))return i;r=a&&(b.support.boxSizingReliable||i===e.style[t]),i=parseFloat(i)||0}return i+an(e,t,n||(a?"border":"content"),r,o)+"px"}function un(e){var t=o,n=Gt[e];return n||(n=ln(e,t),"none"!==n&&n||(Pt=(Pt||b("<iframe frameborder='0' width='0' height='0'/>").css("cssText","display:block !important")).appendTo(t.documentElement),t=(Pt[0].contentWindow||Pt[0].contentDocument).document,t.write("<!doctype html><html><body>"),t.close(),n=ln(e,t),Pt.detach()),Gt[e]=n),n}function ln(e,t){var n=b(t.createElement(e)).appendTo(t.body),r=b.css(n[0],"display");return n.remove(),r}b.each(["height","width"],function(e,n){b.cssHooks[n]={get:function(e,r,i){return r?0===e.offsetWidth&&Xt.test(b.css(e,"display"))?b.swap(e,Qt,function(){return sn(e,n,i)}):sn(e,n,i):t},set:function(e,t,r){var i=r&&Rt(e);return on(e,t,r?an(e,n,r,b.support.boxSizing&&"border-box"===b.css(e,"boxSizing",!1,i),i):0)}}}),b.support.opacity||(b.cssHooks.opacity={get:function(e,t){return It.test((t&&e.currentStyle?e.currentStyle.filter:e.style.filter)||"")?.01*parseFloat(RegExp.$1)+"":t?"1":""},set:function(e,t){var n=e.style,r=e.currentStyle,i=b.isNumeric(t)?"alpha(opacity="+100*t+")":"",o=r&&r.filter||n.filter||"";n.zoom=1,(t>=1||""===t)&&""===b.trim(o.replace($t,""))&&n.removeAttribute&&(n.removeAttribute("filter"),""===t||r&&!r.filter)||(n.filter=$t.test(o)?o.replace($t,i):o+" "+i)}}),b(function(){b.support.reliableMarginRight||(b.cssHooks.marginRight={get:function(e,n){return n?b.swap(e,{display:"inline-block"},Wt,[e,"marginRight"]):t}}),!b.support.pixelPosition&&b.fn.position&&b.each(["top","left"],function(e,n){b.cssHooks[n]={get:function(e,r){return r?(r=Wt(e,n),Yt.test(r)?b(e).position()[n]+"px":r):t}}})}),b.expr&&b.expr.filters&&(b.expr.filters.hidden=function(e){return 0>=e.offsetWidth&&0>=e.offsetHeight||!b.support.reliableHiddenOffsets&&"none"===(e.style&&e.style.display||b.css(e,"display"))},b.expr.filters.visible=function(e){return!b.expr.filters.hidden(e)}),b.each({margin:"",padding:"",border:"Width"},function(e,t){b.cssHooks[e+t]={expand:function(n){var r=0,i={},o="string"==typeof n?n.split(" "):[n];for(;4>r;r++)i[e+Zt[r]+t]=o[r]||o[r-2]||o[0];return i}},Ut.test(e)||(b.cssHooks[e+t].set=on)});var cn=/%20/g,pn=/\[\]$/,fn=/\r?\n/g,dn=/^(?:submit|button|image|reset|file)$/i,hn=/^(?:input|select|textarea|keygen)/i;b.fn.extend({serialize:function(){return b.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var e=b.prop(this,"elements");return e?b.makeArray(e):this}).filter(function(){var e=this.type;return this.name&&!b(this).is(":disabled")&&hn.test(this.nodeName)&&!dn.test(e)&&(this.checked||!Nt.test(e))}).map(function(e,t){var n=b(this).val();return null==n?null:b.isArray(n)?b.map(n,function(e){return{name:t.name,value:e.replace(fn,"\r\n")}}):{name:t.name,value:n.replace(fn,"\r\n")}}).get()}}),b.param=function(e,n){var r,i=[],o=function(e,t){t=b.isFunction(t)?t():null==t?"":t,i[i.length]=encodeURIComponent(e)+"="+encodeURIComponent(t)};if(n===t&&(n=b.ajaxSettings&&b.ajaxSettings.traditional),b.isArray(e)||e.jquery&&!b.isPlainObject(e))b.each(e,function(){o(this.name,this.value)});else for(r in e)gn(r,e[r],n,o);return i.join("&").replace(cn,"+")};function gn(e,t,n,r){var i;if(b.isArray(t))b.each(t,function(t,i){n||pn.test(e)?r(e,i):gn(e+"["+("object"==typeof i?t:"")+"]",i,n,r)});else if(n||"object"!==b.type(t))r(e,t);else for(i in t)gn(e+"["+i+"]",t[i],n,r)}b.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(e,t){b.fn[t]=function(e,n){return arguments.length>0?this.on(t,null,e,n):this.trigger(t)}}),b.fn.hover=function(e,t){return this.mouseenter(e).mouseleave(t||e)};var mn,yn,vn=b.now(),bn=/\?/,xn=/#.*$/,wn=/([?&])_=[^&]*/,Tn=/^(.*?):[ \t]*([^\r\n]*)\r?$/gm,Nn=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,Cn=/^(?:GET|HEAD)$/,kn=/^\/\//,En=/^([\w.+-]+:)(?:\/\/([^\/?#:]*)(?::(\d+)|)|)/,Sn=b.fn.load,An={},jn={},Dn="*/".concat("*");try{yn=a.href}catch(Ln){yn=o.createElement("a"),yn.href="",yn=yn.href}mn=En.exec(yn.toLowerCase())||[];function Hn(e){return function(t,n){"string"!=typeof t&&(n=t,t="*");var r,i=0,o=t.toLowerCase().match(w)||[];if(b.isFunction(n))while(r=o[i++])"+"===r[0]?(r=r.slice(1)||"*",(e[r]=e[r]||[]).unshift(n)):(e[r]=e[r]||[]).push(n)}}function qn(e,n,r,i){var o={},a=e===jn;function s(u){var l;return o[u]=!0,b.each(e[u]||[],function(e,u){var c=u(n,r,i);return"string"!=typeof c||a||o[c]?a?!(l=c):t:(n.dataTypes.unshift(c),s(c),!1)}),l}return s(n.dataTypes[0])||!o["*"]&&s("*")}function Mn(e,n){var r,i,o=b.ajaxSettings.flatOptions||{};for(i in n)n[i]!==t&&((o[i]?e:r||(r={}))[i]=n[i]);return r&&b.extend(!0,e,r),e}b.fn.load=function(e,n,r){if("string"!=typeof e&&Sn)return Sn.apply(this,arguments);var i,o,a,s=this,u=e.indexOf(" ");return u>=0&&(i=e.slice(u,e.length),e=e.slice(0,u)),b.isFunction(n)?(r=n,n=t):n&&"object"==typeof n&&(a="POST"),s.length>0&&b.ajax({url:e,type:a,dataType:"html",data:n}).done(function(e){o=arguments,s.html(i?b("<div>").append(b.parseHTML(e)).find(i):e)}).complete(r&&function(e,t){s.each(r,o||[e.responseText,t,e])}),this},b.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(e,t){b.fn[t]=function(e){return this.on(t,e)}}),b.each(["get","post"],function(e,n){b[n]=function(e,r,i,o){return b.isFunction(r)&&(o=o||i,i=r,r=t),b.ajax({url:e,type:n,dataType:o,data:r,success:i})}}),b.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:yn,type:"GET",isLocal:Nn.test(mn[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":Dn,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText"},converters:{"* text":e.String,"text html":!0,"text json":b.parseJSON,"text xml":b.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(e,t){return t?Mn(Mn(e,b.ajaxSettings),t):Mn(b.ajaxSettings,e)},ajaxPrefilter:Hn(An),ajaxTransport:Hn(jn),ajax:function(e,n){"object"==typeof e&&(n=e,e=t),n=n||{};var r,i,o,a,s,u,l,c,p=b.ajaxSetup({},n),f=p.context||p,d=p.context&&(f.nodeType||f.jquery)?b(f):b.event,h=b.Deferred(),g=b.Callbacks("once memory"),m=p.statusCode||{},y={},v={},x=0,T="canceled",N={readyState:0,getResponseHeader:function(e){var t;if(2===x){if(!c){c={};while(t=Tn.exec(a))c[t[1].toLowerCase()]=t[2]}t=c[e.toLowerCase()]}return null==t?null:t},getAllResponseHeaders:function(){return 2===x?a:null},setRequestHeader:function(e,t){var n=e.toLowerCase();return x||(e=v[n]=v[n]||e,y[e]=t),this},overrideMimeType:function(e){return x||(p.mimeType=e),this},statusCode:function(e){var t;if(e)if(2>x)for(t in e)m[t]=[m[t],e[t]];else N.always(e[N.status]);return this},abort:function(e){var t=e||T;return l&&l.abort(t),k(0,t),this}};if(h.promise(N).complete=g.add,N.success=N.done,N.error=N.fail,p.url=((e||p.url||yn)+"").replace(xn,"").replace(kn,mn[1]+"//"),p.type=n.method||n.type||p.method||p.type,p.dataTypes=b.trim(p.dataType||"*").toLowerCase().match(w)||[""],null==p.crossDomain&&(r=En.exec(p.url.toLowerCase()),p.crossDomain=!(!r||r[1]===mn[1]&&r[2]===mn[2]&&(r[3]||("http:"===r[1]?80:443))==(mn[3]||("http:"===mn[1]?80:443)))),p.data&&p.processData&&"string"!=typeof p.data&&(p.data=b.param(p.data,p.traditional)),qn(An,p,n,N),2===x)return N;u=p.global,u&&0===b.active++&&b.event.trigger("ajaxStart"),p.type=p.type.toUpperCase(),p.hasContent=!Cn.test(p.type),o=p.url,p.hasContent||(p.data&&(o=p.url+=(bn.test(o)?"&":"?")+p.data,delete p.data),p.cache===!1&&(p.url=wn.test(o)?o.replace(wn,"$1_="+vn++):o+(bn.test(o)?"&":"?")+"_="+vn++)),p.ifModified&&(b.lastModified[o]&&N.setRequestHeader("If-Modified-Since",b.lastModified[o]),b.etag[o]&&N.setRequestHeader("If-None-Match",b.etag[o])),(p.data&&p.hasContent&&p.contentType!==!1||n.contentType)&&N.setRequestHeader("Content-Type",p.contentType),N.setRequestHeader("Accept",p.dataTypes[0]&&p.accepts[p.dataTypes[0]]?p.accepts[p.dataTypes[0]]+("*"!==p.dataTypes[0]?", "+Dn+"; q=0.01":""):p.accepts["*"]);for(i in p.headers)N.setRequestHeader(i,p.headers[i]);if(p.beforeSend&&(p.beforeSend.call(f,N,p)===!1||2===x))return N.abort();T="abort";for(i in{success:1,error:1,complete:1})N[i](p[i]);if(l=qn(jn,p,n,N)){N.readyState=1,u&&d.trigger("ajaxSend",[N,p]),p.async&&p.timeout>0&&(s=setTimeout(function(){N.abort("timeout")},p.timeout));try{x=1,l.send(y,k)}catch(C){if(!(2>x))throw C;k(-1,C)}}else k(-1,"No Transport");function k(e,n,r,i){var c,y,v,w,T,C=n;2!==x&&(x=2,s&&clearTimeout(s),l=t,a=i||"",N.readyState=e>0?4:0,r&&(w=_n(p,N,r)),e>=200&&300>e||304===e?(p.ifModified&&(T=N.getResponseHeader("Last-Modified"),T&&(b.lastModified[o]=T),T=N.getResponseHeader("etag"),T&&(b.etag[o]=T)),204===e?(c=!0,C="nocontent"):304===e?(c=!0,C="notmodified"):(c=Fn(p,w),C=c.state,y=c.data,v=c.error,c=!v)):(v=C,(e||!C)&&(C="error",0>e&&(e=0))),N.status=e,N.statusText=(n||C)+"",c?h.resolveWith(f,[y,C,N]):h.rejectWith(f,[N,C,v]),N.statusCode(m),m=t,u&&d.trigger(c?"ajaxSuccess":"ajaxError",[N,p,c?y:v]),g.fireWith(f,[N,C]),u&&(d.trigger("ajaxComplete",[N,p]),--b.active||b.event.trigger("ajaxStop")))}return N},getScript:function(e,n){return b.get(e,t,n,"script")},getJSON:function(e,t,n){return b.get(e,t,n,"json")}});function _n(e,n,r){var i,o,a,s,u=e.contents,l=e.dataTypes,c=e.responseFields;for(s in c)s in r&&(n[c[s]]=r[s]);while("*"===l[0])l.shift(),o===t&&(o=e.mimeType||n.getResponseHeader("Content-Type"));if(o)for(s in u)if(u[s]&&u[s].test(o)){l.unshift(s);break}if(l[0]in r)a=l[0];else{for(s in r){if(!l[0]||e.converters[s+" "+l[0]]){a=s;break}i||(i=s)}a=a||i}return a?(a!==l[0]&&l.unshift(a),r[a]):t}function Fn(e,t){var n,r,i,o,a={},s=0,u=e.dataTypes.slice(),l=u[0];if(e.dataFilter&&(t=e.dataFilter(t,e.dataType)),u[1])for(i in e.converters)a[i.toLowerCase()]=e.converters[i];for(;r=u[++s];)if("*"!==r){if("*"!==l&&l!==r){if(i=a[l+" "+r]||a["* "+r],!i)for(n in a)if(o=n.split(" "),o[1]===r&&(i=a[l+" "+o[0]]||a["* "+o[0]])){i===!0?i=a[n]:a[n]!==!0&&(r=o[0],u.splice(s--,0,r));break}if(i!==!0)if(i&&e["throws"])t=i(t);else try{t=i(t)}catch(c){return{state:"parsererror",error:i?c:"No conversion from "+l+" to "+r}}}l=r}return{state:"success",data:t}}b.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(e){return b.globalEval(e),e}}}),b.ajaxPrefilter("script",function(e){e.cache===t&&(e.cache=!1),e.crossDomain&&(e.type="GET",e.global=!1)}),b.ajaxTransport("script",function(e){if(e.crossDomain){var n,r=o.head||b("head")[0]||o.documentElement;return{send:function(t,i){n=o.createElement("script"),n.async=!0,e.scriptCharset&&(n.charset=e.scriptCharset),n.src=e.url,n.onload=n.onreadystatechange=function(e,t){(t||!n.readyState||/loaded|complete/.test(n.readyState))&&(n.onload=n.onreadystatechange=null,n.parentNode&&n.parentNode.removeChild(n),n=null,t||i(200,"success"))},r.insertBefore(n,r.firstChild)},abort:function(){n&&n.onload(t,!0)}}}});var On=[],Bn=/(=)\?(?=&|$)|\?\?/;b.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var e=On.pop()||b.expando+"_"+vn++;return this[e]=!0,e}}),b.ajaxPrefilter("json jsonp",function(n,r,i){var o,a,s,u=n.jsonp!==!1&&(Bn.test(n.url)?"url":"string"==typeof n.data&&!(n.contentType||"").indexOf("application/x-www-form-urlencoded")&&Bn.test(n.data)&&"data");return u||"jsonp"===n.dataTypes[0]?(o=n.jsonpCallback=b.isFunction(n.jsonpCallback)?n.jsonpCallback():n.jsonpCallback,u?n[u]=n[u].replace(Bn,"$1"+o):n.jsonp!==!1&&(n.url+=(bn.test(n.url)?"&":"?")+n.jsonp+"="+o),n.converters["script json"]=function(){return s||b.error(o+" was not called"),s[0]},n.dataTypes[0]="json",a=e[o],e[o]=function(){s=arguments},i.always(function(){e[o]=a,n[o]&&(n.jsonpCallback=r.jsonpCallback,On.push(o)),s&&b.isFunction(a)&&a(s[0]),s=a=t}),"script"):t});var Pn,Rn,Wn=0,$n=e.ActiveXObject&&function(){var e;for(e in Pn)Pn[e](t,!0)};function In(){try{return new e.XMLHttpRequest}catch(t){}}function zn(){try{return new e.ActiveXObject("Microsoft.XMLHTTP")}catch(t){}}b.ajaxSettings.xhr=e.ActiveXObject?function(){return!this.isLocal&&In()||zn()}:In,Rn=b.ajaxSettings.xhr(),b.support.cors=!!Rn&&"withCredentials"in Rn,Rn=b.support.ajax=!!Rn,Rn&&b.ajaxTransport(function(n){if(!n.crossDomain||b.support.cors){var r;return{send:function(i,o){var a,s,u=n.xhr();if(n.username?u.open(n.type,n.url,n.async,n.username,n.password):u.open(n.type,n.url,n.async),n.xhrFields)for(s in n.xhrFields)u[s]=n.xhrFields[s];n.mimeType&&u.overrideMimeType&&u.overrideMimeType(n.mimeType),n.crossDomain||i["X-Requested-With"]||(i["X-Requested-With"]="XMLHttpRequest");try{for(s in i)u.setRequestHeader(s,i[s])}catch(l){}u.send(n.hasContent&&n.data||null),r=function(e,i){var s,l,c,p;try{if(r&&(i||4===u.readyState))if(r=t,a&&(u.onreadystatechange=b.noop,$n&&delete Pn[a]),i)4!==u.readyState&&u.abort();else{p={},s=u.status,l=u.getAllResponseHeaders(),"string"==typeof u.responseText&&(p.text=u.responseText);try{c=u.statusText}catch(f){c=""}s||!n.isLocal||n.crossDomain?1223===s&&(s=204):s=p.text?200:404}}catch(d){i||o(-1,d)}p&&o(s,c,p,l)},n.async?4===u.readyState?setTimeout(r):(a=++Wn,$n&&(Pn||(Pn={},b(e).unload($n)),Pn[a]=r),u.onreadystatechange=r):r()},abort:function(){r&&r(t,!0)}}}});var Xn,Un,Vn=/^(?:toggle|show|hide)$/,Yn=RegExp("^(?:([+-])=|)("+x+")([a-z%]*)$","i"),Jn=/queueHooks$/,Gn=[nr],Qn={"*":[function(e,t){var n,r,i=this.createTween(e,t),o=Yn.exec(t),a=i.cur(),s=+a||0,u=1,l=20;if(o){if(n=+o[2],r=o[3]||(b.cssNumber[e]?"":"px"),"px"!==r&&s){s=b.css(i.elem,e,!0)||n||1;do u=u||".5",s/=u,b.style(i.elem,e,s+r);while(u!==(u=i.cur()/a)&&1!==u&&--l)}i.unit=r,i.start=s,i.end=o[1]?s+(o[1]+1)*n:n}return i}]};function Kn(){return setTimeout(function(){Xn=t}),Xn=b.now()}function Zn(e,t){b.each(t,function(t,n){var r=(Qn[t]||[]).concat(Qn["*"]),i=0,o=r.length;for(;o>i;i++)if(r[i].call(e,t,n))return})}function er(e,t,n){var r,i,o=0,a=Gn.length,s=b.Deferred().always(function(){delete u.elem}),u=function(){if(i)return!1;var t=Xn||Kn(),n=Math.max(0,l.startTime+l.duration-t),r=n/l.duration||0,o=1-r,a=0,u=l.tweens.length;for(;u>a;a++)l.tweens[a].run(o);return s.notifyWith(e,[l,o,n]),1>o&&u?n:(s.resolveWith(e,[l]),!1)},l=s.promise({elem:e,props:b.extend({},t),opts:b.extend(!0,{specialEasing:{}},n),originalProperties:t,originalOptions:n,startTime:Xn||Kn(),duration:n.duration,tweens:[],createTween:function(t,n){var r=b.Tween(e,l.opts,t,n,l.opts.specialEasing[t]||l.opts.easing);return l.tweens.push(r),r},stop:function(t){var n=0,r=t?l.tweens.length:0;if(i)return this;for(i=!0;r>n;n++)l.tweens[n].run(1);return t?s.resolveWith(e,[l,t]):s.rejectWith(e,[l,t]),this}}),c=l.props;for(tr(c,l.opts.specialEasing);a>o;o++)if(r=Gn[o].call(l,e,c,l.opts))return r;return Zn(l,c),b.isFunction(l.opts.start)&&l.opts.start.call(e,l),b.fx.timer(b.extend(u,{elem:e,anim:l,queue:l.opts.queue})),l.progress(l.opts.progress).done(l.opts.done,l.opts.complete).fail(l.opts.fail).always(l.opts.always)}function tr(e,t){var n,r,i,o,a;for(i in e)if(r=b.camelCase(i),o=t[r],n=e[i],b.isArray(n)&&(o=n[1],n=e[i]=n[0]),i!==r&&(e[r]=n,delete e[i]),a=b.cssHooks[r],a&&"expand"in a){n=a.expand(n),delete e[r];for(i in n)i in e||(e[i]=n[i],t[i]=o)}else t[r]=o}b.Animation=b.extend(er,{tweener:function(e,t){b.isFunction(e)?(t=e,e=["*"]):e=e.split(" ");var n,r=0,i=e.length;for(;i>r;r++)n=e[r],Qn[n]=Qn[n]||[],Qn[n].unshift(t)},prefilter:function(e,t){t?Gn.unshift(e):Gn.push(e)}});function nr(e,t,n){var r,i,o,a,s,u,l,c,p,f=this,d=e.style,h={},g=[],m=e.nodeType&&nn(e);n.queue||(c=b._queueHooks(e,"fx"),null==c.unqueued&&(c.unqueued=0,p=c.empty.fire,c.empty.fire=function(){c.unqueued||p()}),c.unqueued++,f.always(function(){f.always(function(){c.unqueued--,b.queue(e,"fx").length||c.empty.fire()})})),1===e.nodeType&&("height"in t||"width"in t)&&(n.overflow=[d.overflow,d.overflowX,d.overflowY],"inline"===b.css(e,"display")&&"none"===b.css(e,"float")&&(b.support.inlineBlockNeedsLayout&&"inline"!==un(e.nodeName)?d.zoom=1:d.display="inline-block")),n.overflow&&(d.overflow="hidden",b.support.shrinkWrapBlocks||f.always(function(){d.overflow=n.overflow[0],d.overflowX=n.overflow[1],d.overflowY=n.overflow[2]}));for(i in t)if(a=t[i],Vn.exec(a)){if(delete t[i],u=u||"toggle"===a,a===(m?"hide":"show"))continue;g.push(i)}if(o=g.length){s=b._data(e,"fxshow")||b._data(e,"fxshow",{}),"hidden"in s&&(m=s.hidden),u&&(s.hidden=!m),m?b(e).show():f.done(function(){b(e).hide()}),f.done(function(){var t;b._removeData(e,"fxshow");for(t in h)b.style(e,t,h[t])});for(i=0;o>i;i++)r=g[i],l=f.createTween(r,m?s[r]:0),h[r]=s[r]||b.style(e,r),r in s||(s[r]=l.start,m&&(l.end=l.start,l.start="width"===r||"height"===r?1:0))}}function rr(e,t,n,r,i){return new rr.prototype.init(e,t,n,r,i)}b.Tween=rr,rr.prototype={constructor:rr,init:function(e,t,n,r,i,o){this.elem=e,this.prop=n,this.easing=i||"swing",this.options=t,this.start=this.now=this.cur(),this.end=r,this.unit=o||(b.cssNumber[n]?"":"px")},cur:function(){var e=rr.propHooks[this.prop];return e&&e.get?e.get(this):rr.propHooks._default.get(this)},run:function(e){var t,n=rr.propHooks[this.prop];return this.pos=t=this.options.duration?b.easing[this.easing](e,this.options.duration*e,0,1,this.options.duration):e,this.now=(this.end-this.start)*t+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),n&&n.set?n.set(this):rr.propHooks._default.set(this),this}},rr.prototype.init.prototype=rr.prototype,rr.propHooks={_default:{get:function(e){var t;return null==e.elem[e.prop]||e.elem.style&&null!=e.elem.style[e.prop]?(t=b.css(e.elem,e.prop,""),t&&"auto"!==t?t:0):e.elem[e.prop]},set:function(e){b.fx.step[e.prop]?b.fx.step[e.prop](e):e.elem.style&&(null!=e.elem.style[b.cssProps[e.prop]]||b.cssHooks[e.prop])?b.style(e.elem,e.prop,e.now+e.unit):e.elem[e.prop]=e.now}}},rr.propHooks.scrollTop=rr.propHooks.scrollLeft={set:function(e){e.elem.nodeType&&e.elem.parentNode&&(e.elem[e.prop]=e.now)}},b.each(["toggle","show","hide"],function(e,t){var n=b.fn[t];b.fn[t]=function(e,r,i){return null==e||"boolean"==typeof e?n.apply(this,arguments):this.animate(ir(t,!0),e,r,i)}}),b.fn.extend({fadeTo:function(e,t,n,r){return this.filter(nn).css("opacity",0).show().end().animate({opacity:t},e,n,r)},animate:function(e,t,n,r){var i=b.isEmptyObject(e),o=b.speed(t,n,r),a=function(){var t=er(this,b.extend({},e),o);a.finish=function(){t.stop(!0)},(i||b._data(this,"finish"))&&t.stop(!0)};return a.finish=a,i||o.queue===!1?this.each(a):this.queue(o.queue,a)},stop:function(e,n,r){var i=function(e){var t=e.stop;delete e.stop,t(r)};return"string"!=typeof e&&(r=n,n=e,e=t),n&&e!==!1&&this.queue(e||"fx",[]),this.each(function(){var t=!0,n=null!=e&&e+"queueHooks",o=b.timers,a=b._data(this);if(n)a[n]&&a[n].stop&&i(a[n]);else for(n in a)a[n]&&a[n].stop&&Jn.test(n)&&i(a[n]);for(n=o.length;n--;)o[n].elem!==this||null!=e&&o[n].queue!==e||(o[n].anim.stop(r),t=!1,o.splice(n,1));(t||!r)&&b.dequeue(this,e)})},finish:function(e){return e!==!1&&(e=e||"fx"),this.each(function(){var t,n=b._data(this),r=n[e+"queue"],i=n[e+"queueHooks"],o=b.timers,a=r?r.length:0;for(n.finish=!0,b.queue(this,e,[]),i&&i.cur&&i.cur.finish&&i.cur.finish.call(this),t=o.length;t--;)o[t].elem===this&&o[t].queue===e&&(o[t].anim.stop(!0),o.splice(t,1));for(t=0;a>t;t++)r[t]&&r[t].finish&&r[t].finish.call(this);delete n.finish})}});function ir(e,t){var n,r={height:e},i=0;for(t=t?1:0;4>i;i+=2-t)n=Zt[i],r["margin"+n]=r["padding"+n]=e;return t&&(r.opacity=r.width=e),r}b.each({slideDown:ir("show"),slideUp:ir("hide"),slideToggle:ir("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(e,t){b.fn[e]=function(e,n,r){return this.animate(t,e,n,r)}}),b.speed=function(e,t,n){var r=e&&"object"==typeof e?b.extend({},e):{complete:n||!n&&t||b.isFunction(e)&&e,duration:e,easing:n&&t||t&&!b.isFunction(t)&&t};return r.duration=b.fx.off?0:"number"==typeof r.duration?r.duration:r.duration in b.fx.speeds?b.fx.speeds[r.duration]:b.fx.speeds._default,(null==r.queue||r.queue===!0)&&(r.queue="fx"),r.old=r.complete,r.complete=function(){b.isFunction(r.old)&&r.old.call(this),r.queue&&b.dequeue(this,r.queue)},r},b.easing={linear:function(e){return e},swing:function(e){return.5-Math.cos(e*Math.PI)/2}},b.timers=[],b.fx=rr.prototype.init,b.fx.tick=function(){var e,n=b.timers,r=0;for(Xn=b.now();n.length>r;r++)e=n[r],e()||n[r]!==e||n.splice(r--,1);n.length||b.fx.stop(),Xn=t},b.fx.timer=function(e){e()&&b.timers.push(e)&&b.fx.start()},b.fx.interval=13,b.fx.start=function(){Un||(Un=setInterval(b.fx.tick,b.fx.interval))},b.fx.stop=function(){clearInterval(Un),Un=null},b.fx.speeds={slow:600,fast:200,_default:400},b.fx.step={},b.expr&&b.expr.filters&&(b.expr.filters.animated=function(e){return b.grep(b.timers,function(t){return e===t.elem}).length}),b.fn.offset=function(e){if(arguments.length)return e===t?this:this.each(function(t){b.offset.setOffset(this,e,t)});var n,r,o={top:0,left:0},a=this[0],s=a&&a.ownerDocument;if(s)return n=s.documentElement,b.contains(n,a)?(typeof a.getBoundingClientRect!==i&&(o=a.getBoundingClientRect()),r=or(s),{top:o.top+(r.pageYOffset||n.scrollTop)-(n.clientTop||0),left:o.left+(r.pageXOffset||n.scrollLeft)-(n.clientLeft||0)}):o},b.offset={setOffset:function(e,t,n){var r=b.css(e,"position");"static"===r&&(e.style.position="relative");var i=b(e),o=i.offset(),a=b.css(e,"top"),s=b.css(e,"left"),u=("absolute"===r||"fixed"===r)&&b.inArray("auto",[a,s])>-1,l={},c={},p,f;u?(c=i.position(),p=c.top,f=c.left):(p=parseFloat(a)||0,f=parseFloat(s)||0),b.isFunction(t)&&(t=t.call(e,n,o)),null!=t.top&&(l.top=t.top-o.top+p),null!=t.left&&(l.left=t.left-o.left+f),"using"in t?t.using.call(e,l):i.css(l)}},b.fn.extend({position:function(){if(this[0]){var e,t,n={top:0,left:0},r=this[0];return"fixed"===b.css(r,"position")?t=r.getBoundingClientRect():(e=this.offsetParent(),t=this.offset(),b.nodeName(e[0],"html")||(n=e.offset()),n.top+=b.css(e[0],"borderTopWidth",!0),n.left+=b.css(e[0],"borderLeftWidth",!0)),{top:t.top-n.top-b.css(r,"marginTop",!0),left:t.left-n.left-b.css(r,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var e=this.offsetParent||o.documentElement;while(e&&!b.nodeName(e,"html")&&"static"===b.css(e,"position"))e=e.offsetParent;return e||o.documentElement})}}),b.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(e,n){var r=/Y/.test(n);b.fn[e]=function(i){return b.access(this,function(e,i,o){var a=or(e);return o===t?a?n in a?a[n]:a.document.documentElement[i]:e[i]:(a?a.scrollTo(r?b(a).scrollLeft():o,r?o:b(a).scrollTop()):e[i]=o,t)},e,i,arguments.length,null)}});function or(e){return b.isWindow(e)?e:9===e.nodeType?e.defaultView||e.parentWindow:!1}b.each({Height:"height",Width:"width"},function(e,n){b.each({padding:"inner"+e,content:n,"":"outer"+e},function(r,i){b.fn[i]=function(i,o){var a=arguments.length&&(r||"boolean"!=typeof i),s=r||(i===!0||o===!0?"margin":"border");return b.access(this,function(n,r,i){var o;return b.isWindow(n)?n.document.documentElement["client"+e]:9===n.nodeType?(o=n.documentElement,Math.max(n.body["scroll"+e],o["scroll"+e],n.body["offset"+e],o["offset"+e],o["client"+e])):i===t?b.css(n,r,s):b.style(n,r,i,s)},n,a?i:t,a,null)}})}),e.jQuery=e.$=b,"function"==typeof define&&define.amd&&define.amd.jQuery&&define("jquery",[],function(){return b})})(window);
/*global define:false */
/**
 * Copyright 2013 Craig Campbell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Mousetrap is a simple keyboard shortcut library for Javascript with
 * no external dependencies
 *
 * @version 1.4.6
 * @url craig.is/killing/mice
 */
(function(window, document, undefined) {

    /**
     * mapping of special keycodes to their corresponding keys
     *
     * everything in this dictionary cannot use keypress events
     * so it has to be here to map to the correct keycodes for
     * keyup/keydown events
     *
     * @type {Object}
     */
    var _MAP = {
            8: 'backspace',
            9: 'tab',
            13: 'enter',
            16: 'shift',
            17: 'ctrl',
            18: 'alt',
            20: 'capslock',
            27: 'esc',
            32: 'space',
            33: 'pageup',
            34: 'pagedown',
            35: 'end',
            36: 'home',
            37: 'left',
            38: 'up',
            39: 'right',
            40: 'down',
            45: 'ins',
            46: 'del',
            91: 'meta',
            93: 'meta',
            224: 'meta'
        },

        /**
         * mapping for special characters so they can support
         *
         * this dictionary is only used incase you want to bind a
         * keyup or keydown event to one of these keys
         *
         * @type {Object}
         */
        _KEYCODE_MAP = {
            106: '*',
            107: '+',
            109: '-',
            110: '.',
            111 : '/',
            186: ';',
            187: '=',
            188: ',',
            189: '-',
            190: '.',
            191: '/',
            192: '`',
            219: '[',
            220: '\\',
            221: ']',
            222: '\''
        },

        /**
         * this is a mapping of keys that require shift on a US keypad
         * back to the non shift equivelents
         *
         * this is so you can use keyup events with these keys
         *
         * note that this will only work reliably on US keyboards
         *
         * @type {Object}
         */
        _SHIFT_MAP = {
            '~': '`',
            '!': '1',
            '@': '2',
            '#': '3',
            '$': '4',
            '%': '5',
            '^': '6',
            '&': '7',
            '*': '8',
            '(': '9',
            ')': '0',
            '_': '-',
            '+': '=',
            ':': ';',
            '\"': '\'',
            '<': ',',
            '>': '.',
            '?': '/',
            '|': '\\'
        },

        /**
         * this is a list of special strings you can use to map
         * to modifier keys when you specify your keyboard shortcuts
         *
         * @type {Object}
         */
        _SPECIAL_ALIASES = {
            'option': 'alt',
            'command': 'meta',
            'return': 'enter',
            'escape': 'esc',
            'mod': /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl'
        },

        /**
         * variable to store the flipped version of _MAP from above
         * needed to check if we should use keypress or not when no action
         * is specified
         *
         * @type {Object|undefined}
         */
        _REVERSE_MAP,

        /**
         * a list of all the callbacks setup via Mousetrap.bind()
         *
         * @type {Object}
         */
        _callbacks = {},

        /**
         * direct map of string combinations to callbacks used for trigger()
         *
         * @type {Object}
         */
        _directMap = {},

        /**
         * keeps track of what level each sequence is at since multiple
         * sequences can start out with the same sequence
         *
         * @type {Object}
         */
        _sequenceLevels = {},

        /**
         * variable to store the setTimeout call
         *
         * @type {null|number}
         */
        _resetTimer,

        /**
         * temporary state where we will ignore the next keyup
         *
         * @type {boolean|string}
         */
        _ignoreNextKeyup = false,

        /**
         * temporary state where we will ignore the next keypress
         *
         * @type {boolean}
         */
        _ignoreNextKeypress = false,

        /**
         * are we currently inside of a sequence?
         * type of action ("keyup" or "keydown" or "keypress") or false
         *
         * @type {boolean|string}
         */
        _nextExpectedAction = false;

    /**
     * loop through the f keys, f1 to f19 and add them to the map
     * programatically
     */
    for (var i = 1; i < 20; ++i) {
        _MAP[111 + i] = 'f' + i;
    }

    /**
     * loop through to map numbers on the numeric keypad
     */
    for (i = 0; i <= 9; ++i) {
        _MAP[i + 96] = i;
    }

    /**
     * cross browser add event method
     *
     * @param {Element|HTMLDocument} object
     * @param {string} type
     * @param {Function} callback
     * @returns void
     */
    function _addEvent(object, type, callback) {
        if (object.addEventListener) {
            object.addEventListener(type, callback, false);
            return;
        }

        object.attachEvent('on' + type, callback);
    }

    /**
     * takes the event and returns the key character
     *
     * @param {Event} e
     * @return {string}
     */
    function _characterFromEvent(e) {

        // for keypress events we should return the character as is
        if (e.type == 'keypress') {
            var character = String.fromCharCode(e.which);

            // if the shift key is not pressed then it is safe to assume
            // that we want the character to be lowercase.  this means if
            // you accidentally have caps lock on then your key bindings
            // will continue to work
            //
            // the only side effect that might not be desired is if you
            // bind something like 'A' cause you want to trigger an
            // event when capital A is pressed caps lock will no longer
            // trigger the event.  shift+a will though.
            if (!e.shiftKey) {
                character = character.toLowerCase();
            }

            return character;
        }

        // for non keypress events the special maps are needed
        if (_MAP[e.which]) {
            return _MAP[e.which];
        }

        if (_KEYCODE_MAP[e.which]) {
            return _KEYCODE_MAP[e.which];
        }

        // if it is not in the special map

        // with keydown and keyup events the character seems to always
        // come in as an uppercase character whether you are pressing shift
        // or not.  we should make sure it is always lowercase for comparisons
        return String.fromCharCode(e.which).toLowerCase();
    }

    /**
     * checks if two arrays are equal
     *
     * @param {Array} modifiers1
     * @param {Array} modifiers2
     * @returns {boolean}
     */
    function _modifiersMatch(modifiers1, modifiers2) {
        return modifiers1.sort().join(',') === modifiers2.sort().join(',');
    }

    /**
     * resets all sequence counters except for the ones passed in
     *
     * @param {Object} doNotReset
     * @returns void
     */
    function _resetSequences(doNotReset) {
        doNotReset = doNotReset || {};

        var activeSequences = false,
            key;

        for (key in _sequenceLevels) {
            if (doNotReset[key]) {
                activeSequences = true;
                continue;
            }
            _sequenceLevels[key] = 0;
        }

        if (!activeSequences) {
            _nextExpectedAction = false;
        }
    }

    /**
     * finds all callbacks that match based on the keycode, modifiers,
     * and action
     *
     * @param {string} character
     * @param {Array} modifiers
     * @param {Event|Object} e
     * @param {string=} sequenceName - name of the sequence we are looking for
     * @param {string=} combination
     * @param {number=} level
     * @returns {Array}
     */
    function _getMatches(character, modifiers, e, sequenceName, combination, level) {
        var i,
            callback,
            matches = [],
            action = e.type;

        // if there are no events related to this keycode
        if (!_callbacks[character]) {
            return [];
        }

        // if a modifier key is coming up on its own we should allow it
        if (action == 'keyup' && _isModifier(character)) {
            modifiers = [character];
        }

        // loop through all callbacks for the key that was pressed
        // and see if any of them match
        for (i = 0; i < _callbacks[character].length; ++i) {
            callback = _callbacks[character][i];

            // if a sequence name is not specified, but this is a sequence at
            // the wrong level then move onto the next match
            if (!sequenceName && callback.seq && _sequenceLevels[callback.seq] != callback.level) {
                continue;
            }

            // if the action we are looking for doesn't match the action we got
            // then we should keep going
            if (action != callback.action) {
                continue;
            }

            // if this is a keypress event and the meta key and control key
            // are not pressed that means that we need to only look at the
            // character, otherwise check the modifiers as well
            //
            // chrome will not fire a keypress if meta or control is down
            // safari will fire a keypress if meta or meta+shift is down
            // firefox will fire a keypress if meta or control is down
            if ((action == 'keypress' && !e.metaKey && !e.ctrlKey) || _modifiersMatch(modifiers, callback.modifiers)) {

                // when you bind a combination or sequence a second time it
                // should overwrite the first one.  if a sequenceName or
                // combination is specified in this call it does just that
                //
                // @todo make deleting its own method?
                var deleteCombo = !sequenceName && callback.combo == combination;
                var deleteSequence = sequenceName && callback.seq == sequenceName && callback.level == level;
                if (deleteCombo || deleteSequence) {
                    _callbacks[character].splice(i, 1);
                }

                matches.push(callback);
            }
        }

        return matches;
    }

    /**
     * takes a key event and figures out what the modifiers are
     *
     * @param {Event} e
     * @returns {Array}
     */
    function _eventModifiers(e) {
        var modifiers = [];

        if (e.shiftKey) {
            modifiers.push('shift');
        }

        if (e.altKey) {
            modifiers.push('alt');
        }

        if (e.ctrlKey) {
            modifiers.push('ctrl');
        }

        if (e.metaKey) {
            modifiers.push('meta');
        }

        return modifiers;
    }

    /**
     * prevents default for this event
     *
     * @param {Event} e
     * @returns void
     */
    function _preventDefault(e) {
        if (e.preventDefault) {
            e.preventDefault();
            return;
        }

        e.returnValue = false;
    }

    /**
     * stops propogation for this event
     *
     * @param {Event} e
     * @returns void
     */
    function _stopPropagation(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
            return;
        }

        e.cancelBubble = true;
    }

    /**
     * actually calls the callback function
     *
     * if your callback function returns false this will use the jquery
     * convention - prevent default and stop propogation on the event
     *
     * @param {Function} callback
     * @param {Event} e
     * @returns void
     */
    function _fireCallback(callback, e, combo, sequence) {

        // if this event should not happen stop here
        if (Mousetrap.stopCallback(e, e.target || e.srcElement, combo, sequence)) {
            return;
        }

        if (callback(e, combo) === false) {
            _preventDefault(e);
            _stopPropagation(e);
        }
    }

    /**
     * handles a character key event
     *
     * @param {string} character
     * @param {Array} modifiers
     * @param {Event} e
     * @returns void
     */
    function _handleKey(character, modifiers, e) {
        var callbacks = _getMatches(character, modifiers, e),
            i,
            doNotReset = {},
            maxLevel = 0,
            processedSequenceCallback = false;

        // Calculate the maxLevel for sequences so we can only execute the longest callback sequence
        for (i = 0; i < callbacks.length; ++i) {
            if (callbacks[i].seq) {
                maxLevel = Math.max(maxLevel, callbacks[i].level);
            }
        }

        // loop through matching callbacks for this key event
        for (i = 0; i < callbacks.length; ++i) {

            // fire for all sequence callbacks
            // this is because if for example you have multiple sequences
            // bound such as "g i" and "g t" they both need to fire the
            // callback for matching g cause otherwise you can only ever
            // match the first one
            if (callbacks[i].seq) {

                // only fire callbacks for the maxLevel to prevent
                // subsequences from also firing
                //
                // for example 'a option b' should not cause 'option b' to fire
                // even though 'option b' is part of the other sequence
                //
                // any sequences that do not match here will be discarded
                // below by the _resetSequences call
                if (callbacks[i].level != maxLevel) {
                    continue;
                }

                processedSequenceCallback = true;

                // keep a list of which sequences were matches for later
                doNotReset[callbacks[i].seq] = 1;
                _fireCallback(callbacks[i].callback, e, callbacks[i].combo, callbacks[i].seq);
                continue;
            }

            // if there were no sequence matches but we are still here
            // that means this is a regular match so we should fire that
            if (!processedSequenceCallback) {
                _fireCallback(callbacks[i].callback, e, callbacks[i].combo);
            }
        }

        // if the key you pressed matches the type of sequence without
        // being a modifier (ie "keyup" or "keypress") then we should
        // reset all sequences that were not matched by this event
        //
        // this is so, for example, if you have the sequence "h a t" and you
        // type "h e a r t" it does not match.  in this case the "e" will
        // cause the sequence to reset
        //
        // modifier keys are ignored because you can have a sequence
        // that contains modifiers such as "enter ctrl+space" and in most
        // cases the modifier key will be pressed before the next key
        //
        // also if you have a sequence such as "ctrl+b a" then pressing the
        // "b" key will trigger a "keypress" and a "keydown"
        //
        // the "keydown" is expected when there is a modifier, but the
        // "keypress" ends up matching the _nextExpectedAction since it occurs
        // after and that causes the sequence to reset
        //
        // we ignore keypresses in a sequence that directly follow a keydown
        // for the same character
        var ignoreThisKeypress = e.type == 'keypress' && _ignoreNextKeypress;
        if (e.type == _nextExpectedAction && !_isModifier(character) && !ignoreThisKeypress) {
            _resetSequences(doNotReset);
        }

        _ignoreNextKeypress = processedSequenceCallback && e.type == 'keydown';
    }

    /**
     * handles a keydown event
     *
     * @param {Event} e
     * @returns void
     */
    function _handleKeyEvent(e) {

        // normalize e.which for key events
        // @see http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
        if (typeof e.which !== 'number') {
            e.which = e.keyCode;
        }

        var character = _characterFromEvent(e);

        // no character found then stop
        if (!character) {
            return;
        }

        // need to use === for the character check because the character can be 0
        if (e.type == 'keyup' && _ignoreNextKeyup === character) {
            _ignoreNextKeyup = false;
            return;
        }

        Mousetrap.handleKey(character, _eventModifiers(e), e);
    }

    /**
     * determines if the keycode specified is a modifier key or not
     *
     * @param {string} key
     * @returns {boolean}
     */
    function _isModifier(key) {
        return key == 'shift' || key == 'ctrl' || key == 'alt' || key == 'meta';
    }

    /**
     * called to set a 1 second timeout on the specified sequence
     *
     * this is so after each key press in the sequence you have 1 second
     * to press the next key before you have to start over
     *
     * @returns void
     */
    function _resetSequenceTimer() {
        clearTimeout(_resetTimer);
        _resetTimer = setTimeout(_resetSequences, 1000);
    }

    /**
     * reverses the map lookup so that we can look for specific keys
     * to see what can and can't use keypress
     *
     * @return {Object}
     */
    function _getReverseMap() {
        if (!_REVERSE_MAP) {
            _REVERSE_MAP = {};
            for (var key in _MAP) {

                // pull out the numeric keypad from here cause keypress should
                // be able to detect the keys from the character
                if (key > 95 && key < 112) {
                    continue;
                }

                if (_MAP.hasOwnProperty(key)) {
                    _REVERSE_MAP[_MAP[key]] = key;
                }
            }
        }
        return _REVERSE_MAP;
    }

    /**
     * picks the best action based on the key combination
     *
     * @param {string} key - character for key
     * @param {Array} modifiers
     * @param {string=} action passed in
     */
    function _pickBestAction(key, modifiers, action) {

        // if no action was picked in we should try to pick the one
        // that we think would work best for this key
        if (!action) {
            action = _getReverseMap()[key] ? 'keydown' : 'keypress';
        }

        // modifier keys don't work as expected with keypress,
        // switch to keydown
        if (action == 'keypress' && modifiers.length) {
            action = 'keydown';
        }

        return action;
    }

    /**
     * binds a key sequence to an event
     *
     * @param {string} combo - combo specified in bind call
     * @param {Array} keys
     * @param {Function} callback
     * @param {string=} action
     * @returns void
     */
    function _bindSequence(combo, keys, callback, action) {

        // start off by adding a sequence level record for this combination
        // and setting the level to 0
        _sequenceLevels[combo] = 0;

        /**
         * callback to increase the sequence level for this sequence and reset
         * all other sequences that were active
         *
         * @param {string} nextAction
         * @returns {Function}
         */
        function _increaseSequence(nextAction) {
            return function() {
                _nextExpectedAction = nextAction;
                ++_sequenceLevels[combo];
                _resetSequenceTimer();
            };
        }

        /**
         * wraps the specified callback inside of another function in order
         * to reset all sequence counters as soon as this sequence is done
         *
         * @param {Event} e
         * @returns void
         */
        function _callbackAndReset(e) {
            _fireCallback(callback, e, combo);

            // we should ignore the next key up if the action is key down
            // or keypress.  this is so if you finish a sequence and
            // release the key the final key will not trigger a keyup
            if (action !== 'keyup') {
                _ignoreNextKeyup = _characterFromEvent(e);
            }

            // weird race condition if a sequence ends with the key
            // another sequence begins with
            setTimeout(_resetSequences, 10);
        }

        // loop through keys one at a time and bind the appropriate callback
        // function.  for any key leading up to the final one it should
        // increase the sequence. after the final, it should reset all sequences
        //
        // if an action is specified in the original bind call then that will
        // be used throughout.  otherwise we will pass the action that the
        // next key in the sequence should match.  this allows a sequence
        // to mix and match keypress and keydown events depending on which
        // ones are better suited to the key provided
        for (var i = 0; i < keys.length; ++i) {
            var isFinal = i + 1 === keys.length;
            var wrappedCallback = isFinal ? _callbackAndReset : _increaseSequence(action || _getKeyInfo(keys[i + 1]).action);
            _bindSingle(keys[i], wrappedCallback, action, combo, i);
        }
    }

    /**
     * Converts from a string key combination to an array
     *
     * @param  {string} combination like "command+shift+l"
     * @return {Array}
     */
    function _keysFromString(combination) {
        if (combination === '+') {
            return ['+'];
        }

        return combination.split('+');
    }

    /**
     * Gets info for a specific key combination
     *
     * @param  {string} combination key combination ("command+s" or "a" or "*")
     * @param  {string=} action
     * @returns {Object}
     */
    function _getKeyInfo(combination, action) {
        var keys,
            key,
            i,
            modifiers = [];

        // take the keys from this pattern and figure out what the actual
        // pattern is all about
        keys = _keysFromString(combination);

        for (i = 0; i < keys.length; ++i) {
            key = keys[i];

            // normalize key names
            if (_SPECIAL_ALIASES[key]) {
                key = _SPECIAL_ALIASES[key];
            }

            // if this is not a keypress event then we should
            // be smart about using shift keys
            // this will only work for US keyboards however
            if (action && action != 'keypress' && _SHIFT_MAP[key]) {
                key = _SHIFT_MAP[key];
                modifiers.push('shift');
            }

            // if this key is a modifier then add it to the list of modifiers
            if (_isModifier(key)) {
                modifiers.push(key);
            }
        }

        // depending on what the key combination is
        // we will try to pick the best event for it
        action = _pickBestAction(key, modifiers, action);

        return {
            key: key,
            modifiers: modifiers,
            action: action
        };
    }

    /**
     * binds a single keyboard combination
     *
     * @param {string} combination
     * @param {Function} callback
     * @param {string=} action
     * @param {string=} sequenceName - name of sequence if part of sequence
     * @param {number=} level - what part of the sequence the command is
     * @returns void
     */
    function _bindSingle(combination, callback, action, sequenceName, level) {

        // store a direct mapped reference for use with Mousetrap.trigger
        _directMap[combination + ':' + action] = callback;

        // make sure multiple spaces in a row become a single space
        combination = combination.replace(/\s+/g, ' ');

        var sequence = combination.split(' '),
            info;

        // if this pattern is a sequence of keys then run through this method
        // to reprocess each pattern one key at a time
        if (sequence.length > 1) {
            _bindSequence(combination, sequence, callback, action);
            return;
        }

        info = _getKeyInfo(combination, action);

        // make sure to initialize array if this is the first time
        // a callback is added for this key
        _callbacks[info.key] = _callbacks[info.key] || [];

        // remove an existing match if there is one
        _getMatches(info.key, info.modifiers, {type: info.action}, sequenceName, combination, level);

        // add this call back to the array
        // if it is a sequence put it at the beginning
        // if not put it at the end
        //
        // this is important because the way these are processed expects
        // the sequence ones to come first
        _callbacks[info.key][sequenceName ? 'unshift' : 'push']({
            callback: callback,
            modifiers: info.modifiers,
            action: info.action,
            seq: sequenceName,
            level: level,
            combo: combination
        });
    }

    /**
     * binds multiple combinations to the same callback
     *
     * @param {Array} combinations
     * @param {Function} callback
     * @param {string|undefined} action
     * @returns void
     */
    function _bindMultiple(combinations, callback, action) {
        for (var i = 0; i < combinations.length; ++i) {
            _bindSingle(combinations[i], callback, action);
        }
    }

    // start!
    _addEvent(document, 'keypress', _handleKeyEvent);
    _addEvent(document, 'keydown', _handleKeyEvent);
    _addEvent(document, 'keyup', _handleKeyEvent);

    var Mousetrap = {

        /**
         * binds an event to mousetrap
         *
         * can be a single key, a combination of keys separated with +,
         * an array of keys, or a sequence of keys separated by spaces
         *
         * be sure to list the modifier keys first to make sure that the
         * correct key ends up getting bound (the last key in the pattern)
         *
         * @param {string|Array} keys
         * @param {Function} callback
         * @param {string=} action - 'keypress', 'keydown', or 'keyup'
         * @returns void
         */
        bind: function(keys, callback, action) {
            keys = keys instanceof Array ? keys : [keys];
            _bindMultiple(keys, callback, action);
            return this;
        },

        /**
         * unbinds an event to mousetrap
         *
         * the unbinding sets the callback function of the specified key combo
         * to an empty function and deletes the corresponding key in the
         * _directMap dict.
         *
         * TODO: actually remove this from the _callbacks dictionary instead
         * of binding an empty function
         *
         * the keycombo+action has to be exactly the same as
         * it was defined in the bind method
         *
         * @param {string|Array} keys
         * @param {string} action
         * @returns void
         */
        unbind: function(keys, action) {
            return Mousetrap.bind(keys, function() {}, action);
        },

        /**
         * triggers an event that has already been bound
         *
         * @param {string} keys
         * @param {string=} action
         * @returns void
         */
        trigger: function(keys, action) {
            if (_directMap[keys + ':' + action]) {
                _directMap[keys + ':' + action]({}, keys);
            }
            return this;
        },

        /**
         * resets the library back to its initial state.  this is useful
         * if you want to clear out the current keyboard shortcuts and bind
         * new ones - for example if you switch to another page
         *
         * @returns void
         */
        reset: function() {
            _callbacks = {};
            _directMap = {};
            return this;
        },

       /**
        * should we stop this event before firing off callbacks
        *
        * @param {Event} e
        * @param {Element} element
        * @return {boolean}
        */
        stopCallback: function(e, element) {

            // if the element has the class "mousetrap" then no need to stop
            if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
                return false;
            }

            // stop for input, select, and textarea
            return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || element.isContentEditable;
        },

        /**
         * exposes _handleKey publicly so it can be overwritten by extensions
         */
        handleKey: _handleKey
    };

    // expose mousetrap to the global object
    window.Mousetrap = Mousetrap;

    // expose mousetrap as an AMD module
    if (typeof define === 'function' && define.amd) {
        define(Mousetrap);
    }
}) (window, document);

/*! angularjs-slider - v5.8.7 - 
 (c) Rafal Zajac <rzajac@gmail.com>, Valentin Hervieu <valentin@hervieu.me>, Jussi Saarivirta <jusasi@gmail.com>, Angelin Sirbu <angelin.sirbu@gmail.com> - 
 https://github.com/angular-slider/angularjs-slider - 
 2016-11-09 */
/*jslint unparam: true */
/*global angular: false, console: false, define, module */
(function(root, factory) {
  'use strict';
  /* istanbul ignore next */
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['angular'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    // to support bundler like browserify
    var angularObj = require('angular');
    if ((!angularObj || !angularObj.module) && typeof angular != 'undefined') {
      angularObj = angular;
    }
    module.exports = factory(angularObj);
  } else {
    // Browser globals (root is window)
    factory(root.angular);
  }

}(this, function(angular) {
  'use strict';
  var module = angular.module('rzModule', [])

  .factory('RzSliderOptions', function() {
    var defaultOptions = {
      floor: 0,
      ceil: null, //defaults to rz-slider-model
      step: 1,
      precision: 0,
      minRange: null,
      maxRange: null,
      pushRange: false,
      minLimit: null,
      maxLimit: null,
      id: null,
      translate: null,
      getLegend: null,
      stepsArray: null,
      bindIndexForStepsArray: false,
      draggableRange: false,
      draggableRangeOnly: false,
      showSelectionBar: false,
      showSelectionBarEnd: false,
      showSelectionBarFromValue: null,
      hidePointerLabels: false,
      hideLimitLabels: false,
      autoHideLimitLabels: true,
      readOnly: false,
      disabled: false,
      interval: 350,
      showTicks: false,
      showTicksValues: false,
      ticksArray: null,
      ticksTooltip: null,
      ticksValuesTooltip: null,
      vertical: false,
      getSelectionBarColor: null,
      getTickColor: null,
      getPointerColor: null,
      keyboardSupport: true,
      scale: 1,
      enforceStep: true,
      enforceRange: false,
      noSwitching: false,
      onlyBindHandles: false,
      onStart: null,
      onChange: null,
      onEnd: null,
      rightToLeft: false,
      boundPointerLabels: true,
      mergeRangeLabelsIfSame: false,
      customTemplateScope: null,
      logScale: false,
      customValueToPosition: null,
      customPositionToValue: null
    };
    var globalOptions = {};

    var factory = {};
    /**
     * `options({})` allows global configuration of all sliders in the
     * application.
     *
     *   var app = angular.module( 'App', ['rzModule'], function( RzSliderOptions ) {
     *     // show ticks for all sliders
     *     RzSliderOptions.options( { showTicks: true } );
     *   });
     */
    factory.options = function(value) {
      angular.extend(globalOptions, value);
    };

    factory.getOptions = function(options) {
      return angular.extend({}, defaultOptions, globalOptions, options);
    };

    return factory;
  })

  .factory('rzThrottle', ['$timeout', function($timeout) {
    /**
     * rzThrottle
     *
     * Taken from underscore project
     *
     * @param {Function} func
     * @param {number} wait
     * @param {ThrottleOptions} options
     * @returns {Function}
     */
    return function(func, wait, options) {
      'use strict';
      /* istanbul ignore next */
      var getTime = (Date.now || function() {
        return new Date().getTime();
      });
      var context, args, result;
      var timeout = null;
      var previous = 0;
      options = options || {};
      var later = function() {
        previous = getTime();
        timeout = null;
        result = func.apply(context, args);
        context = args = null;
      };
      return function() {
        var now = getTime();
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0) {
          $timeout.cancel(timeout);
          timeout = null;
          previous = now;
          result = func.apply(context, args);
          context = args = null;
        } else if (!timeout && options.trailing !== false) {
          timeout = $timeout(later, remaining);
        }
        return result;
      };
    }
  }])

  .factory('RzSlider', ['$timeout', '$document', '$window', '$compile', 'RzSliderOptions', 'rzThrottle', function($timeout, $document, $window, $compile, RzSliderOptions, rzThrottle) {
    'use strict';

    /**
     * Slider
     *
     * @param {ngScope} scope            The AngularJS scope
     * @param {Element} sliderElem The slider directive element wrapped in jqLite
     * @constructor
     */
    var Slider = function(scope, sliderElem) {
      /**
       * The slider's scope
       *
       * @type {ngScope}
       */
      this.scope = scope;

      /**
       * The slider inner low value (linked to rzSliderModel)
       * @type {number}
       */
      this.lowValue = 0;

      /**
       * The slider inner high value (linked to rzSliderHigh)
       * @type {number}
       */
      this.highValue = 0;

      /**
       * Slider element wrapped in jqLite
       *
       * @type {jqLite}
       */
      this.sliderElem = sliderElem;

      /**
       * Slider type
       *
       * @type {boolean} Set to true for range slider
       */
      this.range = this.scope.rzSliderModel !== undefined && this.scope.rzSliderHigh !== undefined;

      /**
       * Values recorded when first dragging the bar
       *
       * @type {Object}
       */
      this.dragging = {
        active: false,
        value: 0,
        difference: 0,
        position: 0,
        lowLimit: 0,
        highLimit: 0
      };

      /**
       * property that handle position (defaults to left for horizontal)
       * @type {string}
       */
      this.positionProperty = 'left';

      /**
       * property that handle dimension (defaults to width for horizontal)
       * @type {string}
       */
      this.dimensionProperty = 'width';

      /**
       * Half of the width or height of the slider handles
       *
       * @type {number}
       */
      this.handleHalfDim = 0;

      /**
       * Maximum position the slider handle can have
       *
       * @type {number}
       */
      this.maxPos = 0;

      /**
       * Precision
       *
       * @type {number}
       */
      this.precision = 0;

      /**
       * Step
       *
       * @type {number}
       */
      this.step = 1;

      /**
       * The name of the handle we are currently tracking
       *
       * @type {string}
       */
      this.tracking = '';

      /**
       * Minimum value (floor) of the model
       *
       * @type {number}
       */
      this.minValue = 0;

      /**
       * Maximum value (ceiling) of the model
       *
       * @type {number}
       */
      this.maxValue = 0;


      /**
       * The delta between min and max value
       *
       * @type {number}
       */
      this.valueRange = 0;


      /**
       * If showTicks/showTicksValues options are number.
       * In this case, ticks values should be displayed below the slider.
       * @type {boolean}
       */
      this.intermediateTicks = false;

      /**
       * Set to true if init method already executed
       *
       * @type {boolean}
       */
      this.initHasRun = false;

      /**
       * Used to call onStart on the first keydown event
       *
       * @type {boolean}
       */
      this.firstKeyDown = false;

      /**
       * Internal flag to prevent watchers to be called when the sliders value are modified internally.
       * @type {boolean}
       */
      this.internalChange = false;

      /**
       * Internal flag to keep track of the visibility of combo label
       * @type {boolean}
       */
      this.cmbLabelShown = false;

      /**
       * Internal variable to keep track of the focus element
       */
      this.currentFocusElement = null;

      // Slider DOM elements wrapped in jqLite
      this.fullBar = null; // The whole slider bar
      this.selBar = null; // Highlight between two handles
      this.minH = null; // Left slider handle
      this.maxH = null; // Right slider handle
      this.flrLab = null; // Floor label
      this.ceilLab = null; // Ceiling label
      this.minLab = null; // Label above the low value
      this.maxLab = null; // Label above the high value
      this.cmbLab = null; // Combined label
      this.ticks = null; // The ticks

      // Initialize slider
      this.init();
    };

    // Add instance methods
    Slider.prototype = {

      /**
       * Initialize slider
       *
       * @returns {undefined}
       */
      init: function() {
        var thrLow, thrHigh,
          self = this;

        var calcDimFn = function() {
          self.calcViewDimensions();
        };

        this.applyOptions();
        this.syncLowValue();
        if (this.range)
          this.syncHighValue();
        this.initElemHandles();
        this.manageElementsStyle();
        this.setDisabledState();
        this.calcViewDimensions();
        this.setMinAndMax();
        this.addAccessibility();
        this.updateCeilLab();
        this.updateFloorLab();
        this.initHandles();
        this.manageEventsBindings();

        // Recalculate slider view dimensions
        this.scope.$on('reCalcViewDimensions', calcDimFn);

        // Recalculate stuff if view port dimensions have changed
        angular.element($window).on('resize', calcDimFn);

        this.initHasRun = true;

        // Watch for changes to the model
        thrLow = rzThrottle(function() {
          self.onLowHandleChange();
        }, self.options.interval);

        thrHigh = rzThrottle(function() {
          self.onHighHandleChange();
        }, self.options.interval);

        this.scope.$on('rzSliderForceRender', function() {
          self.resetLabelsValue();
          thrLow();
          if (self.range) {
            thrHigh();
          }
          self.resetSlider();
        });

        // Watchers (order is important because in case of simultaneous change,
        // watchers will be called in the same order)
        this.scope.$watch('rzSliderOptions()', function(newValue, oldValue) {
          if (newValue === oldValue)
            return;
          self.applyOptions(); // need to be called before synchronizing the values
          self.syncLowValue();
          if (self.range)
            self.syncHighValue();
          self.resetSlider();
        }, true);

        this.scope.$watch('rzSliderModel', function(newValue, oldValue) {
          if (self.internalChange)
            return;
          if (newValue === oldValue)
            return;
          thrLow();
        });

        this.scope.$watch('rzSliderHigh', function(newValue, oldValue) {
          if (self.internalChange)
            return;
          if (newValue === oldValue)
            return;
          if (newValue != null)
            thrHigh();
          if (self.range && newValue == null || !self.range && newValue != null) {
            self.applyOptions();
            self.resetSlider();
          }
        });

        this.scope.$on('$destroy', function() {
          self.unbindEvents();
          angular.element($window).off('resize', calcDimFn);
          self.currentFocusElement = null;
        });
      },

      findStepIndex: function(modelValue) {
        var index = 0;
        for (var i = 0; i < this.options.stepsArray.length; i++) {
          var step = this.options.stepsArray[i];
          if (step === modelValue) {
            index = i;
            break;
          }
          else if (angular.isDate(step)) {
            if (step.getTime() === modelValue.getTime()) {
              index = i;
              break;
            }
          }
          else if (angular.isObject(step)) {
            if (angular.isDate(step.value) && step.value.getTime() === modelValue.getTime() || step.value === modelValue) {
              index = i;
              break;
            }
          }
        }
        return index;
      },

      syncLowValue: function() {
        if (this.options.stepsArray) {
          if (!this.options.bindIndexForStepsArray)
            this.lowValue = this.findStepIndex(this.scope.rzSliderModel);
          else
            this.lowValue = this.scope.rzSliderModel
        }
        else
          this.lowValue = this.scope.rzSliderModel;
      },

      syncHighValue: function() {
        if (this.options.stepsArray) {
          if (!this.options.bindIndexForStepsArray)
            this.highValue = this.findStepIndex(this.scope.rzSliderHigh);
          else
            this.highValue = this.scope.rzSliderHigh
        }
        else
          this.highValue = this.scope.rzSliderHigh;
      },

      getStepValue: function(sliderValue) {
        var step = this.options.stepsArray[sliderValue];
        if (angular.isDate(step))
          return step;
        if (angular.isObject(step))
          return step.value;
        return step;
      },

      applyLowValue: function() {
        if (this.options.stepsArray) {
          if (!this.options.bindIndexForStepsArray)
            this.scope.rzSliderModel = this.getStepValue(this.lowValue);
          else
            this.scope.rzSliderModel = this.lowValue
        }
        else
          this.scope.rzSliderModel = this.lowValue;
      },

      applyHighValue: function() {
        if (this.options.stepsArray) {
          if (!this.options.bindIndexForStepsArray)
            this.scope.rzSliderHigh = this.getStepValue(this.highValue);
          else
            this.scope.rzSliderHigh = this.highValue
        }
        else
          this.scope.rzSliderHigh = this.highValue;
      },

      /*
       * Reflow the slider when the low handle changes (called with throttle)
       */
      onLowHandleChange: function() {
        this.syncLowValue();
        if (this.range)
          this.syncHighValue();
        this.setMinAndMax();
        this.updateLowHandle(this.valueToPosition(this.lowValue));
        this.updateSelectionBar();
        this.updateTicksScale();
        this.updateAriaAttributes();
        if (this.range) {
          this.updateCmbLabel();
        }
      },

      /*
       * Reflow the slider when the high handle changes (called with throttle)
       */
      onHighHandleChange: function() {
        this.syncLowValue();
        this.syncHighValue();
        this.setMinAndMax();
        this.updateHighHandle(this.valueToPosition(this.highValue));
        this.updateSelectionBar();
        this.updateTicksScale();
        this.updateCmbLabel();
        this.updateAriaAttributes();
      },

      /**
       * Read the user options and apply them to the slider model
       */
      applyOptions: function() {
        var sliderOptions;
        if (this.scope.rzSliderOptions)
          sliderOptions = this.scope.rzSliderOptions();
        else
          sliderOptions = {};

        this.options = RzSliderOptions.getOptions(sliderOptions);

        if (this.options.step <= 0)
          this.options.step = 1;

        this.range = this.scope.rzSliderModel !== undefined && this.scope.rzSliderHigh !== undefined;
        this.options.draggableRange = this.range && this.options.draggableRange;
        this.options.draggableRangeOnly = this.range && this.options.draggableRangeOnly;
        if (this.options.draggableRangeOnly) {
          this.options.draggableRange = true;
        }

        this.options.showTicks = this.options.showTicks || this.options.showTicksValues || !!this.options.ticksArray;
        this.scope.showTicks = this.options.showTicks; //scope is used in the template
        if (angular.isNumber(this.options.showTicks) || this.options.ticksArray)
          this.intermediateTicks = true;

        this.options.showSelectionBar = this.options.showSelectionBar || this.options.showSelectionBarEnd
          || this.options.showSelectionBarFromValue !== null;

        if (this.options.stepsArray) {
          this.parseStepsArray();
        } else {
          if (this.options.translate)
            this.customTrFn = this.options.translate;
          else
            this.customTrFn = function(value) {
              return String(value);
            };

          this.getLegend = this.options.getLegend;
        }

        if (this.options.vertical) {
          this.positionProperty = 'bottom';
          this.dimensionProperty = 'height';
        }

        if (this.options.customTemplateScope)
          this.scope.custom = this.options.customTemplateScope;
      },

      parseStepsArray: function() {
        this.options.floor = 0;
        this.options.ceil = this.options.stepsArray.length - 1;
        this.options.step = 1;

        if (this.options.translate) {
          this.customTrFn = this.options.translate;
        }
        else {
          this.customTrFn = function(modelValue) {
            if (this.options.bindIndexForStepsArray)
              return this.getStepValue(modelValue);
            return modelValue;
          };
        }

        this.getLegend = function(index) {
          var step = this.options.stepsArray[index];
          if (angular.isObject(step))
            return step.legend;
          return null;
        };
      },

      /**
       * Resets slider
       *
       * @returns {undefined}
       */
      resetSlider: function() {
        this.manageElementsStyle();
        this.addAccessibility();
        this.setMinAndMax();
        this.updateCeilLab();
        this.updateFloorLab();
        this.unbindEvents();
        this.manageEventsBindings();
        this.setDisabledState();
        this.calcViewDimensions();
        this.refocusPointerIfNeeded();
      },

      refocusPointerIfNeeded: function() {
        if (this.currentFocusElement) {
          this.onPointerFocus(this.currentFocusElement.pointer, this.currentFocusElement.ref);
          this.focusElement(this.currentFocusElement.pointer)
        }
      },

      /**
       * Set the slider children to variables for easy access
       *
       * Run only once during initialization
       *
       * @returns {undefined}
       */
      initElemHandles: function() {
        // Assign all slider elements to object properties for easy access
        angular.forEach(this.sliderElem.children(), function(elem, index) {
          var jElem = angular.element(elem);

          switch (index) {
            case 0:
              this.fullBar = jElem;
              break;
            case 1:
              this.selBar = jElem;
              break;
            case 2:
              this.minH = jElem;
              break;
            case 3:
              this.maxH = jElem;
              break;
            case 4:
              this.flrLab = jElem;
              break;
            case 5:
              this.ceilLab = jElem;
              break;
            case 6:
              this.minLab = jElem;
              break;
            case 7:
              this.maxLab = jElem;
              break;
            case 8:
              this.cmbLab = jElem;
              break;
            case 9:
              this.ticks = jElem;
              break;
          }

        }, this);

        // Initialize position cache properties
        this.selBar.rzsp = 0;
        this.minH.rzsp = 0;
        this.maxH.rzsp = 0;
        this.flrLab.rzsp = 0;
        this.ceilLab.rzsp = 0;
        this.minLab.rzsp = 0;
        this.maxLab.rzsp = 0;
        this.cmbLab.rzsp = 0;
      },

      /**
       * Update each elements style based on options
       */
      manageElementsStyle: function() {

        if (!this.range)
          this.maxH.css('display', 'none');
        else
          this.maxH.css('display', '');


        this.alwaysHide(this.flrLab, this.options.showTicksValues || this.options.hideLimitLabels);
        this.alwaysHide(this.ceilLab, this.options.showTicksValues || this.options.hideLimitLabels);

        var hideLabelsForTicks = this.options.showTicksValues && !this.intermediateTicks;
        this.alwaysHide(this.minLab, hideLabelsForTicks || this.options.hidePointerLabels);
        this.alwaysHide(this.maxLab, hideLabelsForTicks || !this.range || this.options.hidePointerLabels);
        this.alwaysHide(this.cmbLab, hideLabelsForTicks || !this.range || this.options.hidePointerLabels);
        this.alwaysHide(this.selBar, !this.range && !this.options.showSelectionBar);

        if (this.options.vertical)
          this.sliderElem.addClass('rz-vertical');

        if (this.options.draggableRange)
          this.selBar.addClass('rz-draggable');
        else
          this.selBar.removeClass('rz-draggable');

        if (this.intermediateTicks && this.options.showTicksValues)
          this.ticks.addClass('rz-ticks-values-under');
      },

      alwaysHide: function(el, hide) {
        el.rzAlwaysHide = hide;
        if (hide)
          this.hideEl(el);
        else
          this.showEl(el)
      },

      /**
       * Manage the events bindings based on readOnly and disabled options
       *
       * @returns {undefined}
       */
      manageEventsBindings: function() {
        if (this.options.disabled || this.options.readOnly)
          this.unbindEvents();
        else
          this.bindEvents();
      },

      /**
       * Set the disabled state based on rzSliderDisabled
       *
       * @returns {undefined}
       */
      setDisabledState: function() {
        if (this.options.disabled) {
          this.sliderElem.attr('disabled', 'disabled');
        } else {
          this.sliderElem.attr('disabled', null);
        }
      },

      /**
       * Reset label values
       *
       * @return {undefined}
       */
      resetLabelsValue: function() {
        this.minLab.rzsv = undefined;
        this.maxLab.rzsv = undefined;
      },

      /**
       * Initialize slider handles positions and labels
       *
       * Run only once during initialization and every time view port changes size
       *
       * @returns {undefined}
       */
      initHandles: function() {
        this.updateLowHandle(this.valueToPosition(this.lowValue));

        /*
         the order here is important since the selection bar should be
         updated after the high handle but before the combined label
         */
        if (this.range)
          this.updateHighHandle(this.valueToPosition(this.highValue));
        this.updateSelectionBar();
        if (this.range)
          this.updateCmbLabel();

        this.updateTicksScale();
      },

      /**
       * Translate value to human readable format
       *
       * @param {number|string} value
       * @param {jqLite} label
       * @param {String} which
       * @param {boolean} [useCustomTr]
       * @returns {undefined}
       */
      translateFn: function(value, label, which, useCustomTr) {
        useCustomTr = useCustomTr === undefined ? true : useCustomTr;

        var valStr = '',
          getDimension = false,
          noLabelInjection = label.hasClass('no-label-injection');

        if (useCustomTr) {
          if (this.options.stepsArray && !this.options.bindIndexForStepsArray)
            value = this.getStepValue(value);
          valStr = String(this.customTrFn(value, this.options.id, which));
        }
        else {
          valStr = String(value)
        }

        if (label.rzsv === undefined || label.rzsv.length !== valStr.length || (label.rzsv.length > 0 && label.rzsd === 0)) {
          getDimension = true;
          label.rzsv = valStr;
        }

        if (!noLabelInjection) {
          label.html(valStr);
        }
        ;

        this.scope[which + 'Label'] = valStr;

        // Update width only when length of the label have changed
        if (getDimension) {
          this.getDimension(label);
        }
      },

      /**
       * Set maximum and minimum values for the slider and ensure the model and high
       * value match these limits
       * @returns {undefined}
       */
      setMinAndMax: function() {

        this.step = +this.options.step;
        this.precision = +this.options.precision;

        this.minValue = this.options.floor;
        if (this.options.logScale && this.minValue === 0)
          throw Error("Can't use floor=0 with logarithmic scale");

        if (this.options.enforceStep) {
          this.lowValue = this.roundStep(this.lowValue);
          if (this.range)
            this.highValue = this.roundStep(this.highValue);
        }

        if (this.options.ceil != null)
          this.maxValue = this.options.ceil;
        else
          this.maxValue = this.options.ceil = this.range ? this.highValue : this.lowValue;

        if (this.options.enforceRange) {
          this.lowValue = this.sanitizeValue(this.lowValue);
          if (this.range)
            this.highValue = this.sanitizeValue(this.highValue);
        }

        this.applyLowValue();
        if (this.range)
          this.applyHighValue();

        this.valueRange = this.maxValue - this.minValue;
      },

      /**
       * Adds accessibility attributes
       *
       * Run only once during initialization
       *
       * @returns {undefined}
       */
      addAccessibility: function() {
        this.minH.attr('role', 'slider');
        this.updateAriaAttributes();
        if (this.options.keyboardSupport && !(this.options.readOnly || this.options.disabled))
          this.minH.attr('tabindex', '0');
        else
          this.minH.attr('tabindex', '');
        if (this.options.vertical)
          this.minH.attr('aria-orientation', 'vertical');

        if (this.range) {
          this.maxH.attr('role', 'slider');
          if (this.options.keyboardSupport && !(this.options.readOnly || this.options.disabled))
            this.maxH.attr('tabindex', '0');
          else
            this.maxH.attr('tabindex', '');
          if (this.options.vertical)
            this.maxH.attr('aria-orientation', 'vertical');
        }
      },

      /**
       * Updates aria attributes according to current values
       */
      updateAriaAttributes: function() {
        this.minH.attr({
          'aria-valuenow': this.scope.rzSliderModel,
          'aria-valuetext': this.customTrFn(this.scope.rzSliderModel, this.options.id, 'model'),
          'aria-valuemin': this.minValue,
          'aria-valuemax': this.maxValue
        });
        if (this.range) {
          this.maxH.attr({
            'aria-valuenow': this.scope.rzSliderHigh,
            'aria-valuetext': this.customTrFn(this.scope.rzSliderHigh, this.options.id, 'high'),
            'aria-valuemin': this.minValue,
            'aria-valuemax': this.maxValue
          });
        }
      },

      /**
       * Calculate dimensions that are dependent on view port size
       *
       * Run once during initialization and every time view port changes size.
       *
       * @returns {undefined}
       */
      calcViewDimensions: function() {
        var handleWidth = this.getDimension(this.minH);

        this.handleHalfDim = handleWidth / 2;
        this.barDimension = this.getDimension(this.fullBar);

        this.maxPos = this.barDimension - handleWidth;

        this.getDimension(this.sliderElem);
        this.sliderElem.rzsp = this.sliderElem[0].getBoundingClientRect()[this.positionProperty];

        if (this.initHasRun) {
          this.updateFloorLab();
          this.updateCeilLab();
          this.initHandles();
          var self = this;
          $timeout(function() {
            self.updateTicksScale();
          });
        }
      },

      /**
       * Update the ticks position
       *
       * @returns {undefined}
       */
      updateTicksScale: function() {
        if (!this.options.showTicks) return;

        var ticksArray = this.options.ticksArray || this.getTicksArray(),
          translate = this.options.vertical ? 'translateY' : 'translateX',
          self = this;

        if (this.options.rightToLeft)
          ticksArray.reverse();

        this.scope.ticks = ticksArray.map(function(value) {
          var position = self.valueToPosition(value);

          if (self.options.vertical)
            position = self.maxPos - position;

          var tick = {
            selected: self.isTickSelected(value),
            style: {
              transform: translate + '(' + Math.round(position) + 'px)'
            }
          };
          if (tick.selected && self.options.getSelectionBarColor) {
            tick.style['background-color'] = self.getSelectionBarColor();
          }
          if (!tick.selected && self.options.getTickColor) {
            tick.style['background-color'] = self.getTickColor(value);
          }
          if (self.options.ticksTooltip) {
            tick.tooltip = self.options.ticksTooltip(value);
            tick.tooltipPlacement = self.options.vertical ? 'right' : 'top';
          }
          if (self.options.showTicksValues) {
            tick.value = self.getDisplayValue(value, 'tick-value');
            if (self.options.ticksValuesTooltip) {
              tick.valueTooltip = self.options.ticksValuesTooltip(value);
              tick.valueTooltipPlacement = self.options.vertical ? 'right' : 'top';
            }
          }
          if (self.getLegend) {
            var legend = self.getLegend(value, self.options.id);
            if (legend)
              tick.legend = legend;
          }
          return tick;
        });
      },

      getTicksArray: function() {
        var step = this.step,
          ticksArray = [];
        if (this.intermediateTicks)
          step = this.options.showTicks;
        for (var value = this.minValue; value <= this.maxValue; value += step) {
          ticksArray.push(value);
        }
        return ticksArray;
      },

      isTickSelected: function(value) {
        if (!this.range) {
          if (this.options.showSelectionBarFromValue !== null) {
            var center = this.options.showSelectionBarFromValue;
            if (this.lowValue > center && value >= center && value <= this.lowValue)
              return true;
            else if (this.lowValue < center && value <= center && value >= this.lowValue)
              return true;
          }
          else if (this.options.showSelectionBarEnd) {
            if (value >= this.lowValue)
              return true;
          }
          else if (this.options.showSelectionBar && value <= this.lowValue)
            return true;
        }
        if (this.range && value >= this.lowValue && value <= this.highValue)
          return true;
        return false;
      },

      /**
       * Update position of the floor label
       *
       * @returns {undefined}
       */
      updateFloorLab: function() {
        this.translateFn(this.minValue, this.flrLab, 'floor');
        this.getDimension(this.flrLab);
        var position = this.options.rightToLeft ? this.barDimension - this.flrLab.rzsd : 0;
        this.setPosition(this.flrLab, position);
      },

      /**
       * Update position of the ceiling label
       *
       * @returns {undefined}
       */
      updateCeilLab: function() {
        this.translateFn(this.maxValue, this.ceilLab, 'ceil');
        this.getDimension(this.ceilLab);
        var position = this.options.rightToLeft ? 0 : this.barDimension - this.ceilLab.rzsd;
        this.setPosition(this.ceilLab, position);
      },

      /**
       * Update slider handles and label positions
       *
       * @param {string} which
       * @param {number} newPos
       */
      updateHandles: function(which, newPos) {
        if (which === 'lowValue')
          this.updateLowHandle(newPos);
        else
          this.updateHighHandle(newPos);

        this.updateSelectionBar();
        this.updateTicksScale();
        if (this.range)
          this.updateCmbLabel();
      },

      /**
       * Helper function to work out the position for handle labels depending on RTL or not
       *
       * @param {string} labelName maxLab or minLab
       * @param newPos
       *
       * @returns {number}
       */
      getHandleLabelPos: function(labelName, newPos) {
        var labelRzsd = this[labelName].rzsd,
          nearHandlePos = newPos - labelRzsd / 2 + this.handleHalfDim,
          endOfBarPos = this.barDimension - labelRzsd;

        if (!this.options.boundPointerLabels)
          return nearHandlePos;

        if (this.options.rightToLeft && labelName === 'minLab' || !this.options.rightToLeft && labelName === 'maxLab') {
          return Math.min(nearHandlePos, endOfBarPos);
        } else {
          return Math.min(Math.max(nearHandlePos, 0), endOfBarPos);
        }
      },

      /**
       * Update low slider handle position and label
       *
       * @param {number} newPos
       * @returns {undefined}
       */
      updateLowHandle: function(newPos) {
        this.setPosition(this.minH, newPos);
        this.translateFn(this.lowValue, this.minLab, 'model');
        this.setPosition(this.minLab, this.getHandleLabelPos('minLab', newPos));

        if (this.options.getPointerColor) {
          var pointercolor = this.getPointerColor('min');
          this.scope.minPointerStyle = {
            backgroundColor: pointercolor
          };
        }

        if (this.options.autoHideLimitLabels) {
          this.shFloorCeil();
        }
      },

      /**
       * Update high slider handle position and label
       *
       * @param {number} newPos
       * @returns {undefined}
       */
      updateHighHandle: function(newPos) {
        this.setPosition(this.maxH, newPos);
        this.translateFn(this.highValue, this.maxLab, 'high');
        this.setPosition(this.maxLab, this.getHandleLabelPos('maxLab', newPos));

        if (this.options.getPointerColor) {
          var pointercolor = this.getPointerColor('max');
          this.scope.maxPointerStyle = {
            backgroundColor: pointercolor
          };
        }
        if (this.options.autoHideLimitLabels) {
          this.shFloorCeil();
        }

      },

      /**
       * Show/hide floor/ceiling label
       *
       * @returns {undefined}
       */
      shFloorCeil: function() {
        // Show based only on hideLimitLabels if pointer labels are hidden
        if (this.options.hidePointerLabels) {
          return;
        }
        var flHidden = false,
          clHidden = false,
          isMinLabAtFloor = this.isLabelBelowFloorLab(this.minLab),
          isMinLabAtCeil = this.isLabelAboveCeilLab(this.minLab),
          isMaxLabAtCeil = this.isLabelAboveCeilLab(this.maxLab),
          isCmbLabAtFloor = this.isLabelBelowFloorLab(this.cmbLab),
          isCmbLabAtCeil =  this.isLabelAboveCeilLab(this.cmbLab);

        if (isMinLabAtFloor) {
          flHidden = true;
          this.hideEl(this.flrLab);
        } else {
          flHidden = false;
          this.showEl(this.flrLab);
        }

        if (isMinLabAtCeil) {
          clHidden = true;
          this.hideEl(this.ceilLab);
        } else {
          clHidden = false;
          this.showEl(this.ceilLab);
        }

        if (this.range) {
          var hideCeil = this.cmbLabelShown ? isCmbLabAtCeil : isMaxLabAtCeil;
          var hideFloor = this.cmbLabelShown ? isCmbLabAtFloor : isMinLabAtFloor;

          if (hideCeil) {
            this.hideEl(this.ceilLab);
          } else if (!clHidden) {
            this.showEl(this.ceilLab);
          }

          // Hide or show floor label
          if (hideFloor) {
            this.hideEl(this.flrLab);
          } else if (!flHidden) {
            this.showEl(this.flrLab);
          }
        }
      },

      isLabelBelowFloorLab: function(label) {
        var isRTL = this.options.rightToLeft,
          pos = label.rzsp,
          dim = label.rzsd,
          floorPos = this.flrLab.rzsp,
          floorDim = this.flrLab.rzsd;
        return isRTL ?
        pos + dim >= floorPos - 2 :
        pos <= floorPos + floorDim + 2;
      },

      isLabelAboveCeilLab: function(label) {
        var isRTL = this.options.rightToLeft,
          pos = label.rzsp,
          dim = label.rzsd,
          ceilPos = this.ceilLab.rzsp,
          ceilDim = this.ceilLab.rzsd;
        return isRTL ?
        pos <= ceilPos + ceilDim + 2 :
        pos + dim >= ceilPos - 2;
      },

      /**
       * Update slider selection bar, combined label and range label
       *
       * @returns {undefined}
       */
      updateSelectionBar: function() {
        var position = 0,
          dimension = 0,
          isSelectionBarFromRight = this.options.rightToLeft ? !this.options.showSelectionBarEnd : this.options.showSelectionBarEnd,
          positionForRange = this.options.rightToLeft ? this.maxH.rzsp + this.handleHalfDim : this.minH.rzsp + this.handleHalfDim;

        if (this.range) {
          dimension = Math.abs(this.maxH.rzsp - this.minH.rzsp);
          position = positionForRange;
        }
        else {
          if (this.options.showSelectionBarFromValue !== null) {
            var center = this.options.showSelectionBarFromValue,
              centerPosition = this.valueToPosition(center),
              isModelGreaterThanCenter = this.options.rightToLeft ? this.lowValue <= center : this.lowValue > center;
            if (isModelGreaterThanCenter) {
              dimension = this.minH.rzsp - centerPosition;
              position = centerPosition + this.handleHalfDim;
            }
            else {
              dimension = centerPosition - this.minH.rzsp;
              position = this.minH.rzsp + this.handleHalfDim;
            }
          }
          else if (isSelectionBarFromRight) {
            dimension = Math.abs(this.maxPos - this.minH.rzsp) + this.handleHalfDim;
            position = this.minH.rzsp + this.handleHalfDim;
          } else {
            dimension = Math.abs(this.maxH.rzsp - this.minH.rzsp) + this.handleHalfDim;
            position = 0;
          }
        }
        this.setDimension(this.selBar, dimension);
        this.setPosition(this.selBar, position);
        if (this.options.getSelectionBarColor) {
          var color = this.getSelectionBarColor();
          this.scope.barStyle = {
            backgroundColor: color
          };
        }
      },

      /**
       * Wrapper around the getSelectionBarColor of the user to pass to
       * correct parameters
       */
      getSelectionBarColor: function() {
        if (this.range)
          return this.options.getSelectionBarColor(this.scope.rzSliderModel, this.scope.rzSliderHigh);
        return this.options.getSelectionBarColor(this.scope.rzSliderModel);
      },

      /**
       * Wrapper around the getPointerColor of the user to pass to
       * correct parameters
       */
      getPointerColor: function(pointerType) {
        if (pointerType === 'max') {
          return this.options.getPointerColor(this.scope.rzSliderHigh, pointerType);
        }
        return this.options.getPointerColor(this.scope.rzSliderModel, pointerType);
      },

      /**
       * Wrapper around the getTickColor of the user to pass to
       * correct parameters
       */
      getTickColor: function(value) {
        return this.options.getTickColor(value);
      },

      /**
       * Update combined label position and value
       *
       * @returns {undefined}
       */
      updateCmbLabel: function() {
        var isLabelOverlap = null;
        if (this.options.rightToLeft) {
          isLabelOverlap = this.minLab.rzsp - this.minLab.rzsd - 10 <= this.maxLab.rzsp;
        } else {
          isLabelOverlap = this.minLab.rzsp + this.minLab.rzsd + 10 >= this.maxLab.rzsp;
        }

        if (isLabelOverlap) {
          var lowTr = this.getDisplayValue(this.lowValue, 'model'),
            highTr = this.getDisplayValue(this.highValue, 'high'),
            labelVal = '';
          if (this.options.mergeRangeLabelsIfSame && lowTr === highTr) {
            labelVal = lowTr;
          } else {
            labelVal = this.options.rightToLeft ? highTr + ' - ' + lowTr : lowTr + ' - ' + highTr;
          }

          this.translateFn(labelVal, this.cmbLab, 'cmb', false);
          var pos = this.options.boundPointerLabels ? Math.min(
            Math.max(
              this.selBar.rzsp + this.selBar.rzsd / 2 - this.cmbLab.rzsd / 2,
              0
            ),
            this.barDimension - this.cmbLab.rzsd
          ) : this.selBar.rzsp + this.selBar.rzsd / 2 - this.cmbLab.rzsd / 2;

          this.setPosition(this.cmbLab, pos);
          this.cmbLabelShown = true;
          this.hideEl(this.minLab);
          this.hideEl(this.maxLab);
          this.showEl(this.cmbLab);
        } else {
          this.cmbLabelShown = false;
          this.showEl(this.maxLab);
          this.showEl(this.minLab);
          this.hideEl(this.cmbLab);
        }
        if (this.options.autoHideLimitLabels) {
          this.shFloorCeil();
        }
      },

      /**
       * Return the translated value if a translate function is provided else the original value
       * @param value
       * @param which if it's min or max handle
       * @returns {*}
       */
      getDisplayValue: function(value, which) {
        if (this.options.stepsArray && !this.options.bindIndexForStepsArray) {
          value = this.getStepValue(value);
        }
        return this.customTrFn(value, this.options.id, which);
      },

      /**
       * Round value to step and precision based on minValue
       *
       * @param {number} value
       * @param {number} customStep a custom step to override the defined step
       * @returns {number}
       */
      roundStep: function(value, customStep) {
        var step = customStep ? customStep : this.step,
          steppedDifference = parseFloat((value - this.minValue) / step).toPrecision(12);
        steppedDifference = Math.round(+steppedDifference) * step;
        var newValue = (this.minValue + steppedDifference).toFixed(this.precision);
        return +newValue;
      },

      /**
       * Hide element
       *
       * @param element
       * @returns {jqLite} The jqLite wrapped DOM element
       */
      hideEl: function(element) {
        return element.css({
          visibility: 'hidden'
        });
      },

      /**
       * Show element
       *
       * @param element The jqLite wrapped DOM element
       * @returns {jqLite} The jqLite
       */
      showEl: function(element) {
        if (!!element.rzAlwaysHide) {
          return element;
        }

        return element.css({
          visibility: 'visible'
        });
      },

      /**
       * Set element left/top position depending on whether slider is horizontal or vertical
       *
       * @param {jqLite} elem The jqLite wrapped DOM element
       * @param {number} pos
       * @returns {number}
       */
      setPosition: function(elem, pos) {
        elem.rzsp = pos;
        var css = {};
        css[this.positionProperty] = Math.round(pos) + 'px';
        elem.css(css);
        return pos;
      },

      /**
       * Get element width/height depending on whether slider is horizontal or vertical
       *
       * @param {jqLite} elem The jqLite wrapped DOM element
       * @returns {number}
       */
      getDimension: function(elem) {
        var val = elem[0].getBoundingClientRect();
        if (this.options.vertical)
          elem.rzsd = (val.bottom - val.top) * this.options.scale;
        else
          elem.rzsd = (val.right - val.left) * this.options.scale;
        return elem.rzsd;
      },

      /**
       * Set element width/height depending on whether slider is horizontal or vertical
       *
       * @param {jqLite} elem  The jqLite wrapped DOM element
       * @param {number} dim
       * @returns {number}
       */
      setDimension: function(elem, dim) {
        elem.rzsd = dim;
        var css = {};
        css[this.dimensionProperty] = Math.round(dim) + 'px';
        elem.css(css);
        return dim;
      },

      /**
       * Returns a value that is within slider range
       *
       * @param {number} val
       * @returns {number}
       */
      sanitizeValue: function(val) {
        return Math.min(Math.max(val, this.minValue), this.maxValue);
      },

      /**
       * Translate value to pixel position
       *
       * @param {number} val
       * @returns {number}
       */
      valueToPosition: function(val) {
        var fn = this.linearValueToPosition;
        if (this.options.customValueToPosition)
          fn = this.options.customValueToPosition;
        else if (this.options.logScale)
          fn = this.logValueToPosition;

        val = this.sanitizeValue(val);
        var percent = fn(val, this.minValue, this.maxValue) || 0;
        if (this.options.rightToLeft)
          percent = 1 - percent;
        return percent * this.maxPos;
      },

      linearValueToPosition: function(val, minVal, maxVal) {
        var range = maxVal - minVal;
        return (val - minVal) / range;
      },

      logValueToPosition: function(val, minVal, maxVal) {
        val = Math.log(val);
        minVal = Math.log(minVal);
        maxVal = Math.log(maxVal);
        var range = maxVal - minVal;
        return (val - minVal) / range;
      },

      /**
       * Translate position to model value
       *
       * @param {number} position
       * @returns {number}
       */
      positionToValue: function(position) {
        var percent = position / this.maxPos;
        if (this.options.rightToLeft)
          percent = 1 - percent;
        var fn = this.linearPositionToValue;
        if (this.options.customPositionToValue)
          fn = this.options.customPositionToValue;
        else if (this.options.logScale)
          fn = this.logPositionToValue;
        return fn(percent, this.minValue, this.maxValue) || 0;
      },

      linearPositionToValue: function(percent, minVal, maxVal) {
        return percent * (maxVal - minVal) + minVal;
      },

      logPositionToValue: function(percent, minVal, maxVal) {
        minVal = Math.log(minVal);
        maxVal = Math.log(maxVal);
        var value = percent * (maxVal - minVal) + minVal;
        return Math.exp(value);
      },

      // Events
      /**
       * Get the X-coordinate or Y-coordinate of an event
       *
       * @param {Object} event  The event
       * @returns {number}
       */
      getEventXY: function(event) {
        /* http://stackoverflow.com/a/12336075/282882 */
        //noinspection JSLint
        var clientXY = this.options.vertical ? 'clientY' : 'clientX';
        if (event[clientXY] !== undefined) {
          return event[clientXY];
        }

        return event.originalEvent === undefined ?
          event.touches[0][clientXY] : event.originalEvent.touches[0][clientXY];
      },

      /**
       * Compute the event position depending on whether the slider is horizontal or vertical
       * @param event
       * @returns {number}
       */
      getEventPosition: function(event) {
        var sliderPos = this.sliderElem.rzsp,
          eventPos = 0;
        if (this.options.vertical)
          eventPos = -this.getEventXY(event) + sliderPos;
        else
          eventPos = this.getEventXY(event) - sliderPos;
        return eventPos * this.options.scale - this.handleHalfDim; // #346 handleHalfDim is already scaled
      },

      /**
       * Get event names for move and event end
       *
       * @param {Event}    event    The event
       *
       * @return {{moveEvent: string, endEvent: string}}
       */
      getEventNames: function(event) {
        var eventNames = {
          moveEvent: '',
          endEvent: ''
        };

        if (event.touches || (event.originalEvent !== undefined && event.originalEvent.touches)) {
          eventNames.moveEvent = 'touchmove';
          eventNames.endEvent = 'touchend';
        } else {
          eventNames.moveEvent = 'mousemove';
          eventNames.endEvent = 'mouseup';
        }

        return eventNames;
      },

      /**
       * Get the handle closest to an event.
       *
       * @param event {Event} The event
       * @returns {jqLite} The handle closest to the event.
       */
      getNearestHandle: function(event) {
        if (!this.range) {
          return this.minH;
        }
        var position = this.getEventPosition(event),
          distanceMin = Math.abs(position - this.minH.rzsp),
          distanceMax = Math.abs(position - this.maxH.rzsp);
        if (distanceMin < distanceMax)
          return this.minH;
        else if (distanceMin > distanceMax)
          return this.maxH;
        else if (!this.options.rightToLeft)
        //if event is at the same distance from min/max then if it's at left of minH, we return minH else maxH
          return position < this.minH.rzsp ? this.minH : this.maxH;
        else
        //reverse in rtl
          return position > this.minH.rzsp ? this.minH : this.maxH;
      },

      /**
       * Wrapper function to focus an angular element
       *
       * @param el {AngularElement} the element to focus
       */
      focusElement: function(el) {
        var DOM_ELEMENT = 0;
        el[DOM_ELEMENT].focus();
      },

      /**
       * Bind mouse and touch events to slider handles
       *
       * @returns {undefined}
       */
      bindEvents: function() {
        var barTracking, barStart, barMove;

        if (this.options.draggableRange) {
          barTracking = 'rzSliderDrag';
          barStart = this.onDragStart;
          barMove = this.onDragMove;
        } else {
          barTracking = 'lowValue';
          barStart = this.onStart;
          barMove = this.onMove;
        }

        if (!this.options.onlyBindHandles) {
          this.selBar.on('mousedown', angular.bind(this, barStart, null, barTracking));
          this.selBar.on('mousedown', angular.bind(this, barMove, this.selBar));
        }

        if (this.options.draggableRangeOnly) {
          this.minH.on('mousedown', angular.bind(this, barStart, null, barTracking));
          this.maxH.on('mousedown', angular.bind(this, barStart, null, barTracking));
        } else {
          this.minH.on('mousedown', angular.bind(this, this.onStart, this.minH, 'lowValue'));
          if (this.range) {
            this.maxH.on('mousedown', angular.bind(this, this.onStart, this.maxH, 'highValue'));
          }
          if (!this.options.onlyBindHandles) {
            this.fullBar.on('mousedown', angular.bind(this, this.onStart, null, null));
            this.fullBar.on('mousedown', angular.bind(this, this.onMove, this.fullBar));
            this.ticks.on('mousedown', angular.bind(this, this.onStart, null, null));
            this.ticks.on('mousedown', angular.bind(this, this.onTickClick, this.ticks));
          }
        }

        if (!this.options.onlyBindHandles) {
          this.selBar.on('touchstart', angular.bind(this, barStart, null, barTracking));
          this.selBar.on('touchstart', angular.bind(this, barMove, this.selBar));
        }
        if (this.options.draggableRangeOnly) {
          this.minH.on('touchstart', angular.bind(this, barStart, null, barTracking));
          this.maxH.on('touchstart', angular.bind(this, barStart, null, barTracking));
        } else {
          this.minH.on('touchstart', angular.bind(this, this.onStart, this.minH, 'lowValue'));
          if (this.range) {
            this.maxH.on('touchstart', angular.bind(this, this.onStart, this.maxH, 'highValue'));
          }
          if (!this.options.onlyBindHandles) {
            this.fullBar.on('touchstart', angular.bind(this, this.onStart, null, null));
            this.fullBar.on('touchstart', angular.bind(this, this.onMove, this.fullBar));
            this.ticks.on('touchstart', angular.bind(this, this.onStart, null, null));
            this.ticks.on('touchstart', angular.bind(this, this.onTickClick, this.ticks));
          }
        }

        if (this.options.keyboardSupport) {
          this.minH.on('focus', angular.bind(this, this.onPointerFocus, this.minH, 'lowValue'));
          if (this.range) {
            this.maxH.on('focus', angular.bind(this, this.onPointerFocus, this.maxH, 'highValue'));
          }
        }
      },

      /**
       * Unbind mouse and touch events to slider handles
       *
       * @returns {undefined}
       */
      unbindEvents: function() {
        this.minH.off();
        this.maxH.off();
        this.fullBar.off();
        this.selBar.off();
        this.ticks.off();
      },

      /**
       * onStart event handler
       *
       * @param {?Object} pointer The jqLite wrapped DOM element; if null, the closest handle is used
       * @param {?string} ref     The name of the handle being changed; if null, the closest handle's value is modified
       * @param {Event}   event   The event
       * @returns {undefined}
       */
      onStart: function(pointer, ref, event) {
        var ehMove, ehEnd,
          eventNames = this.getEventNames(event);

        event.stopPropagation();
        event.preventDefault();

        // We have to do this in case the HTML where the sliders are on
        // have been animated into view.
        this.calcViewDimensions();

        if (pointer) {
          this.tracking = ref;
        } else {
          pointer = this.getNearestHandle(event);
          this.tracking = pointer === this.minH ? 'lowValue' : 'highValue';
        }

        pointer.addClass('rz-active');

        if (this.options.keyboardSupport)
          this.focusElement(pointer);

        ehMove = angular.bind(this, this.dragging.active ? this.onDragMove : this.onMove, pointer);
        ehEnd = angular.bind(this, this.onEnd, ehMove);

        $document.on(eventNames.moveEvent, ehMove);
        $document.one(eventNames.endEvent, ehEnd);
        this.callOnStart();
      },

      /**
       * onMove event handler
       *
       * @param {jqLite} pointer
       * @param {Event}  event The event
       * @param {boolean}  fromTick if the event occured on a tick or not
       * @returns {undefined}
       */
      onMove: function(pointer, event, fromTick) {
        var newPos = this.getEventPosition(event),
          newValue,
          ceilValue = this.options.rightToLeft ? this.minValue : this.maxValue,
          flrValue = this.options.rightToLeft ? this.maxValue : this.minValue;

        if (newPos <= 0) {
          newValue = flrValue;
        } else if (newPos >= this.maxPos) {
          newValue = ceilValue;
        } else {
          newValue = this.positionToValue(newPos);
          if (fromTick && angular.isNumber(this.options.showTicks))
            newValue = this.roundStep(newValue, this.options.showTicks);
          else
            newValue = this.roundStep(newValue);
        }
        this.positionTrackingHandle(newValue);
      },

      /**
       * onEnd event handler
       *
       * @param {Event}    event    The event
       * @param {Function} ehMove   The the bound move event handler
       * @returns {undefined}
       */
      onEnd: function(ehMove, event) {
        var moveEventName = this.getEventNames(event).moveEvent;

        if (!this.options.keyboardSupport) {
          this.minH.removeClass('rz-active');
          this.maxH.removeClass('rz-active');
          this.tracking = '';
        }
        this.dragging.active = false;

        $document.off(moveEventName, ehMove);
        this.callOnEnd();
      },

      onTickClick: function(pointer, event) {
        this.onMove(pointer, event, true);
      },

      onPointerFocus: function(pointer, ref) {
        this.tracking = ref;
        pointer.one('blur', angular.bind(this, this.onPointerBlur, pointer));
        pointer.on('keydown', angular.bind(this, this.onKeyboardEvent));
        pointer.on('keyup', angular.bind(this, this.onKeyUp));
        this.firstKeyDown = true;
        pointer.addClass('rz-active');

        this.currentFocusElement = {
          pointer: pointer,
          ref: ref
        };
      },

      onKeyUp: function() {
        this.firstKeyDown = true;
        this.callOnEnd();
      },

      onPointerBlur: function(pointer) {
        pointer.off('keydown');
        pointer.off('keyup');
        this.tracking = '';
        pointer.removeClass('rz-active');
        this.currentFocusElement = null
      },

      /**
       * Key actions helper function
       *
       * @param {number} currentValue value of the slider
       *
       * @returns {?Object} action value mappings
       */
      getKeyActions: function(currentValue) {
        var increaseStep = currentValue + this.step,
          decreaseStep = currentValue - this.step,
          increasePage = currentValue + this.valueRange / 10,
          decreasePage = currentValue - this.valueRange / 10;

        //Left to right default actions
        var actions = {
          'UP': increaseStep,
          'DOWN': decreaseStep,
          'LEFT': decreaseStep,
          'RIGHT': increaseStep,
          'PAGEUP': increasePage,
          'PAGEDOWN': decreasePage,
          'HOME': this.minValue,
          'END': this.maxValue
        };
        //right to left means swapping right and left arrows
        if (this.options.rightToLeft) {
          actions.LEFT = increaseStep;
          actions.RIGHT = decreaseStep;
          // right to left and vertical means we also swap up and down
          if (this.options.vertical) {
            actions.UP = decreaseStep;
            actions.DOWN = increaseStep;
          }
        }
        return actions;
      },

      onKeyboardEvent: function(event) {
        var currentValue = this[this.tracking],
          keyCode = event.keyCode || event.which,
          keys = {
            38: 'UP',
            40: 'DOWN',
            37: 'LEFT',
            39: 'RIGHT',
            33: 'PAGEUP',
            34: 'PAGEDOWN',
            36: 'HOME',
            35: 'END'
          },
          actions = this.getKeyActions(currentValue),
          key = keys[keyCode],
          action = actions[key];
        if (action == null || this.tracking === '') return;
        event.preventDefault();

        if (this.firstKeyDown) {
          this.firstKeyDown = false;
          this.callOnStart();
        }

        var self = this;
        $timeout(function() {
          var newValue = self.roundStep(self.sanitizeValue(action));
          if (!self.options.draggableRangeOnly) {
            self.positionTrackingHandle(newValue);
          }
          else {
            var difference = self.highValue - self.lowValue,
              newMinValue, newMaxValue;
            if (self.tracking === 'lowValue') {
              newMinValue = newValue;
              newMaxValue = newValue + difference;
              if (newMaxValue > self.maxValue) {
                newMaxValue = self.maxValue;
                newMinValue = newMaxValue - difference;
              }
            } else {
              newMaxValue = newValue;
              newMinValue = newValue - difference;
              if (newMinValue < self.minValue) {
                newMinValue = self.minValue;
                newMaxValue = newMinValue + difference;
              }
            }
            self.positionTrackingBar(newMinValue, newMaxValue);
          }
        });
      },

      /**
       * onDragStart event handler
       *
       * Handles dragging of the middle bar.
       *
       * @param {Object} pointer The jqLite wrapped DOM element
       * @param {string} ref     One of the refLow, refHigh values
       * @param {Event}  event   The event
       * @returns {undefined}
       */
      onDragStart: function(pointer, ref, event) {
        var position = this.getEventPosition(event);
        this.dragging = {
          active: true,
          value: this.positionToValue(position),
          difference: this.highValue - this.lowValue,
          lowLimit: this.options.rightToLeft ? this.minH.rzsp - position : position - this.minH.rzsp,
          highLimit: this.options.rightToLeft ? position - this.maxH.rzsp : this.maxH.rzsp - position
        };

        this.onStart(pointer, ref, event);
      },

      /**
       * getValue helper function
       *
       * gets max or min value depending on whether the newPos is outOfBounds above or below the bar and rightToLeft
       *
       * @param {string} type 'max' || 'min' The value we are calculating
       * @param {number} newPos  The new position
       * @param {boolean} outOfBounds Is the new position above or below the max/min?
       * @param {boolean} isAbove Is the new position above the bar if out of bounds?
       *
       * @returns {number}
       */
      getValue: function(type, newPos, outOfBounds, isAbove) {
        var isRTL = this.options.rightToLeft,
          value = null;

        if (type === 'min') {
          if (outOfBounds) {
            if (isAbove) {
              value = isRTL ? this.minValue : this.maxValue - this.dragging.difference;
            } else {
              value = isRTL ? this.maxValue - this.dragging.difference : this.minValue;
            }
          } else {
            value = isRTL ? this.positionToValue(newPos + this.dragging.lowLimit) : this.positionToValue(newPos - this.dragging.lowLimit)
          }
        } else {
          if (outOfBounds) {
            if (isAbove) {
              value = isRTL ? this.minValue + this.dragging.difference : this.maxValue;
            } else {
              value = isRTL ? this.maxValue : this.minValue + this.dragging.difference;
            }
          } else {
            if (isRTL) {
              value = this.positionToValue(newPos + this.dragging.lowLimit) + this.dragging.difference
            } else {
              value = this.positionToValue(newPos - this.dragging.lowLimit) + this.dragging.difference;
            }
          }
        }
        return this.roundStep(value);
      },

      /**
       * onDragMove event handler
       *
       * Handles dragging of the middle bar.
       *
       * @param {jqLite} pointer
       * @param {Event}  event The event
       * @returns {undefined}
       */
      onDragMove: function(pointer, event) {
        var newPos = this.getEventPosition(event),
          newMinValue, newMaxValue,
          ceilLimit, flrLimit,
          isUnderFlrLimit, isOverCeilLimit,
          flrH, ceilH;

        if (this.options.rightToLeft) {
          ceilLimit = this.dragging.lowLimit;
          flrLimit = this.dragging.highLimit;
          flrH = this.maxH;
          ceilH = this.minH;
        } else {
          ceilLimit = this.dragging.highLimit;
          flrLimit = this.dragging.lowLimit;
          flrH = this.minH;
          ceilH = this.maxH;
        }
        isUnderFlrLimit = newPos <= flrLimit;
        isOverCeilLimit = newPos >= this.maxPos - ceilLimit;

        if (isUnderFlrLimit) {
          if (flrH.rzsp === 0)
            return;
          newMinValue = this.getValue('min', newPos, true, false);
          newMaxValue = this.getValue('max', newPos, true, false);
        } else if (isOverCeilLimit) {
          if (ceilH.rzsp === this.maxPos)
            return;
          newMaxValue = this.getValue('max', newPos, true, true);
          newMinValue = this.getValue('min', newPos, true, true);
        } else {
          newMinValue = this.getValue('min', newPos, false);
          newMaxValue = this.getValue('max', newPos, false);
        }
        this.positionTrackingBar(newMinValue, newMaxValue);
      },

      /**
       * Set the new value and position for the entire bar
       *
       * @param {number} newMinValue   the new minimum value
       * @param {number} newMaxValue   the new maximum value
       */
      positionTrackingBar: function(newMinValue, newMaxValue) {

        if (this.options.minLimit != null && newMinValue < this.options.minLimit) {
          newMinValue = this.options.minLimit;
          newMaxValue = newMinValue + this.dragging.difference;
        }
        if (this.options.maxLimit != null && newMaxValue > this.options.maxLimit) {
          newMaxValue = this.options.maxLimit;
          newMinValue = newMaxValue - this.dragging.difference;
        }

        this.lowValue = newMinValue;
        this.highValue = newMaxValue;
        this.applyLowValue();
        if (this.range)
          this.applyHighValue();
        this.applyModel();
        this.updateHandles('lowValue', this.valueToPosition(newMinValue));
        this.updateHandles('highValue', this.valueToPosition(newMaxValue));
      },

      /**
       * Set the new value and position to the current tracking handle
       *
       * @param {number} newValue new model value
       */
      positionTrackingHandle: function(newValue) {
        var valueChanged = false;

        newValue = this.applyMinMaxLimit(newValue);
        if (this.range) {
          if (this.options.pushRange) {
            newValue = this.applyPushRange(newValue);
            valueChanged = true;
          }
          else {
            if (this.options.noSwitching) {
              if (this.tracking === 'lowValue' && newValue > this.highValue)
                newValue = this.applyMinMaxRange(this.highValue);
              else if (this.tracking === 'highValue' && newValue < this.lowValue)
                newValue = this.applyMinMaxRange(this.lowValue);
            }
            newValue = this.applyMinMaxRange(newValue);
            /* This is to check if we need to switch the min and max handles */
            if (this.tracking === 'lowValue' && newValue > this.highValue) {
              this.lowValue = this.highValue;
              this.applyLowValue();
              this.updateHandles(this.tracking, this.maxH.rzsp);
              this.updateAriaAttributes();
              this.tracking = 'highValue';
              this.minH.removeClass('rz-active');
              this.maxH.addClass('rz-active');
              if (this.options.keyboardSupport)
                this.focusElement(this.maxH);
              valueChanged = true;
            }
            else if (this.tracking === 'highValue' && newValue < this.lowValue) {
              this.highValue = this.lowValue;
              this.applyHighValue();
              this.updateHandles(this.tracking, this.minH.rzsp);
              this.updateAriaAttributes();
              this.tracking = 'lowValue';
              this.maxH.removeClass('rz-active');
              this.minH.addClass('rz-active');
              if (this.options.keyboardSupport)
                this.focusElement(this.minH);
              valueChanged = true;
            }
          }
        }

        if (this[this.tracking] !== newValue) {
          this[this.tracking] = newValue;
          if (this.tracking === 'lowValue')
            this.applyLowValue();
          else
            this.applyHighValue();
          this.updateHandles(this.tracking, this.valueToPosition(newValue));
          this.updateAriaAttributes();
          valueChanged = true;
        }

        if (valueChanged)
          this.applyModel();
      },

      applyMinMaxLimit: function(newValue) {
        if (this.options.minLimit != null && newValue < this.options.minLimit)
          return this.options.minLimit;
        if (this.options.maxLimit != null && newValue > this.options.maxLimit)
          return this.options.maxLimit;
        return newValue;
      },

      applyMinMaxRange: function(newValue) {
        var oppositeValue = this.tracking === 'lowValue' ? this.highValue : this.lowValue,
          difference = Math.abs(newValue - oppositeValue);
        if (this.options.minRange != null) {
          if (difference < this.options.minRange) {
            if (this.tracking === 'lowValue')
              return this.highValue - this.options.minRange;
            else
              return this.lowValue + this.options.minRange;
          }
        }
        if (this.options.maxRange != null) {
          if (difference > this.options.maxRange) {
            if (this.tracking === 'lowValue')
              return this.highValue - this.options.maxRange;
            else
              return this.lowValue + this.options.maxRange;
          }
        }
        return newValue;
      },

      applyPushRange: function(newValue) {
        var difference = this.tracking === 'lowValue' ? this.highValue - newValue : newValue - this.lowValue,
          minRange = this.options.minRange !== null ? this.options.minRange : this.options.step,
          maxRange = this.options.maxRange;
        // if smaller than minRange
        if (difference < minRange) {
          if (this.tracking === 'lowValue') {
            this.highValue = Math.min(newValue + minRange, this.maxValue);
            newValue = this.highValue - minRange;
            this.applyHighValue();
            this.updateHandles('highValue', this.valueToPosition(this.highValue));
          }
          else {
            this.lowValue = Math.max(newValue - minRange, this.minValue);
            newValue = this.lowValue + minRange;
            this.applyLowValue();
            this.updateHandles('lowValue', this.valueToPosition(this.lowValue));
          }
          this.updateAriaAttributes();
        }
        // if greater than maxRange
        else if (maxRange !== null && difference > maxRange) {
          if (this.tracking === 'lowValue') {
            this.highValue = newValue + maxRange;
            this.applyHighValue();
            this.updateHandles('highValue', this.valueToPosition(this.highValue));
          }
          else {
            this.lowValue = newValue - maxRange;
            this.applyLowValue();
            this.updateHandles('lowValue', this.valueToPosition(this.lowValue));
          }
          this.updateAriaAttributes();
        }
        return newValue;
      },

      /**
       * Apply the model values using scope.$apply.
       * We wrap it with the internalChange flag to avoid the watchers to be called
       */
      applyModel: function() {
        this.internalChange = true;
        this.scope.$apply();
        this.callOnChange();
        this.internalChange = false;
      },

      /**
       * Call the onStart callback if defined
       * The callback call is wrapped in a $evalAsync to ensure that its result will be applied to the scope.
       *
       * @returns {undefined}
       */
      callOnStart: function() {
        if (this.options.onStart) {
          var self = this,
            pointerType = this.tracking === 'lowValue' ? 'min' : 'max';
          this.scope.$evalAsync(function() {
            self.options.onStart(self.options.id, self.scope.rzSliderModel, self.scope.rzSliderHigh, pointerType);
          });
        }
      },

      /**
       * Call the onChange callback if defined
       * The callback call is wrapped in a $evalAsync to ensure that its result will be applied to the scope.
       *
       * @returns {undefined}
       */
      callOnChange: function() {
        if (this.options.onChange) {
          var self = this,
            pointerType = this.tracking === 'lowValue' ? 'min' : 'max';
          this.scope.$evalAsync(function() {
            self.options.onChange(self.options.id, self.scope.rzSliderModel, self.scope.rzSliderHigh, pointerType);
          });
        }
      },

      /**
       * Call the onEnd callback if defined
       * The callback call is wrapped in a $evalAsync to ensure that its result will be applied to the scope.
       *
       * @returns {undefined}
       */
      callOnEnd: function() {
        if (this.options.onEnd) {
          var self = this,
            pointerType = this.tracking === 'lowValue' ? 'min' : 'max';
          this.scope.$evalAsync(function() {
            self.options.onEnd(self.options.id, self.scope.rzSliderModel, self.scope.rzSliderHigh, pointerType);
          });
        }
        this.scope.$emit('slideEnded');
      }
    };

    return Slider;
  }])

  .directive('rzslider', ['RzSlider', function(RzSlider) {
    'use strict';

    return {
      restrict: 'AE',
      replace: true,
      scope: {
        rzSliderModel: '=?',
        rzSliderHigh: '=?',
        rzSliderOptions: '&?',
        rzSliderTplUrl: '@'
      },

      /**
       * Return template URL
       *
       * @param {jqLite} elem
       * @param {Object} attrs
       * @return {string}
       */
      templateUrl: function(elem, attrs) {
        //noinspection JSUnresolvedVariable
        return attrs.rzSliderTplUrl || 'rzSliderTpl.html';
      },

      link: function(scope, elem) {
        scope.slider = new RzSlider(scope, elem); //attach on scope so we can test it
      }
    };
  }]);

  // IDE assist

  /**
   * @name ngScope
   *
   * @property {number} rzSliderModel
   * @property {number} rzSliderHigh
   * @property {Object} rzSliderOptions
   */

  /**
   * @name jqLite
   *
   * @property {number|undefined} rzsp rzslider label position position
   * @property {number|undefined} rzsd rzslider element dimension
   * @property {string|undefined} rzsv rzslider label value/text
   * @property {Function} css
   * @property {Function} text
   */

  /**
   * @name Event
   * @property {Array} touches
   * @property {Event} originalEvent
   */

  /**
   * @name ThrottleOptions
   *
   * @property {boolean} leading
   * @property {boolean} trailing
   */

  module.run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('rzSliderTpl.html',
    "<div class=rzslider><span class=rz-bar-wrapper><span class=rz-bar></span></span> <span class=rz-bar-wrapper><span class=\"rz-bar rz-selection\" ng-style=barStyle></span></span> <span class=\"rz-pointer rz-pointer-min\" ng-style=minPointerStyle></span> <span class=\"rz-pointer rz-pointer-max\" ng-style=maxPointerStyle></span> <span class=\"rz-bubble rz-limit rz-floor\"></span> <span class=\"rz-bubble rz-limit rz-ceil\"></span> <span class=rz-bubble></span> <span class=rz-bubble></span> <span class=rz-bubble></span><ul ng-show=showTicks class=rz-ticks><li ng-repeat=\"t in ticks track by $index\" class=rz-tick ng-class=\"{'rz-selected': t.selected}\" ng-style=t.style ng-attr-uib-tooltip=\"{{ t.tooltip }}\" ng-attr-tooltip-placement={{t.tooltipPlacement}} ng-attr-tooltip-append-to-body=\"{{ t.tooltip ? true : undefined}}\"><span ng-if=\"t.value != null\" class=rz-tick-value ng-attr-uib-tooltip=\"{{ t.valueTooltip }}\" ng-attr-tooltip-placement={{t.valueTooltipPlacement}}>{{ t.value }}</span> <span ng-if=\"t.legend != null\" class=rz-tick-legend>{{ t.legend }}</span></li></ul></div>"
  );

}]);

  return module.name
}));

/**
 * Mousetrap wrapper for AngularJS
 * @version v0.0.1 - 2013-12-30
 * @link https://github.com/mgonto/mgo-mousetrap
 * @author Martin Gontovnikas <martin@gon.to>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
angular.module('mgo-mousetrap', []).directive('wMousetrap', function () {
    return {
        restrict: 'A',
        controller: ['$scope', '$element', '$attrs',
                     function ($scope, $element, $attrs) {
            
            var mousetrap;

            $scope.$watch($attrs.wMousetrap, function(_mousetrap) {
                mousetrap = _mousetrap;

                for (var key in mousetrap) {
                    if (mousetrap.hasOwnProperty(key)) {
                        Mousetrap.unbind(key);
                        Mousetrap.bind(key, applyWrapper(mousetrap[key])); 
                    }
                }
            }, true);
            
            function applyWrapper(func) {
                return function(e) {
                    $scope.$apply(function() {
                        func(e);
                    });
                };
            }
            
            $element.bind('$destroy', function() {
                if (!mousetrap) return;

                for (var key in mousetrap) {
                    if (mousetrap.hasOwnProperty(key)) {
                        Mousetrap.unbind(key);
                    }
                }
            });

        }]
    }
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFuZ3VsYXItbG9jYWwtc3RvcmFnZS5qcyIsImFuZ3VsYXItbWFycXVlZS5qcyIsImFuZ3VsYXIteW91dHViZS1lbWJlZC5qcyIsImFwcC5qcyIsImJhc2UuanMiLCJtb3VzZXRyYXAuanMiLCJyenNsaWRlci5qcyIsIndNb3VzZXRyYXAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25pQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcmFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3o3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzd3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Im1pelVJLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBbiBBbmd1bGFyIG1vZHVsZSB0aGF0IGdpdmVzIHlvdSBhY2Nlc3MgdG8gdGhlIGJyb3dzZXJzIGxvY2FsIHN0b3JhZ2VcbiAqIEB2ZXJzaW9uIHYwLjUuMiAtIDIwMTYtMDktMjhcbiAqIEBsaW5rIGh0dHBzOi8vZ2l0aHViLmNvbS9ncmV2b3J5L2FuZ3VsYXItbG9jYWwtc3RvcmFnZVxuICogQGF1dGhvciBncmV2b3J5IDxncmVnQGdyZWdwaWtlLmNhPlxuICogQGxpY2Vuc2UgTUlUIExpY2Vuc2UsIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXG4gKi9cbihmdW5jdGlvbiAod2luZG93LCBhbmd1bGFyKSB7XG52YXIgaXNEZWZpbmVkID0gYW5ndWxhci5pc0RlZmluZWQsXG4gIGlzVW5kZWZpbmVkID0gYW5ndWxhci5pc1VuZGVmaW5lZCxcbiAgaXNOdW1iZXIgPSBhbmd1bGFyLmlzTnVtYmVyLFxuICBpc09iamVjdCA9IGFuZ3VsYXIuaXNPYmplY3QsXG4gIGlzQXJyYXkgPSBhbmd1bGFyLmlzQXJyYXksXG4gIGlzU3RyaW5nID0gYW5ndWxhci5pc1N0cmluZyxcbiAgZXh0ZW5kID0gYW5ndWxhci5leHRlbmQsXG4gIHRvSnNvbiA9IGFuZ3VsYXIudG9Kc29uO1xuXG5hbmd1bGFyXG4gIC5tb2R1bGUoJ0xvY2FsU3RvcmFnZU1vZHVsZScsIFtdKVxuICAucHJvdmlkZXIoJ2xvY2FsU3RvcmFnZVNlcnZpY2UnLCBmdW5jdGlvbigpIHtcbiAgICAvLyBZb3Ugc2hvdWxkIHNldCBhIHByZWZpeCB0byBhdm9pZCBvdmVyd3JpdGluZyBhbnkgbG9jYWwgc3RvcmFnZSB2YXJpYWJsZXMgZnJvbSB0aGUgcmVzdCBvZiB5b3VyIGFwcFxuICAgIC8vIGUuZy4gbG9jYWxTdG9yYWdlU2VydmljZVByb3ZpZGVyLnNldFByZWZpeCgneW91ckFwcE5hbWUnKTtcbiAgICAvLyBXaXRoIHByb3ZpZGVyIHlvdSBjYW4gdXNlIGNvbmZpZyBhcyB0aGlzOlxuICAgIC8vIG15QXBwLmNvbmZpZyhmdW5jdGlvbiAobG9jYWxTdG9yYWdlU2VydmljZVByb3ZpZGVyKSB7XG4gICAgLy8gICAgbG9jYWxTdG9yYWdlU2VydmljZVByb3ZpZGVyLnByZWZpeCA9ICd5b3VyQXBwTmFtZSc7XG4gICAgLy8gfSk7XG4gICAgdGhpcy5wcmVmaXggPSAnbHMnO1xuXG4gICAgLy8gWW91IGNvdWxkIGNoYW5nZSB3ZWIgc3RvcmFnZSB0eXBlIGxvY2Fsc3RvcmFnZSBvciBzZXNzaW9uU3RvcmFnZVxuICAgIHRoaXMuc3RvcmFnZVR5cGUgPSAnbG9jYWxTdG9yYWdlJztcblxuICAgIC8vIENvb2tpZSBvcHRpb25zICh1c3VhbGx5IGluIGNhc2Ugb2YgZmFsbGJhY2spXG4gICAgLy8gZXhwaXJ5ID0gTnVtYmVyIG9mIGRheXMgYmVmb3JlIGNvb2tpZXMgZXhwaXJlIC8vIDAgPSBEb2VzIG5vdCBleHBpcmVcbiAgICAvLyBwYXRoID0gVGhlIHdlYiBwYXRoIHRoZSBjb29raWUgcmVwcmVzZW50c1xuICAgIC8vIHNlY3VyZSA9IFdldGhlciB0aGUgY29va2llcyBzaG91bGQgYmUgc2VjdXJlIChpLmUgb25seSBzZW50IG9uIEhUVFBTIHJlcXVlc3RzKVxuICAgIHRoaXMuY29va2llID0ge1xuICAgICAgZXhwaXJ5OiAzMCxcbiAgICAgIHBhdGg6ICcvJyxcbiAgICAgIHNlY3VyZTogZmFsc2VcbiAgICB9O1xuXG4gICAgLy8gRGVjaWRlcyB3ZXRoZXIgd2Ugc2hvdWxkIGRlZmF1bHQgdG8gY29va2llcyBpZiBsb2NhbHN0b3JhZ2UgaXMgbm90IHN1cHBvcnRlZC5cbiAgICB0aGlzLmRlZmF1bHRUb0Nvb2tpZSA9IHRydWU7XG5cbiAgICAvLyBTZW5kIHNpZ25hbHMgZm9yIGVhY2ggb2YgdGhlIGZvbGxvd2luZyBhY3Rpb25zP1xuICAgIHRoaXMubm90aWZ5ID0ge1xuICAgICAgc2V0SXRlbTogdHJ1ZSxcbiAgICAgIHJlbW92ZUl0ZW06IGZhbHNlXG4gICAgfTtcblxuICAgIC8vIFNldHRlciBmb3IgdGhlIHByZWZpeFxuICAgIHRoaXMuc2V0UHJlZml4ID0gZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgICB0aGlzLnByZWZpeCA9IHByZWZpeDtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvLyBTZXR0ZXIgZm9yIHRoZSBzdG9yYWdlVHlwZVxuICAgIHRoaXMuc2V0U3RvcmFnZVR5cGUgPSBmdW5jdGlvbihzdG9yYWdlVHlwZSkge1xuICAgICAgdGhpcy5zdG9yYWdlVHlwZSA9IHN0b3JhZ2VUeXBlO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICAvLyBTZXR0ZXIgZm9yIGRlZmF1bHRUb0Nvb2tpZSB2YWx1ZSwgZGVmYXVsdCBpcyB0cnVlLlxuICAgIHRoaXMuc2V0RGVmYXVsdFRvQ29va2llID0gZnVuY3Rpb24gKHNob3VsZERlZmF1bHQpIHtcbiAgICAgIHRoaXMuZGVmYXVsdFRvQ29va2llID0gISFzaG91bGREZWZhdWx0OyAvLyBEb3VibGUtbm90IHRvIG1ha2Ugc3VyZSBpdCdzIGEgYm9vbCB2YWx1ZS5cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgLy8gU2V0dGVyIGZvciBjb29raWUgY29uZmlnXG4gICAgdGhpcy5zZXRTdG9yYWdlQ29va2llID0gZnVuY3Rpb24oZXhwLCBwYXRoLCBzZWN1cmUpIHtcbiAgICAgIHRoaXMuY29va2llLmV4cGlyeSA9IGV4cDtcbiAgICAgIHRoaXMuY29va2llLnBhdGggPSBwYXRoO1xuICAgICAgdGhpcy5jb29raWUuc2VjdXJlID0gc2VjdXJlO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIC8vIFNldHRlciBmb3IgY29va2llIGRvbWFpblxuICAgIHRoaXMuc2V0U3RvcmFnZUNvb2tpZURvbWFpbiA9IGZ1bmN0aW9uKGRvbWFpbikge1xuICAgICAgdGhpcy5jb29raWUuZG9tYWluID0gZG9tYWluO1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIC8vIFNldHRlciBmb3Igbm90aWZpY2F0aW9uIGNvbmZpZ1xuICAgIC8vIGl0ZW1TZXQgJiBpdGVtUmVtb3ZlIHNob3VsZCBiZSBib29sZWFuc1xuICAgIHRoaXMuc2V0Tm90aWZ5ID0gZnVuY3Rpb24oaXRlbVNldCwgaXRlbVJlbW92ZSkge1xuICAgICAgdGhpcy5ub3RpZnkgPSB7XG4gICAgICAgIHNldEl0ZW06IGl0ZW1TZXQsXG4gICAgICAgIHJlbW92ZUl0ZW06IGl0ZW1SZW1vdmVcbiAgICAgIH07XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgdGhpcy4kZ2V0ID0gWyckcm9vdFNjb3BlJywgJyR3aW5kb3cnLCAnJGRvY3VtZW50JywgJyRwYXJzZScsJyR0aW1lb3V0JywgZnVuY3Rpb24oJHJvb3RTY29wZSwgJHdpbmRvdywgJGRvY3VtZW50LCAkcGFyc2UsICR0aW1lb3V0KSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB2YXIgcHJlZml4ID0gc2VsZi5wcmVmaXg7XG4gICAgICB2YXIgY29va2llID0gc2VsZi5jb29raWU7XG4gICAgICB2YXIgbm90aWZ5ID0gc2VsZi5ub3RpZnk7XG4gICAgICB2YXIgc3RvcmFnZVR5cGUgPSBzZWxmLnN0b3JhZ2VUeXBlO1xuICAgICAgdmFyIHdlYlN0b3JhZ2U7XG5cbiAgICAgIC8vIFdoZW4gQW5ndWxhcidzICRkb2N1bWVudCBpcyBub3QgYXZhaWxhYmxlXG4gICAgICBpZiAoISRkb2N1bWVudCkge1xuICAgICAgICAkZG9jdW1lbnQgPSBkb2N1bWVudDtcbiAgICAgIH0gZWxzZSBpZiAoJGRvY3VtZW50WzBdKSB7XG4gICAgICAgICRkb2N1bWVudCA9ICRkb2N1bWVudFswXTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhlcmUgaXMgYSBwcmVmaXggc2V0IGluIHRoZSBjb25maWcgbGV0cyB1c2UgdGhhdCB3aXRoIGFuIGFwcGVuZGVkIHBlcmlvZCBmb3IgcmVhZGFiaWxpdHlcbiAgICAgIGlmIChwcmVmaXguc3Vic3RyKC0xKSAhPT0gJy4nKSB7XG4gICAgICAgIHByZWZpeCA9ICEhcHJlZml4ID8gcHJlZml4ICsgJy4nIDogJyc7XG4gICAgICB9XG4gICAgICB2YXIgZGVyaXZlUXVhbGlmaWVkS2V5ID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgICAgIHJldHVybiBwcmVmaXggKyBrZXk7XG4gICAgICB9O1xuXG4gICAgICAvLyBSZW1vdmVzIHByZWZpeCBmcm9tIHRoZSBrZXkuXG4gICAgICB2YXIgdW5kZXJpdmVRdWFsaWZpZWRLZXkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiBrZXkucmVwbGFjZShuZXcgUmVnRXhwKCdeJyArIHByZWZpeCwgJ2cnKSwgJycpO1xuICAgICAgfTtcblxuICAgICAgLy8gQ2hlY2sgaWYgdGhlIGtleSBpcyB3aXRoaW4gb3VyIHByZWZpeCBuYW1lc3BhY2UuXG4gICAgICB2YXIgaXNLZXlQcmVmaXhPdXJzID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICByZXR1cm4ga2V5LmluZGV4T2YocHJlZml4KSA9PT0gMDtcbiAgICAgIH07XG5cbiAgICAgIC8vIENoZWNrcyB0aGUgYnJvd3NlciB0byBzZWUgaWYgbG9jYWwgc3RvcmFnZSBpcyBzdXBwb3J0ZWRcbiAgICAgIHZhciBjaGVja1N1cHBvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIHN1cHBvcnRlZCA9IChzdG9yYWdlVHlwZSBpbiAkd2luZG93ICYmICR3aW5kb3dbc3RvcmFnZVR5cGVdICE9PSBudWxsKTtcblxuICAgICAgICAgIC8vIFdoZW4gU2FmYXJpIChPUyBYIG9yIGlPUykgaXMgaW4gcHJpdmF0ZSBicm93c2luZyBtb2RlLCBpdCBhcHBlYXJzIGFzIHRob3VnaCBsb2NhbFN0b3JhZ2VcbiAgICAgICAgICAvLyBpcyBhdmFpbGFibGUsIGJ1dCB0cnlpbmcgdG8gY2FsbCAuc2V0SXRlbSB0aHJvd3MgYW4gZXhjZXB0aW9uLlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gXCJRVU9UQV9FWENFRURFRF9FUlI6IERPTSBFeGNlcHRpb24gMjI6IEFuIGF0dGVtcHQgd2FzIG1hZGUgdG8gYWRkIHNvbWV0aGluZyB0byBzdG9yYWdlXG4gICAgICAgICAgLy8gdGhhdCBleGNlZWRlZCB0aGUgcXVvdGEuXCJcbiAgICAgICAgICB2YXIga2V5ID0gZGVyaXZlUXVhbGlmaWVkS2V5KCdfXycgKyBNYXRoLnJvdW5kKE1hdGgucmFuZG9tKCkgKiAxZTcpKTtcbiAgICAgICAgICBpZiAoc3VwcG9ydGVkKSB7XG4gICAgICAgICAgICB3ZWJTdG9yYWdlID0gJHdpbmRvd1tzdG9yYWdlVHlwZV07XG4gICAgICAgICAgICB3ZWJTdG9yYWdlLnNldEl0ZW0oa2V5LCAnJyk7XG4gICAgICAgICAgICB3ZWJTdG9yYWdlLnJlbW92ZUl0ZW0oa2V5KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gc3VwcG9ydGVkO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gT25seSBjaGFuZ2Ugc3RvcmFnZVR5cGUgdG8gY29va2llcyBpZiBkZWZhdWx0aW5nIGlzIGVuYWJsZWQuXG4gICAgICAgICAgaWYgKHNlbGYuZGVmYXVsdFRvQ29va2llKVxuICAgICAgICAgICAgc3RvcmFnZVR5cGUgPSAnY29va2llJztcbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uZXJyb3InLCBlLm1lc3NhZ2UpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHZhciBicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UgPSBjaGVja1N1cHBvcnQoKTtcblxuICAgICAgLy8gRGlyZWN0bHkgYWRkcyBhIHZhbHVlIHRvIGxvY2FsIHN0b3JhZ2VcbiAgICAgIC8vIElmIGxvY2FsIHN0b3JhZ2UgaXMgbm90IGF2YWlsYWJsZSBpbiB0aGUgYnJvd3NlciB1c2UgY29va2llc1xuICAgICAgLy8gRXhhbXBsZSB1c2U6IGxvY2FsU3RvcmFnZVNlcnZpY2UuYWRkKCdsaWJyYXJ5JywnYW5ndWxhcicpO1xuICAgICAgdmFyIGFkZFRvTG9jYWxTdG9yYWdlID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIHR5cGUpIHtcbiAgICAgICAgc2V0U3RvcmFnZVR5cGUodHlwZSk7XG5cbiAgICAgICAgLy8gTGV0J3MgY29udmVydCB1bmRlZmluZWQgdmFsdWVzIHRvIG51bGwgdG8gZ2V0IHRoZSB2YWx1ZSBjb25zaXN0ZW50XG4gICAgICAgIGlmIChpc1VuZGVmaW5lZCh2YWx1ZSkpIHtcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsdWUgPSB0b0pzb24odmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgdGhpcyBicm93c2VyIGRvZXMgbm90IHN1cHBvcnQgbG9jYWwgc3RvcmFnZSB1c2UgY29va2llc1xuICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSAmJiBzZWxmLmRlZmF1bHRUb0Nvb2tpZSB8fCBzZWxmLnN0b3JhZ2VUeXBlID09PSAnY29va2llJykge1xuICAgICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24ud2FybmluZycsICdMT0NBTF9TVE9SQUdFX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobm90aWZ5LnNldEl0ZW0pIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5zZXRpdGVtJywge2tleToga2V5LCBuZXd2YWx1ZTogdmFsdWUsIHN0b3JhZ2VUeXBlOiAnY29va2llJ30pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYWRkVG9Db29raWVzKGtleSwgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBpZiAod2ViU3RvcmFnZSkge1xuICAgICAgICAgICAgd2ViU3RvcmFnZS5zZXRJdGVtKGRlcml2ZVF1YWxpZmllZEtleShrZXkpLCB2YWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChub3RpZnkuc2V0SXRlbSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLnNldGl0ZW0nLCB7a2V5OiBrZXksIG5ld3ZhbHVlOiB2YWx1ZSwgc3RvcmFnZVR5cGU6IHNlbGYuc3RvcmFnZVR5cGV9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uZXJyb3InLCBlLm1lc3NhZ2UpO1xuICAgICAgICAgIHJldHVybiBhZGRUb0Nvb2tpZXMoa2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9O1xuXG4gICAgICAvLyBEaXJlY3RseSBnZXQgYSB2YWx1ZSBmcm9tIGxvY2FsIHN0b3JhZ2VcbiAgICAgIC8vIEV4YW1wbGUgdXNlOiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmdldCgnbGlicmFyeScpOyAvLyByZXR1cm5zICdhbmd1bGFyJ1xuICAgICAgdmFyIGdldEZyb21Mb2NhbFN0b3JhZ2UgPSBmdW5jdGlvbiAoa2V5LCB0eXBlKSB7XG4gICAgICAgIHNldFN0b3JhZ2VUeXBlKHR5cGUpO1xuXG4gICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlICYmIHNlbGYuZGVmYXVsdFRvQ29va2llICB8fCBzZWxmLnN0b3JhZ2VUeXBlID09PSAnY29va2llJykge1xuICAgICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24ud2FybmluZycsICdMT0NBTF9TVE9SQUdFX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gZ2V0RnJvbUNvb2tpZXMoa2V5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpdGVtID0gd2ViU3RvcmFnZSA/IHdlYlN0b3JhZ2UuZ2V0SXRlbShkZXJpdmVRdWFsaWZpZWRLZXkoa2V5KSkgOiBudWxsO1xuICAgICAgICAvLyBhbmd1bGFyLnRvSnNvbiB3aWxsIGNvbnZlcnQgbnVsbCB0byAnbnVsbCcsIHNvIGEgcHJvcGVyIGNvbnZlcnNpb24gaXMgbmVlZGVkXG4gICAgICAgIC8vIEZJWE1FIG5vdCBhIHBlcmZlY3Qgc29sdXRpb24sIHNpbmNlIGEgdmFsaWQgJ251bGwnIHN0cmluZyBjYW4ndCBiZSBzdG9yZWRcbiAgICAgICAgaWYgKCFpdGVtIHx8IGl0ZW0gPT09ICdudWxsJykge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShpdGVtKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHJldHVybiBpdGVtO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBSZW1vdmUgYW4gaXRlbSBmcm9tIGxvY2FsIHN0b3JhZ2VcbiAgICAgIC8vIEV4YW1wbGUgdXNlOiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLnJlbW92ZSgnbGlicmFyeScpOyAvLyByZW1vdmVzIHRoZSBrZXkvdmFsdWUgcGFpciBvZiBsaWJyYXJ5PSdhbmd1bGFyJ1xuICAgICAgLy9cbiAgICAgIC8vIFRoaXMgaXMgdmFyLWFyZyByZW1vdmFsLCBjaGVjayB0aGUgbGFzdCBhcmd1bWVudCB0byBzZWUgaWYgaXQgaXMgYSBzdG9yYWdlVHlwZVxuICAgICAgLy8gYW5kIHNldCB0eXBlIGFjY29yZGluZ2x5IGJlZm9yZSByZW1vdmluZy5cbiAgICAgIC8vXG4gICAgICB2YXIgcmVtb3ZlRnJvbUxvY2FsU3RvcmFnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gY2FuJ3QgcG9wIG9uIGFyZ3VtZW50cywgc28gd2UgZG8gdGhpc1xuICAgICAgICB2YXIgY29uc3VtZWQgPSAwO1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSAxICYmXG4gICAgICAgICAgICAoYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXSA9PT0gJ2xvY2FsU3RvcmFnZScgfHxcbiAgICAgICAgICAgICBhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdID09PSAnc2Vzc2lvblN0b3JhZ2UnKSkge1xuICAgICAgICAgIGNvbnN1bWVkID0gMTtcbiAgICAgICAgICBzZXRTdG9yYWdlVHlwZShhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpLCBrZXk7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoIC0gY29uc3VtZWQ7IGkrKykge1xuICAgICAgICAgIGtleSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSAmJiBzZWxmLmRlZmF1bHRUb0Nvb2tpZSB8fCBzZWxmLnN0b3JhZ2VUeXBlID09PSAnY29va2llJykge1xuICAgICAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLndhcm5pbmcnLCAnTE9DQUxfU1RPUkFHRV9OT1RfU1VQUE9SVEVEJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChub3RpZnkucmVtb3ZlSXRlbSkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24ucmVtb3ZlaXRlbScsIHtrZXk6IGtleSwgc3RvcmFnZVR5cGU6ICdjb29raWUnfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZW1vdmVGcm9tQ29va2llcyhrZXkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHdlYlN0b3JhZ2UucmVtb3ZlSXRlbShkZXJpdmVRdWFsaWZpZWRLZXkoa2V5KSk7XG4gICAgICAgICAgICAgIGlmIChub3RpZnkucmVtb3ZlSXRlbSkge1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5yZW1vdmVpdGVtJywge1xuICAgICAgICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICAgICAgICBzdG9yYWdlVHlwZTogc2VsZi5zdG9yYWdlVHlwZVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsIGUubWVzc2FnZSk7XG4gICAgICAgICAgICAgIHJlbW92ZUZyb21Db29raWVzKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICAvLyBSZXR1cm4gYXJyYXkgb2Yga2V5cyBmb3IgbG9jYWwgc3RvcmFnZVxuICAgICAgLy8gRXhhbXBsZSB1c2U6IHZhciBrZXlzID0gbG9jYWxTdG9yYWdlU2VydmljZS5rZXlzKClcbiAgICAgIHZhciBnZXRLZXlzRm9yTG9jYWxTdG9yYWdlID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgc2V0U3RvcmFnZVR5cGUodHlwZSk7XG5cbiAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24ud2FybmluZycsICdMT0NBTF9TVE9SQUdFX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcHJlZml4TGVuZ3RoID0gcHJlZml4Lmxlbmd0aDtcbiAgICAgICAgdmFyIGtleXMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIHdlYlN0b3JhZ2UpIHtcbiAgICAgICAgICAvLyBPbmx5IHJldHVybiBrZXlzIHRoYXQgYXJlIGZvciB0aGlzIGFwcFxuICAgICAgICAgIGlmIChrZXkuc3Vic3RyKDAsIHByZWZpeExlbmd0aCkgPT09IHByZWZpeCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAga2V5cy5wdXNoKGtleS5zdWJzdHIocHJlZml4TGVuZ3RoKSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsIGUuRGVzY3JpcHRpb24pO1xuICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBrZXlzO1xuICAgICAgfTtcblxuICAgICAgLy8gUmVtb3ZlIGFsbCBkYXRhIGZvciB0aGlzIGFwcCBmcm9tIGxvY2FsIHN0b3JhZ2VcbiAgICAgIC8vIEFsc28gb3B0aW9uYWxseSB0YWtlcyBhIHJlZ3VsYXIgZXhwcmVzc2lvbiBzdHJpbmcgYW5kIHJlbW92ZXMgdGhlIG1hdGNoaW5nIGtleS12YWx1ZSBwYWlyc1xuICAgICAgLy8gRXhhbXBsZSB1c2U6IGxvY2FsU3RvcmFnZVNlcnZpY2UuY2xlYXJBbGwoKTtcbiAgICAgIC8vIFNob3VsZCBiZSB1c2VkIG1vc3RseSBmb3IgZGV2ZWxvcG1lbnQgcHVycG9zZXNcbiAgICAgIHZhciBjbGVhckFsbEZyb21Mb2NhbFN0b3JhZ2UgPSBmdW5jdGlvbiAocmVndWxhckV4cHJlc3Npb24sIHR5cGUpIHtcbiAgICAgICAgc2V0U3RvcmFnZVR5cGUodHlwZSk7XG5cbiAgICAgICAgLy8gU2V0dGluZyBib3RoIHJlZ3VsYXIgZXhwcmVzc2lvbnMgaW5kZXBlbmRlbnRseVxuICAgICAgICAvLyBFbXB0eSBzdHJpbmdzIHJlc3VsdCBpbiBjYXRjaGFsbCBSZWdFeHBcbiAgICAgICAgdmFyIHByZWZpeFJlZ2V4ID0gISFwcmVmaXggPyBuZXcgUmVnRXhwKCdeJyArIHByZWZpeCkgOiBuZXcgUmVnRXhwKCk7XG4gICAgICAgIHZhciB0ZXN0UmVnZXggPSAhIXJlZ3VsYXJFeHByZXNzaW9uID8gbmV3IFJlZ0V4cChyZWd1bGFyRXhwcmVzc2lvbikgOiBuZXcgUmVnRXhwKCk7XG5cbiAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UgJiYgc2VsZi5kZWZhdWx0VG9Db29raWUgIHx8IHNlbGYuc3RvcmFnZVR5cGUgPT09ICdjb29raWUnKSB7XG4gICAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi53YXJuaW5nJywgJ0xPQ0FMX1NUT1JBR0VfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gY2xlYXJBbGxGcm9tQ29va2llcygpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlICYmICFzZWxmLmRlZmF1bHRUb0Nvb2tpZSlcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHZhciBwcmVmaXhMZW5ndGggPSBwcmVmaXgubGVuZ3RoO1xuXG4gICAgICAgIGZvciAodmFyIGtleSBpbiB3ZWJTdG9yYWdlKSB7XG4gICAgICAgICAgLy8gT25seSByZW1vdmUgaXRlbXMgdGhhdCBhcmUgZm9yIHRoaXMgYXBwIGFuZCBtYXRjaCB0aGUgcmVndWxhciBleHByZXNzaW9uXG4gICAgICAgICAgaWYgKHByZWZpeFJlZ2V4LnRlc3Qoa2V5KSAmJiB0ZXN0UmVnZXgudGVzdChrZXkuc3Vic3RyKHByZWZpeExlbmd0aCkpKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICByZW1vdmVGcm9tTG9jYWxTdG9yYWdlKGtleS5zdWJzdHIocHJlZml4TGVuZ3RoKSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsIGUubWVzc2FnZSk7XG4gICAgICAgICAgICAgIHJldHVybiBjbGVhckFsbEZyb21Db29raWVzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfTtcblxuICAgICAgLy8gQ2hlY2tzIHRoZSBicm93c2VyIHRvIHNlZSBpZiBjb29raWVzIGFyZSBzdXBwb3J0ZWRcbiAgICAgIHZhciBicm93c2VyU3VwcG9ydHNDb29raWVzID0gKGZ1bmN0aW9uKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiAkd2luZG93Lm5hdmlnYXRvci5jb29raWVFbmFibGVkIHx8XG4gICAgICAgICAgKFwiY29va2llXCIgaW4gJGRvY3VtZW50ICYmICgkZG9jdW1lbnQuY29va2llLmxlbmd0aCA+IDAgfHxcbiAgICAgICAgICAgICgkZG9jdW1lbnQuY29va2llID0gXCJ0ZXN0XCIpLmluZGV4T2YuY2FsbCgkZG9jdW1lbnQuY29va2llLCBcInRlc3RcIikgPiAtMSkpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsIGUubWVzc2FnZSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9KCkpO1xuXG4gICAgICAgIC8vIERpcmVjdGx5IGFkZHMgYSB2YWx1ZSB0byBjb29raWVzXG4gICAgICAgIC8vIFR5cGljYWxseSB1c2VkIGFzIGEgZmFsbGJhY2sgaWYgbG9jYWwgc3RvcmFnZSBpcyBub3QgYXZhaWxhYmxlIGluIHRoZSBicm93c2VyXG4gICAgICAgIC8vIEV4YW1wbGUgdXNlOiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmNvb2tpZS5hZGQoJ2xpYnJhcnknLCdhbmd1bGFyJyk7XG4gICAgICAgIHZhciBhZGRUb0Nvb2tpZXMgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgZGF5c1RvRXhwaXJ5LCBzZWN1cmUpIHtcblxuICAgICAgICAgIGlmIChpc1VuZGVmaW5lZCh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9IGVsc2UgaWYoaXNBcnJheSh2YWx1ZSkgfHwgaXNPYmplY3QodmFsdWUpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHRvSnNvbih2YWx1ZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNDb29raWVzKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uZXJyb3InLCAnQ09PS0lFU19OT1RfU1VQUE9SVEVEJyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBleHBpcnkgPSAnJyxcbiAgICAgICAgICAgIGV4cGlyeURhdGUgPSBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgY29va2llRG9tYWluID0gJyc7XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAvLyBNYXJrIHRoYXQgdGhlIGNvb2tpZSBoYXMgZXhwaXJlZCBvbmUgZGF5IGFnb1xuICAgICAgICAgICAgICBleHBpcnlEYXRlLnNldFRpbWUoZXhwaXJ5RGF0ZS5nZXRUaW1lKCkgKyAoLTEgKiAyNCAqIDYwICogNjAgKiAxMDAwKSk7XG4gICAgICAgICAgICAgIGV4cGlyeSA9IFwiOyBleHBpcmVzPVwiICsgZXhwaXJ5RGF0ZS50b0dNVFN0cmluZygpO1xuICAgICAgICAgICAgICB2YWx1ZSA9ICcnO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc051bWJlcihkYXlzVG9FeHBpcnkpICYmIGRheXNUb0V4cGlyeSAhPT0gMCkge1xuICAgICAgICAgICAgICBleHBpcnlEYXRlLnNldFRpbWUoZXhwaXJ5RGF0ZS5nZXRUaW1lKCkgKyAoZGF5c1RvRXhwaXJ5ICogMjQgKiA2MCAqIDYwICogMTAwMCkpO1xuICAgICAgICAgICAgICBleHBpcnkgPSBcIjsgZXhwaXJlcz1cIiArIGV4cGlyeURhdGUudG9HTVRTdHJpbmcoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29va2llLmV4cGlyeSAhPT0gMCkge1xuICAgICAgICAgICAgICBleHBpcnlEYXRlLnNldFRpbWUoZXhwaXJ5RGF0ZS5nZXRUaW1lKCkgKyAoY29va2llLmV4cGlyeSAqIDI0ICogNjAgKiA2MCAqIDEwMDApKTtcbiAgICAgICAgICAgICAgZXhwaXJ5ID0gXCI7IGV4cGlyZXM9XCIgKyBleHBpcnlEYXRlLnRvR01UU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoISFrZXkpIHtcbiAgICAgICAgICAgICAgdmFyIGNvb2tpZVBhdGggPSBcIjsgcGF0aD1cIiArIGNvb2tpZS5wYXRoO1xuICAgICAgICAgICAgICBpZiAoY29va2llLmRvbWFpbikge1xuICAgICAgICAgICAgICAgIGNvb2tpZURvbWFpbiA9IFwiOyBkb21haW49XCIgKyBjb29raWUuZG9tYWluO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8qIFByb3ZpZGluZyB0aGUgc2VjdXJlIHBhcmFtZXRlciBhbHdheXMgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIGNvbmZpZ1xuICAgICAgICAgICAgICAgKiAoYWxsb3dzIGRldmVsb3BlciB0byBtaXggYW5kIG1hdGNoIHNlY3VyZSArIG5vbi1zZWN1cmUpICovXG4gICAgICAgICAgICAgIGlmICh0eXBlb2Ygc2VjdXJlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChzZWN1cmUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAvKiBXZSd2ZSBleHBsaWNpdGx5IHNwZWNpZmllZCBzZWN1cmUsXG4gICAgICAgICAgICAgICAgICAgICAgICogYWRkIHRoZSBzZWN1cmUgYXR0cmlidXRlIHRvIHRoZSBjb29raWUgKGFmdGVyIGRvbWFpbikgKi9cbiAgICAgICAgICAgICAgICAgICAgICBjb29raWVEb21haW4gKz0gXCI7IHNlY3VyZVwiO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgLy8gZWxzZSAtIHNlY3VyZSBoYXMgYmVlbiBzdXBwbGllZCBidXQgaXNuJ3QgdHJ1ZSAtIHNvIGRvbid0IHNldCBzZWN1cmUgZmxhZywgcmVnYXJkbGVzcyBvZiB3aGF0IGNvbmZpZyBzYXlzXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgZWxzZSBpZiAoY29va2llLnNlY3VyZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgLy8gc2VjdXJlIHBhcmFtZXRlciB3YXNuJ3Qgc3BlY2lmaWVkLCBnZXQgZGVmYXVsdCBmcm9tIGNvbmZpZ1xuICAgICAgICAgICAgICAgICAgY29va2llRG9tYWluICs9IFwiOyBzZWN1cmVcIjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAkZG9jdW1lbnQuY29va2llID0gZGVyaXZlUXVhbGlmaWVkS2V5KGtleSkgKyBcIj1cIiArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkgKyBleHBpcnkgKyBjb29raWVQYXRoICsgY29va2llRG9tYWluO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsIGUubWVzc2FnZSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIERpcmVjdGx5IGdldCBhIHZhbHVlIGZyb20gYSBjb29raWVcbiAgICAgICAgLy8gRXhhbXBsZSB1c2U6IGxvY2FsU3RvcmFnZVNlcnZpY2UuY29va2llLmdldCgnbGlicmFyeScpOyAvLyByZXR1cm5zICdhbmd1bGFyJ1xuICAgICAgICB2YXIgZ2V0RnJvbUNvb2tpZXMgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNDb29raWVzKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uZXJyb3InLCAnQ09PS0lFU19OT1RfU1VQUE9SVEVEJyk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIGNvb2tpZXMgPSAkZG9jdW1lbnQuY29va2llICYmICRkb2N1bWVudC5jb29raWUuc3BsaXQoJzsnKSB8fCBbXTtcbiAgICAgICAgICBmb3IodmFyIGk9MDsgaSA8IGNvb2tpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB0aGlzQ29va2llID0gY29va2llc1tpXTtcbiAgICAgICAgICAgIHdoaWxlICh0aGlzQ29va2llLmNoYXJBdCgwKSA9PT0gJyAnKSB7XG4gICAgICAgICAgICAgIHRoaXNDb29raWUgPSB0aGlzQ29va2llLnN1YnN0cmluZygxLHRoaXNDb29raWUubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzQ29va2llLmluZGV4T2YoZGVyaXZlUXVhbGlmaWVkS2V5KGtleSkgKyAnPScpID09PSAwKSB7XG4gICAgICAgICAgICAgIHZhciBzdG9yZWRWYWx1ZXMgPSBkZWNvZGVVUklDb21wb25lbnQodGhpc0Nvb2tpZS5zdWJzdHJpbmcocHJlZml4Lmxlbmd0aCArIGtleS5sZW5ndGggKyAxLCB0aGlzQ29va2llLmxlbmd0aCkpO1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHZhciBwYXJzZWRWYWx1ZSA9IEpTT04ucGFyc2Uoc3RvcmVkVmFsdWVzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHlwZW9mKHBhcnNlZFZhbHVlKSA9PT0gJ251bWJlcicgPyBzdG9yZWRWYWx1ZXMgOiBwYXJzZWRWYWx1ZTtcbiAgICAgICAgICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0b3JlZFZhbHVlcztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgcmVtb3ZlRnJvbUNvb2tpZXMgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgYWRkVG9Db29raWVzKGtleSxudWxsKTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgY2xlYXJBbGxGcm9tQ29va2llcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgdGhpc0Nvb2tpZSA9IG51bGw7XG4gICAgICAgICAgdmFyIHByZWZpeExlbmd0aCA9IHByZWZpeC5sZW5ndGg7XG4gICAgICAgICAgdmFyIGNvb2tpZXMgPSAkZG9jdW1lbnQuY29va2llLnNwbGl0KCc7Jyk7XG4gICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGNvb2tpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXNDb29raWUgPSBjb29raWVzW2ldO1xuXG4gICAgICAgICAgICB3aGlsZSAodGhpc0Nvb2tpZS5jaGFyQXQoMCkgPT09ICcgJykge1xuICAgICAgICAgICAgICB0aGlzQ29va2llID0gdGhpc0Nvb2tpZS5zdWJzdHJpbmcoMSwgdGhpc0Nvb2tpZS5sZW5ndGgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIga2V5ID0gdGhpc0Nvb2tpZS5zdWJzdHJpbmcocHJlZml4TGVuZ3RoLCB0aGlzQ29va2llLmluZGV4T2YoJz0nKSk7XG4gICAgICAgICAgICByZW1vdmVGcm9tQ29va2llcyhrZXkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgZ2V0U3RvcmFnZVR5cGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gc3RvcmFnZVR5cGU7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHNldFN0b3JhZ2VUeXBlID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgICAgIGlmICh0eXBlICYmIHN0b3JhZ2VUeXBlICE9PSB0eXBlKSB7XG4gICAgICAgICAgICBzdG9yYWdlVHlwZSA9IHR5cGU7XG4gICAgICAgICAgICBicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UgPSBjaGVja1N1cHBvcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGQgYSBsaXN0ZW5lciBvbiBzY29wZSB2YXJpYWJsZSB0byBzYXZlIGl0cyBjaGFuZ2VzIHRvIGxvY2FsIHN0b3JhZ2VcbiAgICAgICAgLy8gUmV0dXJuIGEgZnVuY3Rpb24gd2hpY2ggd2hlbiBjYWxsZWQgY2FuY2VscyBiaW5kaW5nXG4gICAgICAgIHZhciBiaW5kVG9TY29wZSA9IGZ1bmN0aW9uKHNjb3BlLCBrZXksIGRlZiwgbHNLZXksIHR5cGUpIHtcbiAgICAgICAgICBsc0tleSA9IGxzS2V5IHx8IGtleTtcbiAgICAgICAgICB2YXIgdmFsdWUgPSBnZXRGcm9tTG9jYWxTdG9yYWdlKGxzS2V5LCB0eXBlKTtcblxuICAgICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCAmJiBpc0RlZmluZWQoZGVmKSkge1xuICAgICAgICAgICAgdmFsdWUgPSBkZWY7XG4gICAgICAgICAgfSBlbHNlIGlmIChpc09iamVjdCh2YWx1ZSkgJiYgaXNPYmplY3QoZGVmKSkge1xuICAgICAgICAgICAgdmFsdWUgPSBleHRlbmQodmFsdWUsIGRlZik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgJHBhcnNlKGtleSkuYXNzaWduKHNjb3BlLCB2YWx1ZSk7XG5cbiAgICAgICAgICByZXR1cm4gc2NvcGUuJHdhdGNoKGtleSwgZnVuY3Rpb24obmV3VmFsKSB7XG4gICAgICAgICAgICBhZGRUb0xvY2FsU3RvcmFnZShsc0tleSwgbmV3VmFsLCB0eXBlKTtcbiAgICAgICAgICB9LCBpc09iamVjdChzY29wZVtrZXldKSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQWRkIGxpc3RlbmVyIHRvIGxvY2FsIHN0b3JhZ2UsIGZvciB1cGRhdGUgY2FsbGJhY2tzLlxuICAgICAgICBpZiAoYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlKSB7XG4gICAgICAgICAgICBpZiAoJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgICAgICAgICAgJHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwic3RvcmFnZVwiLCBoYW5kbGVTdG9yYWdlQ2hhbmdlQ2FsbGJhY2ssIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgJHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKFwic3RvcmFnZVwiLCBoYW5kbGVTdG9yYWdlQ2hhbmdlQ2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmKCR3aW5kb3cuYXR0YWNoRXZlbnQpe1xuICAgICAgICAgICAgICAgIC8vIGF0dGFjaEV2ZW50IGFuZCBkZXRhY2hFdmVudCBhcmUgcHJvcHJpZXRhcnkgdG8gSUUgdjYtMTBcbiAgICAgICAgICAgICAgICAkd2luZG93LmF0dGFjaEV2ZW50KFwib25zdG9yYWdlXCIsIGhhbmRsZVN0b3JhZ2VDaGFuZ2VDYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICR3aW5kb3cuZGV0YWNoRXZlbnQoXCJvbnN0b3JhZ2VcIiwgaGFuZGxlU3RvcmFnZUNoYW5nZUNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbGxiYWNrIGhhbmRsZXIgZm9yIHN0b3JhZ2UgY2hhbmdlZC5cbiAgICAgICAgZnVuY3Rpb24gaGFuZGxlU3RvcmFnZUNoYW5nZUNhbGxiYWNrKGUpIHtcbiAgICAgICAgICAgIGlmICghZSkgeyBlID0gJHdpbmRvdy5ldmVudDsgfVxuICAgICAgICAgICAgaWYgKG5vdGlmeS5zZXRJdGVtKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzU3RyaW5nKGUua2V5KSAmJiBpc0tleVByZWZpeE91cnMoZS5rZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBrZXkgPSB1bmRlcml2ZVF1YWxpZmllZEtleShlLmtleSk7XG4gICAgICAgICAgICAgICAgICAgIC8vIFVzZSB0aW1lb3V0LCB0byBhdm9pZCB1c2luZyAkcm9vdFNjb3BlLiRhcHBseS5cbiAgICAgICAgICAgICAgICAgICAgJHRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmNoYW5nZWQnLCB7IGtleToga2V5LCBuZXd2YWx1ZTogZS5uZXdWYWx1ZSwgc3RvcmFnZVR5cGU6IHNlbGYuc3RvcmFnZVR5cGUgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJldHVybiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmxlbmd0aFxuICAgICAgICAvLyBpZ25vcmUga2V5cyB0aGF0IG5vdCBvd25lZFxuICAgICAgICB2YXIgbGVuZ3RoT2ZMb2NhbFN0b3JhZ2UgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAgICAgc2V0U3RvcmFnZVR5cGUodHlwZSk7XG5cbiAgICAgICAgICB2YXIgY291bnQgPSAwO1xuICAgICAgICAgIHZhciBzdG9yYWdlID0gJHdpbmRvd1tzdG9yYWdlVHlwZV07XG4gICAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IHN0b3JhZ2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmKHN0b3JhZ2Uua2V5KGkpLmluZGV4T2YocHJlZml4KSA9PT0gMCApIHtcbiAgICAgICAgICAgICAgY291bnQrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGNvdW50O1xuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaXNTdXBwb3J0ZWQ6IGJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSxcbiAgICAgICAgICBnZXRTdG9yYWdlVHlwZTogZ2V0U3RvcmFnZVR5cGUsXG4gICAgICAgICAgc2V0U3RvcmFnZVR5cGU6IHNldFN0b3JhZ2VUeXBlLFxuICAgICAgICAgIHNldDogYWRkVG9Mb2NhbFN0b3JhZ2UsXG4gICAgICAgICAgYWRkOiBhZGRUb0xvY2FsU3RvcmFnZSwgLy9ERVBSRUNBVEVEXG4gICAgICAgICAgZ2V0OiBnZXRGcm9tTG9jYWxTdG9yYWdlLFxuICAgICAgICAgIGtleXM6IGdldEtleXNGb3JMb2NhbFN0b3JhZ2UsXG4gICAgICAgICAgcmVtb3ZlOiByZW1vdmVGcm9tTG9jYWxTdG9yYWdlLFxuICAgICAgICAgIGNsZWFyQWxsOiBjbGVhckFsbEZyb21Mb2NhbFN0b3JhZ2UsXG4gICAgICAgICAgYmluZDogYmluZFRvU2NvcGUsXG4gICAgICAgICAgZGVyaXZlS2V5OiBkZXJpdmVRdWFsaWZpZWRLZXksXG4gICAgICAgICAgdW5kZXJpdmVLZXk6IHVuZGVyaXZlUXVhbGlmaWVkS2V5LFxuICAgICAgICAgIGxlbmd0aDogbGVuZ3RoT2ZMb2NhbFN0b3JhZ2UsXG4gICAgICAgICAgZGVmYXVsdFRvQ29va2llOiB0aGlzLmRlZmF1bHRUb0Nvb2tpZSxcbiAgICAgICAgICBjb29raWU6IHtcbiAgICAgICAgICAgIGlzU3VwcG9ydGVkOiBicm93c2VyU3VwcG9ydHNDb29raWVzLFxuICAgICAgICAgICAgc2V0OiBhZGRUb0Nvb2tpZXMsXG4gICAgICAgICAgICBhZGQ6IGFkZFRvQ29va2llcywgLy9ERVBSRUNBVEVEXG4gICAgICAgICAgICBnZXQ6IGdldEZyb21Db29raWVzLFxuICAgICAgICAgICAgcmVtb3ZlOiByZW1vdmVGcm9tQ29va2llcyxcbiAgICAgICAgICAgIGNsZWFyQWxsOiBjbGVhckFsbEZyb21Db29raWVzXG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfV07XG4gIH0pO1xufSkod2luZG93LCB3aW5kb3cuYW5ndWxhcik7IiwiKGZ1bmN0aW9uKCkge1xuXHQndXNlIHN0cmljdCc7XG5cblx0YW5ndWxhclxuXHRcdC5tb2R1bGUoJ2FuZ3VsYXItbWFycXVlZScsIFtdKVxuXHRcdC5kaXJlY3RpdmUoJ2FuZ3VsYXJNYXJxdWVlJywgYW5ndWxhck1hcnF1ZWUpO1xuXG5cdGZ1bmN0aW9uIGFuZ3VsYXJNYXJxdWVlKCR0aW1lb3V0KSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3RyaWN0OiAnQScsXG5cdFx0XHRzY29wZTogdHJ1ZSxcblx0XHRcdGNvbXBpbGU6IGZ1bmN0aW9uKHRFbGVtZW50LCB0QXR0cnMpIHtcblx0XHRcdFx0aWYgKHRFbGVtZW50LmNoaWxkcmVuKCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0dEVsZW1lbnQuYXBwZW5kKCc8ZGl2PicgKyB0RWxlbWVudC50ZXh0KCkgKyAnPC9kaXY+Jyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIGNvbnRlbnQgPSB0RWxlbWVudC5jaGlsZHJlbigpO1xuICAgICAgXHR2YXIgJGVsZW1lbnQgPSAkKHRFbGVtZW50KTtcblx0XHRcdFx0JCh0RWxlbWVudCkuZW1wdHkoKTtcblx0XHRcdFx0dEVsZW1lbnQuYXBwZW5kKCc8ZGl2IGNsYXNzPVwiYW5ndWxhci1tYXJxdWVlXCIgc3R5bGU9XCJmbG9hdDpsZWZ0O1wiPicgKyBjb250ZW50LmNsb25lKClbMF0ub3V0ZXJIVE1MICsgJzwvZGl2PicpO1xuICAgICAgICB2YXIgJGl0ZW0gPSAkZWxlbWVudC5maW5kKCcuYW5ndWxhci1tYXJxdWVlJyk7XG4gICAgICAgICRpdGVtLmNsb25lKCkuY3NzKCdkaXNwbGF5Jywnbm9uZScpLmFwcGVuZFRvKCRlbGVtZW50KTtcblx0XHRcdFx0JGVsZW1lbnQud3JhcElubmVyKCc8ZGl2IHN0eWxlPVwid2lkdGg6MTAwMDAwcHhcIiBjbGFzcz1cImFuZ3VsYXItbWFycXVlZS13cmFwcGVyXCI+PC9kaXY+Jyk7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHBvc3Q6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuXHRcdFx0XHRcdFx0XHQvL2RpcmVjdGlvbiwgZHVyYXRpb24sXG5cdFx0XHRcdFx0XHRcdHZhciAkZWxlbWVudCA9ICQoZWxlbWVudCk7XG5cdFx0XHRcdFx0XHRcdHZhciAkaXRlbSA9ICRlbGVtZW50LmZpbmQoJy5hbmd1bGFyLW1hcnF1ZWU6Zmlyc3QnKTtcblx0XHRcdFx0XHRcdFx0dmFyICRtYXJxdWVlID0gJGVsZW1lbnQuZmluZCgnLmFuZ3VsYXItbWFycXVlZS13cmFwcGVyJyk7XG5cdFx0XHRcdFx0XHRcdHZhciAkY2xvbmVJdGVtID0gJGVsZW1lbnQuZmluZCgnLmFuZ3VsYXItbWFycXVlZTpsYXN0Jyk7XG5cdFx0XHRcdFx0XHRcdHZhciBkdXBsaWNhdGVkID0gZmFsc2U7XG5cblx0XHRcdFx0XHRcdFx0dmFyIGNvbnRhaW5lcldpZHRoID0gcGFyc2VJbnQoJGVsZW1lbnQud2lkdGgoKSk7XG5cdFx0XHRcdFx0XHRcdHZhciBpdGVtV2lkdGggPSBwYXJzZUludCgkaXRlbS53aWR0aCgpKTtcblx0XHRcdFx0XHRcdFx0dmFyIGRlZmF1bHRPZmZzZXQgPSAyMDtcblx0XHRcdFx0XHRcdFx0dmFyIGR1cmF0aW9uID0gMzAwMDtcblx0XHRcdFx0XHRcdFx0dmFyIHNjcm9sbCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHR2YXIgYW5pbWF0aW9uQ3NzTmFtZSA9ICcnO1xuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIGNhbGN1bGF0ZVdpZHRoQW5kSGVpZ2h0KCkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnRhaW5lcldpZHRoID0gcGFyc2VJbnQoJGVsZW1lbnQud2lkdGgoKSk7XG5cdFx0XHRcdFx0XHRcdFx0aXRlbVdpZHRoID0gcGFyc2VJbnQoJGl0ZW0ud2lkdGgoKSk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGl0ZW1XaWR0aCA+IGNvbnRhaW5lcldpZHRoKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkdXBsaWNhdGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZHVwbGljYXRlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdGlmIChkdXBsaWNhdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0JGNsb25lSXRlbS5zaG93KCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdCRjbG9uZUl0ZW0uaGlkZSgpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRcdCRlbGVtZW50LmhlaWdodCgkaXRlbS5oZWlnaHQoKSk7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBfb2JqVG9TdHJpbmcob2JqKSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIHRhYmpzb24gPSBbXTtcblx0XHRcdFx0XHRcdFx0XHRmb3IgKHZhciBwIGluIG9iaikge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRpZiAob2JqLmhhc093blByb3BlcnR5KHApKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR0YWJqc29uLnB1c2gocCArICc6JyArIG9ialtwXSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0dGFianNvbi5wdXNoKCk7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuICd7JyArIHRhYmpzb24uam9pbignLCcpICsgJ30nO1xuXHRcdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIGNhbGN1bGF0ZUFuaW1hdGlvbkR1cmF0aW9uKG5ld0R1cmF0aW9uKSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIHJlc3VsdCA9IChpdGVtV2lkdGggKyBjb250YWluZXJXaWR0aCkgLyBjb250YWluZXJXaWR0aCAqIG5ld0R1cmF0aW9uIC8gMTAwMDtcblx0XHRcdFx0XHRcdFx0XHRpZiAoZHVwbGljYXRlZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmVzdWx0ID0gcmVzdWx0IC8gMjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIGdldEFuaW1hdGlvblByZWZpeCgpIHtcblx0XHRcdFx0XHRcdFx0XHR2YXIgZWxtID0gZG9jdW1lbnQuYm9keSB8fCBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0XHRcdFx0XHR2YXIgZG9tUHJlZml4ZXMgPSBbJ3dlYmtpdCcsICdtb3onLCdPJywnbXMnLCdLaHRtbCddO1xuXG5cdFx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBkb21QcmVmaXhlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKGVsbS5zdHlsZVtkb21QcmVmaXhlc1tpXSArICdBbmltYXRpb25OYW1lJ10gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR2YXIgcHJlZml4ID0gZG9tUHJlZml4ZXNbaV0udG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHByZWZpeDtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBjcmVhdGVLZXlmcmFtZShudW1iZXIpIHtcblx0XHRcdFx0XHRcdFx0XHR2YXIgcHJlZml4ID0gZ2V0QW5pbWF0aW9uUHJlZml4KCk7XG5cblx0XHRcdFx0XHRcdFx0XHR2YXIgbWFyZ2luID0gaXRlbVdpZHRoO1xuXHRcdFx0XHRcdFx0XHRcdC8vIGlmIChkdXBsaWNhdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gXHRtYXJnaW4gPSBpdGVtV2lkdGhcblx0XHRcdFx0XHRcdFx0XHQvLyB9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdC8vIFx0bWFyZ2luID0gaXRlbVdpZHRoICsgY29udGFpbmVyV2lkdGg7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gfVxuXHRcdFx0XHRcdFx0XHRcdHZhciBrZXlmcmFtZVN0cmluZyA9ICdALScgKyBwcmVmaXggKyAnLWtleWZyYW1lcyAnICsgJ3NpbXBsZU1hcnF1ZWUnICsgbnVtYmVyO1xuXHRcdFx0XHRcdFx0XHRcdHZhciBjc3MgPSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQnbWFyZ2luLWxlZnQnOiAtIChtYXJnaW4pICsncHgnXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHZhciBrZXlmcmFtZUNzcyA9IGtleWZyYW1lU3RyaW5nICsgJ3sgMTAwJScgKyBfb2JqVG9TdHJpbmcoY3NzKSArICd9Jztcblx0XHRcdFx0XHRcdFx0XHR2YXIgJHN0eWxlcyA9ICQoJ3N0eWxlJyk7XG5cblx0XHRcdFx0XHRcdFx0XHQvL05vdyBhZGQgdGhlIGtleWZyYW1lIGFuaW1hdGlvbiB0byB0aGUgaGVhZFxuXHRcdFx0XHRcdFx0XHRcdGlmICgkc3R5bGVzLmxlbmd0aCAhPT0gMCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQvL0J1ZyBmaXhlZCBmb3IgalF1ZXJ5IDEuMy54IC0gSW5zdGVhZCBvZiB1c2luZyAubGFzdCgpLCB1c2UgZm9sbG93aW5nXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCRzdHlsZXMuZmlsdGVyKFwiOmxhc3RcIikuYXBwZW5kKGtleWZyYW1lQ3NzKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQkKCdoZWFkJykuYXBwZW5kKCc8c3R5bGU+JyArIGtleWZyYW1lQ3NzICsgJzwvc3R5bGU+Jyk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gc3RvcEFuaW1hdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHQkbWFycXVlZS5jc3MoJ21hcmdpbi1sZWZ0JywwKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYW5pbWF0aW9uQ3NzTmFtZSAhPSAnJykge1xuXHRcdFx0XHRcdFx0XHRcdFx0JG1hcnF1ZWUuY3NzKGFuaW1hdGlvbkNzc05hbWUsICcnKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0fVxuXG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gY3JlYXRlQW5pbWF0aW9uQ3NzKG51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRcdHZhciB0aW1lID0gY2FsY3VsYXRlQW5pbWF0aW9uRHVyYXRpb24oZHVyYXRpb24pO1xuXHRcdFx0XHRcdFx0XHRcdHZhciBwcmVmaXggPSBnZXRBbmltYXRpb25QcmVmaXgoKTtcblx0XHRcdFx0XHRcdFx0XHRhbmltYXRpb25Dc3NOYW1lID0gJy0nICsgcHJlZml4ICsnLWFuaW1hdGlvbic7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGNzc1ZhbHVlID0gJ3NpbXBsZU1hcnF1ZWUnICsgbnVtYmVyICsgJyAnICsgdGltZSArICdzIDBzIGxpbmVhciBpbmZpbml0ZSc7XG5cdFx0XHRcdFx0XHRcdFx0JG1hcnF1ZWUuY3NzKGFuaW1hdGlvbkNzc05hbWUsIGNzc1ZhbHVlKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoZHVwbGljYXRlZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0JG1hcnF1ZWUuY3NzKCdtYXJnaW4tbGVmdCcsIDApO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgbWFyZ2luID0gY29udGFpbmVyV2lkdGggKyBkZWZhdWx0T2Zmc2V0O1xuXHRcdFx0XHRcdFx0XHRcdFx0JG1hcnF1ZWUuY3NzKCdtYXJnaW4tbGVmdCcsIG1hcmdpbik7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gYW5pbWF0ZSgpIHtcblx0XHRcdFx0XHRcdFx0XHQvL2NyZWF0ZSBjc3Mgc3R5bGVcblx0XHRcdFx0XHRcdFx0XHQvL2NyZWF0ZSBrZXlmcmFtZVxuXHRcdFx0XHRcdFx0XHRcdGNhbGN1bGF0ZVdpZHRoQW5kSGVpZ2h0KCk7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIG51bWJlciA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDEwMDAwMDApO1xuXHRcdFx0XHRcdFx0XHRcdGNyZWF0ZUtleWZyYW1lKG51bWJlcik7XG5cdFx0XHRcdFx0XHRcdFx0Y3JlYXRlQW5pbWF0aW9uQ3NzKG51bWJlcik7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRzY29wZS4kd2F0Y2goYXR0cnMuc2Nyb2xsLCBmdW5jdGlvbihzY3JvbGxBdHRyVmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0XHRzY3JvbGwgPSBzY3JvbGxBdHRyVmFsdWU7XG5cdFx0XHRcdFx0XHRcdFx0cmVjYWxjdWxhdGVNYXJxdWVlKCk7XG5cdFx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIHJlY2FsY3VsYXRlTWFycXVlZSgpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoc2Nyb2xsKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRhbmltYXRlKCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHN0b3BBbmltYXRpb24oKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHR2YXIgdGltZXI7XG5cdFx0XHRcdFx0XHRcdHNjb3BlLiRvbigncmVjYWxjdWxhdGVNYXJxdWVlJywgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygncmVjZWl2ZSByZWNhbGN1bGF0ZU1hcnF1ZWUgZXZlbnQnKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAodGltZXIpIHtcblx0XHRcdFx0XHRcdFx0XHRcdCR0aW1lb3V0LmNhbmNlbCh0aW1lcik7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHRpbWVyID0gJHRpbWVvdXQoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZWNhbGN1bGF0ZU1hcnF1ZWUoKTtcblx0XHRcdFx0XHRcdFx0XHR9LCA1MDApO1xuXG5cdFx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRcdHNjb3BlLiR3YXRjaChhdHRycy5kdXJhdGlvbiwgZnVuY3Rpb24oZHVyYXRpb25UZXh0KSB7XG5cdFx0XHRcdFx0XHRcdFx0ZHVyYXRpb24gPSBwYXJzZUludChkdXJhdGlvblRleHQpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChzY3JvbGwpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGFuaW1hdGUoKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0fVxuXG59KSgpOyIsIi8qIGdsb2JhbCBZVCAqL1xuYW5ndWxhci5tb2R1bGUoJ3lvdXR1YmUtZW1iZWQnLCBbXSlcbi5zZXJ2aWNlICgneW91dHViZUVtYmVkVXRpbHMnLCBbJyR3aW5kb3cnLCAnJHJvb3RTY29wZScsIGZ1bmN0aW9uICgkd2luZG93LCAkcm9vdFNjb3BlKSB7XG4gICAgdmFyIFNlcnZpY2UgPSB7fVxuXG4gICAgLy8gYWRhcHRlZCBmcm9tIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzU4MzExOTEvMTYxNDk2N1xuICAgIHZhciB5b3V0dWJlUmVnZXhwID0gL2h0dHBzPzpcXC9cXC8oPzpbMC05QS1aLV0rXFwuKT8oPzp5b3V0dVxcLmJlXFwvfHlvdXR1YmUoPzotbm9jb29raWUpP1xcLmNvbVxcUypbXlxcd1xccy1dKShbXFx3LV17MTF9KSg/PVteXFx3LV18JCkoPyFbPz0mKyVcXHcuLV0qKD86WydcIl1bXjw+XSo+fDxcXC9hPikpWz89JislXFx3Li1dKi9pZztcbiAgICB2YXIgdGltZVJlZ2V4cCA9IC90PShcXGQrKVttc10/KFxcZCspP3M/LztcblxuICAgIGZ1bmN0aW9uIGNvbnRhaW5zKHN0ciwgc3Vic3RyKSB7XG4gICAgICAgIHJldHVybiAoc3RyLmluZGV4T2Yoc3Vic3RyKSA+IC0xKTtcbiAgICB9XG5cbiAgICBTZXJ2aWNlLmdldElkRnJvbVVSTCA9IGZ1bmN0aW9uIGdldElkRnJvbVVSTCh1cmwpIHtcbiAgICAgICAgdmFyIGlkID0gdXJsLnJlcGxhY2UoeW91dHViZVJlZ2V4cCwgJyQxJyk7XG5cbiAgICAgICAgaWYgKGNvbnRhaW5zKGlkLCAnOycpKSB7XG4gICAgICAgICAgICB2YXIgcGllY2VzID0gaWQuc3BsaXQoJzsnKTtcblxuICAgICAgICAgICAgaWYgKGNvbnRhaW5zKHBpZWNlc1sxXSwgJyUnKSkge1xuICAgICAgICAgICAgICAgIC8vIGxpbmtzIGxpa2UgdGhpczpcbiAgICAgICAgICAgICAgICAvLyBcImh0dHA6Ly93d3cueW91dHViZS5jb20vYXR0cmlidXRpb25fbGluaz9hPXB4YTZnb0hxemFBJmFtcDt1PSUyRndhdGNoJTNGdiUzRGRQZGd4MzB3OXNVJTI2ZmVhdHVyZSUzRHNoYXJlXCJcbiAgICAgICAgICAgICAgICAvLyBoYXZlIHRoZSByZWFsIHF1ZXJ5IHN0cmluZyBVUkkgZW5jb2RlZCBiZWhpbmQgYSAnOycuXG4gICAgICAgICAgICAgICAgLy8gYXQgdGhpcyBwb2ludCwgYGlkIGlzICdweGE2Z29IcXphQTt1PSUyRndhdGNoJTNGdiUzRGRQZGd4MzB3OXNVJTI2ZmVhdHVyZSUzRHNoYXJlJ1xuICAgICAgICAgICAgICAgIHZhciB1cmlDb21wb25lbnQgPSBkZWNvZGVVUklDb21wb25lbnQocGllY2VzWzFdKTtcbiAgICAgICAgICAgICAgICBpZCA9ICgnaHR0cDovL3lvdXR1YmUuY29tJyArIHVyaUNvbXBvbmVudClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKHlvdXR1YmVSZWdleHAsICckMScpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBodHRwczovL3d3dy55b3V0dWJlLmNvbS93YXRjaD92PVZiTkY5WDF3YVNjJmFtcDtmZWF0dXJlPXlvdXR1LmJlXG4gICAgICAgICAgICAgICAgLy8gYGlkYCBsb29rcyBsaWtlICdWYk5GOVgxd2FTYztmZWF0dXJlPXlvdXR1LmJlJyBjdXJyZW50bHkuXG4gICAgICAgICAgICAgICAgLy8gc3RyaXAgdGhlICc7ZmVhdHVyZT15b3V0dS5iZSdcbiAgICAgICAgICAgICAgICBpZCA9IHBpZWNlc1swXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChjb250YWlucyhpZCwgJyMnKSkge1xuICAgICAgICAgICAgLy8gaWQgbWlnaHQgbG9vayBsaWtlICc5M0x2VEtGX2pXMCN0PTEnXG4gICAgICAgICAgICAvLyBhbmQgd2Ugd2FudCAnOTNMdlRLRl9qVzAnXG4gICAgICAgICAgICBpZCA9IGlkLnNwbGl0KCcjJylbMF07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaWQ7XG4gICAgfTtcblxuICAgIFNlcnZpY2UuZ2V0VGltZUZyb21VUkwgPSBmdW5jdGlvbiBnZXRUaW1lRnJvbVVSTCh1cmwpIHtcbiAgICAgICAgdXJsID0gdXJsIHx8ICcnO1xuXG4gICAgICAgIC8vIHQ9NG0yMHNcbiAgICAgICAgLy8gcmV0dXJucyBbJ3Q9NG0yMHMnLCAnNCcsICcyMCddXG4gICAgICAgIC8vIHQ9NDZzXG4gICAgICAgIC8vIHJldHVybnMgWyd0PTQ2cycsICc0NiddXG4gICAgICAgIC8vIHQ9NDZcbiAgICAgICAgLy8gcmV0dXJucyBbJ3Q9NDYnLCAnNDYnXVxuICAgICAgICB2YXIgdGltZXMgPSB1cmwubWF0Y2godGltZVJlZ2V4cCk7XG5cbiAgICAgICAgaWYgKCF0aW1lcykge1xuICAgICAgICAgICAgLy8gemVybyBzZWNvbmRzXG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFzc3VtZSB0aGUgZmlyc3RcbiAgICAgICAgdmFyIGZ1bGwgPSB0aW1lc1swXSxcbiAgICAgICAgICAgIG1pbnV0ZXMgPSB0aW1lc1sxXSxcbiAgICAgICAgICAgIHNlY29uZHMgPSB0aW1lc1syXTtcblxuICAgICAgICAvLyB0PTRtMjBzXG4gICAgICAgIGlmICh0eXBlb2Ygc2Vjb25kcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHNlY29uZHMgPSBwYXJzZUludChzZWNvbmRzLCAxMCk7XG4gICAgICAgICAgICBtaW51dGVzID0gcGFyc2VJbnQobWludXRlcywgMTApO1xuXG4gICAgICAgIC8vIHQ9NG1cbiAgICAgICAgfSBlbHNlIGlmIChjb250YWlucyhmdWxsLCAnbScpKSB7XG4gICAgICAgICAgICBtaW51dGVzID0gcGFyc2VJbnQobWludXRlcywgMTApO1xuICAgICAgICAgICAgc2Vjb25kcyA9IDA7XG5cbiAgICAgICAgLy8gdD00c1xuICAgICAgICAvLyB0PTRcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlY29uZHMgPSBwYXJzZUludChtaW51dGVzLCAxMCk7XG4gICAgICAgICAgICBtaW51dGVzID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGluIHNlY29uZHNcbiAgICAgICAgcmV0dXJuIHNlY29uZHMgKyAobWludXRlcyAqIDYwKTtcbiAgICB9O1xuXG4gICAgU2VydmljZS5yZWFkeSA9IGZhbHNlO1xuXG4gICAgZnVuY3Rpb24gYXBwbHlTZXJ2aWNlSXNSZWFkeSgpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kYXBwbHkoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgU2VydmljZS5yZWFkeSA9IHRydWU7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvLyBJZiB0aGUgbGlicmFyeSBpc24ndCBoZXJlIGF0IGFsbCxcbiAgICBpZiAodHlwZW9mIFlUID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIC8vIC4uLmdyYWIgb24gdG8gZ2xvYmFsIGNhbGxiYWNrLCBpbiBjYXNlIGl0J3MgZXZlbnR1YWxseSBsb2FkZWRcbiAgICAgICAgJHdpbmRvdy5vbllvdVR1YmVJZnJhbWVBUElSZWFkeSA9IGFwcGx5U2VydmljZUlzUmVhZHk7XG4gICAgICAgIGNvbnNvbGUubG9nKCdVbmFibGUgdG8gZmluZCBZb3VUdWJlIGlmcmFtZSBsaWJyYXJ5IG9uIHRoaXMgcGFnZS4nKVxuICAgIH0gZWxzZSBpZiAoWVQubG9hZGVkKSB7XG4gICAgICAgIFNlcnZpY2UucmVhZHkgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIFlULnJlYWR5KGFwcGx5U2VydmljZUlzUmVhZHkpO1xuICAgIH1cblxuICAgIHJldHVybiBTZXJ2aWNlO1xufV0pXG4uZGlyZWN0aXZlKCd5b3V0dWJlVmlkZW8nLCBbJyR3aW5kb3cnLCAneW91dHViZUVtYmVkVXRpbHMnLCBmdW5jdGlvbiAoJHdpbmRvdywgeW91dHViZUVtYmVkVXRpbHMpIHtcbiAgICB2YXIgdW5pcUlkID0gMTtcblxuICAgIC8vIGZyb20gWVQuUGxheWVyU3RhdGVcbiAgICB2YXIgc3RhdGVOYW1lcyA9IHtcbiAgICAgICAgJy0xJzogJ3Vuc3RhcnRlZCcsXG4gICAgICAgIDA6ICdlbmRlZCcsXG4gICAgICAgIDE6ICdwbGF5aW5nJyxcbiAgICAgICAgMjogJ3BhdXNlZCcsXG4gICAgICAgIDM6ICdidWZmZXJpbmcnLFxuICAgICAgICA1OiAncXVldWVkJ1xuICAgIH07XG5cbiAgICB2YXIgZXZlbnRQcmVmaXggPSAneW91dHViZS5wbGF5ZXIuJztcblxuICAgICR3aW5kb3cuWVRDb25maWcgPSB7XG4gICAgICAgIGhvc3Q6ICdodHRwczovL3d3dy55b3V0dWJlLmNvbSdcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFQScsXG4gICAgICAgIHNjb3BlOiB7XG4gICAgICAgICAgICB2aWRlb0lkOiAnPT8nLFxuICAgICAgICAgICAgdmlkZW9Vcmw6ICc9PycsXG4gICAgICAgICAgICBwbGF5ZXI6ICc9PycsXG4gICAgICAgICAgICBwbGF5ZXJWYXJzOiAnPT8nLFxuICAgICAgICAgICAgcGxheWVySGVpZ2h0OiAnPT8nLFxuICAgICAgICAgICAgcGxheWVyV2lkdGg6ICc9PydcbiAgICAgICAgfSxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgICAgICAgLy8gYWxsb3dzIHVzIHRvICR3YXRjaCBgcmVhZHlgXG4gICAgICAgICAgICBzY29wZS51dGlscyA9IHlvdXR1YmVFbWJlZFV0aWxzO1xuXG4gICAgICAgICAgICAvLyBwbGF5ZXItaWQgYXR0ciA+IGlkIGF0dHIgPiBkaXJlY3RpdmUtZ2VuZXJhdGVkIElEXG4gICAgICAgICAgICB2YXIgcGxheWVySWQgPSBhdHRycy5wbGF5ZXJJZCB8fCBlbGVtZW50WzBdLmlkIHx8ICd1bmlxdWUteW91dHViZS1lbWJlZC1pZC0nICsgdW5pcUlkKys7XG4gICAgICAgICAgICBlbGVtZW50WzBdLmlkID0gcGxheWVySWQ7XG5cbiAgICAgICAgICAgIC8vIEF0dGFjaCB0byBlbGVtZW50XG4gICAgICAgICAgICBzY29wZS5wbGF5ZXJIZWlnaHQgPSBzY29wZS5wbGF5ZXJIZWlnaHQgfHwgMzkwO1xuICAgICAgICAgICAgc2NvcGUucGxheWVyV2lkdGggPSBzY29wZS5wbGF5ZXJXaWR0aCB8fCA2NDA7XG4gICAgICAgICAgICBzY29wZS5wbGF5ZXJWYXJzID0gc2NvcGUucGxheWVyVmFycyB8fCB7fTtcblxuICAgICAgICAgICAgLy8gWVQgY2FsbHMgY2FsbGJhY2tzIG91dHNpZGUgb2YgZGlnZXN0IGN5Y2xlXG4gICAgICAgICAgICBmdW5jdGlvbiBhcHBseUJyb2FkY2FzdCAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIHNjb3BlLiRhcHBseShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLiRlbWl0LmFwcGx5KHNjb3BlLCBhcmdzKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gb25QbGF5ZXJTdGF0ZUNoYW5nZSAoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICB2YXIgc3RhdGUgPSBzdGF0ZU5hbWVzW2V2ZW50LmRhdGFdO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RhdGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgIGFwcGx5QnJvYWRjYXN0KGV2ZW50UHJlZml4ICsgc3RhdGUsIHNjb3BlLnBsYXllciwgZXZlbnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzY29wZS4kYXBwbHkoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBzY29wZS5wbGF5ZXIuY3VycmVudFN0YXRlID0gc3RhdGU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uUGxheWVyUmVhZHkgKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgYXBwbHlCcm9hZGNhc3QoZXZlbnRQcmVmaXggKyAncmVhZHknLCBzY29wZS5wbGF5ZXIsIGV2ZW50KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gb25QbGF5ZXJFcnJvciAoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICBhcHBseUJyb2FkY2FzdChldmVudFByZWZpeCArICdlcnJvcicsIHNjb3BlLnBsYXllciwgZXZlbnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBjcmVhdGVQbGF5ZXIgKCkge1xuICAgICAgICAgICAgICAgIHZhciBwbGF5ZXJWYXJzID0gYW5ndWxhci5jb3B5KHNjb3BlLnBsYXllclZhcnMpO1xuICAgICAgICAgICAgICAgIHBsYXllclZhcnMuc3RhcnQgPSBwbGF5ZXJWYXJzLnN0YXJ0IHx8IHNjb3BlLnVybFN0YXJ0VGltZTtcbiAgICAgICAgICAgICAgICB2YXIgcGxheWVyID0gbmV3IFlULlBsYXllcihwbGF5ZXJJZCwge1xuICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IHNjb3BlLnBsYXllckhlaWdodCxcbiAgICAgICAgICAgICAgICAgICAgd2lkdGg6IHNjb3BlLnBsYXllcldpZHRoLFxuICAgICAgICAgICAgICAgICAgICB2aWRlb0lkOiBzY29wZS52aWRlb0lkLFxuICAgICAgICAgICAgICAgICAgICBwbGF5ZXJWYXJzOiBwbGF5ZXJWYXJzLFxuICAgICAgICAgICAgICAgICAgICBldmVudHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uUmVhZHk6IG9uUGxheWVyUmVhZHksXG4gICAgICAgICAgICAgICAgICAgICAgICBvblN0YXRlQ2hhbmdlOiBvblBsYXllclN0YXRlQ2hhbmdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgb25FcnJvcjogb25QbGF5ZXJFcnJvclxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBwbGF5ZXIuaWQgPSBwbGF5ZXJJZDtcbiAgICAgICAgICAgICAgICByZXR1cm4gcGxheWVyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBsb2FkUGxheWVyICgpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NvcGUudmlkZW9JZCB8fCBzY29wZS5wbGF5ZXJWYXJzLmxpc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjb3BlLnBsYXllciAmJiB0eXBlb2Ygc2NvcGUucGxheWVyLmRlc3Ryb3kgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLnBsYXllci5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBzY29wZS5wbGF5ZXIgPSBjcmVhdGVQbGF5ZXIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgc3RvcFdhdGNoaW5nUmVhZHkgPSBzY29wZS4kd2F0Y2goXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc2NvcGUudXRpbHMucmVhZHlcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdhaXQgdW50aWwgb25lIG9mIHRoZW0gaXMgZGVmaW5lZC4uLlxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgKHR5cGVvZiBzY29wZS52aWRlb1VybCAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8ICB0eXBlb2Ygc2NvcGUudmlkZW9JZCAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAgICAgICAgICAgICAgICAgIHx8ICB0eXBlb2Ygc2NvcGUucGxheWVyVmFycy5saXN0ICE9PSAndW5kZWZpbmVkJyk7XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBmdW5jdGlvbiAocmVhZHkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlYWR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdG9wV2F0Y2hpbmdSZWFkeSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBVUkwgdGFrZXMgZmlyc3QgcHJpb3JpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygc2NvcGUudmlkZW9VcmwgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUuJHdhdGNoKCd2aWRlb1VybCcsIGZ1bmN0aW9uICh1cmwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUudmlkZW9JZCA9IHNjb3BlLnV0aWxzLmdldElkRnJvbVVSTCh1cmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZS51cmxTdGFydFRpbWUgPSBzY29wZS51dGlscy5nZXRUaW1lRnJvbVVSTCh1cmwpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvYWRQbGF5ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlbiwgYSB2aWRlbyBJRFxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc2NvcGUudmlkZW9JZCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZS4kd2F0Y2goJ3ZpZGVvSWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLnVybFN0YXJ0VGltZSA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvYWRQbGF5ZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmluYWxseSwgYSBsaXN0XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLiR3YXRjaCgncGxheWVyVmFycy5saXN0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZS51cmxTdGFydFRpbWUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2FkUGxheWVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzY29wZS4kd2F0Y2hDb2xsZWN0aW9uKFsncGxheWVySGVpZ2h0JywgJ3BsYXllcldpZHRoJ10sIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmIChzY29wZS5wbGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUucGxheWVyLnNldFNpemUoc2NvcGUucGxheWVyV2lkdGgsIHNjb3BlLnBsYXllckhlaWdodCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUucGxheWVyICYmIHNjb3BlLnBsYXllci5kZXN0cm95KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG59XSk7XG4iLCJ2YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoXCJudHVBcHBcIiwgWydtZ28tbW91c2V0cmFwJywgJ0xvY2FsU3RvcmFnZU1vZHVsZScsICdhbmd1bGFyLW1hcnF1ZWUnLCAneW91dHViZS1lbWJlZCcsICdyek1vZHVsZSddKTtcblxuXG5hcHAuY29uZmlnKGZ1bmN0aW9uKGxvY2FsU3RvcmFnZVNlcnZpY2VQcm92aWRlcikge1xuICAgIGxvY2FsU3RvcmFnZVNlcnZpY2VQcm92aWRlclxuICAgICAgICAuc2V0UHJlZml4KCdOVFUtSUNBTi1QTEFZRVInKTtcbn0pO1xuXG5hcHAuZGlyZWN0aXZlKCdwcmVzc0VudGVyJywgZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgICBlbGVtZW50LmJpbmQoXCJrZXlkb3duIGtleXByZXNzXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQud2hpY2ggPT09IDEzKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBzY29wZS4kZXZhbChhdHRycy5wcmVzc0VudGVyKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG59KTtcbmFwcC5jb250cm9sbGVyKFwiTXVzaWNQbGF5ZXJDb250cm9sbGVyXCIsIGZ1bmN0aW9uKCRzY29wZSwgJHRpbWVvdXQsICRsb2NhdGlvbiwgJGh0dHAsIFBsYXllckZhY3RvcnksIGdvb2dsZVNlcnZpY2UsIGxvY2FsU3RvcmFnZVNlcnZpY2UpIHtcbiAgICAkc2NvcGUuc2VhcmNoaW5nID0gZmFsc2U7XG4gICAgJHNjb3BlLm11c2ljTGlzdHMgPSBbXTtcbiAgICAkc2NvcGUuc2VhcmNoUXVlcnkgPSBcIlwiO1xuICAgICRzY29wZS5jdXJyZW50WW91dHViZVZpZGVvID0gdW5kZWZpbmVkO1xuICAgICRzY29wZS5pc0Zhdm9yaXRlTW9kZSA9IGZhbHNlO1xuICAgICRzY29wZS5mYXZvcml0ZUxpc3RzID0gW107XG4gICAgJHNjb3BlLmxhYk1vZGUgPSBmYWxzZTtcblxuICAgIC8v5qiZ6aGM6LeR6aas54eIIE1hcnF1ZWVcbiAgICAkc2NvcGUuZHVyYXRpb24gPSAxMDAwMDtcblxuICAgIGZ1bmN0aW9uIGFkZE1hcnF1ZWUobXVzaWNMaXN0cykge1xuICAgICAgICBpZiAobXVzaWNMaXN0cy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgbXVzaWNMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uKG0sIGkpIHtcbiAgICAgICAgICAgICAgICBtLm1hcnF1ZWUgPSB7IHNjcm9sbDogZmFsc2UgfTtcblxuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy95b3V0dWJlXG4gICAgJHNjb3BlLnBsYXllclZhcnMgPSB7XG4gICAgICAgIGNvbnRyb2xzOiAwLFxuICAgICAgICBhdXRvcGxheTogMVxuICAgIH07XG5cblxuXG4gICAgLy8kc2NvcGUucHJpY2VTbGlkZXIgPSAxNTA7XG4gICAgJHNjb3BlLnNsaWRlciA9IHtcbiAgICAgICAgdmFsdWU6IDUwLFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICBpZDogJ250dS1pZCcsXG4gICAgICAgICAgICBmbG9vcjogMCxcbiAgICAgICAgICAgIGNlaWw6IDEwMCxcbiAgICAgICAgICAgIHNob3dTZWxlY3Rpb25CYXI6IHRydWUsXG4gICAgICAgICAgICBoaWRlUG9pbnRlckxhYmVsczogdHJ1ZSxcbiAgICAgICAgICAgIGhpZGVQb2ludGVyTGFiZWxzOiB0cnVlLFxuICAgICAgICAgICAgaGlkZUxpbWl0TGFiZWxzOiB0cnVlLFxuICAgICAgICAgICAgLy8gc2hvd1NlbGVjdGlvbkJhckZyb21WYWx1ZTogdHJ1ZSxcbiAgICAgICAgICAgIG9uQ2hhbmdlOiBmdW5jdGlvbihpZCwgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnb24gY2hhbmdlICcgKyB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgUGxheWVyRmFjdG9yeS5zZXRWb2x1bWUodmFsdWUpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cblxuICAgICRzY29wZS5pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICRzY29wZS5tdXNpY0xpc3RzID0gbG9hZFNlYXJjaCgpO1xuICAgICAgICB2YXIgZmF2b3JpdGVMaXN0cyA9IGxvYWRGYXZvcml0ZSgpO1xuICAgICAgICAkc2NvcGUuZmF2b3JpdGVMaXN0cyA9IGZhdm9yaXRlTGlzdHM7XG4gICAgICAgIGlmIChmYXZvcml0ZUxpc3RzKVxuICAgICAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMuZm9yRWFjaChmdW5jdGlvbihtLCBpKSB7XG4gICAgICAgICAgICAgICAgZmF2b3JpdGVMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uKGYsIGopIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG0uX2lkID09IGYuX2lkKSBtLmlzRmF2b3JpdGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIGFkZE1hcnF1ZWUoJHNjb3BlLm11c2ljTGlzdHMpO1xuXG5cblxuICAgICAgICBpZiAoJHNjb3BlLmxhYk1vZGUpIHtcbiAgICAgICAgICAgIC8v5a+m6amX5a6k5qih5byPXG4gICAgICAgICAgICAvL+iugOWPlumfs+mHj1xuICAgICAgICAgICAgUGxheWVyRmFjdG9yeS5sb2FkVm9sdW1lKHZhbHVlKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgICAgICAkc2NvcGUuc2xpZGVyLnZhbHVlID0gZGF0YTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgIH1cblxuXG4gICAgJHNjb3BlLnN3aXRjaExhYk1vZGUgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIldFTENPTUUgVE8gTlRVIElDQU4gTEFCIVwiKVxuICAgICAgICAkc2NvcGUubGFiTW9kZSA9ICEkc2NvcGUubGFiTW9kZTtcblxuICAgICAgICBpZiAoJHNjb3BlLmxhYk1vZGUpIHtcbiAgICAgICAgICAgIC8v5a+m6amX5a6k5qih5byPXG4gICAgICAgICAgICAvL+iugOWPlumfs+mHj1xuICAgICAgICAgICAgUGxheWVyRmFjdG9yeS5sb2FkVm9sdW1lKHZhbHVlKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgICAgICAgICAkc2NvcGUuc2xpZGVyLnZhbHVlID0gZGF0YTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAkc2NvcGUuc3dpdGNoRmF2b3JpdGUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJHNjb3BlLmlzRmF2b3JpdGVNb2RlID0gISRzY29wZS5pc0Zhdm9yaXRlTW9kZTtcbiAgICAgICAgaWYgKCRzY29wZS5pc0Zhdm9yaXRlTW9kZSkge1xuICAgICAgICAgICAgdmFyIGZhdm9yaXRlTGlzdHMgPSBsb2FkRmF2b3JpdGUoKTtcbiAgICAgICAgICAgICRzY29wZS5mYXZvcml0ZUxpc3RzID0gZmF2b3JpdGVMaXN0cztcbiAgICAgICAgICAgICRzY29wZS5tdXNpY0xpc3RzID0gZmF2b3JpdGVMaXN0cztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICRzY29wZS5pbml0KCk7XG4gICAgICAgIH1cblxuICAgIH1cblxuXG4gICAgJHNjb3BlLmxhYlBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIFBsYXllckZhY3RvcnkucGF1c2UoKS50aGVuKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAkc2NvcGUubGFiU3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBQbGF5ZXJGYWN0b3J5LnBsYXkoXCJcIikudGhlbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgJHNjb3BlLnNlYXJjaCA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG5cbiAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMgPSBbXTtcbiAgICAgICAgJHNjb3BlLnNlYXJjaGluZyA9IHRydWU7XG4gICAgICAgIGdvb2dsZVNlcnZpY2UuZ29vZ2xlQXBpQ2xpZW50UmVhZHkocXVlcnkpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuXG4gICAgICAgICAgICBpZiAoZGF0YS5pdGVtcykge1xuICAgICAgICAgICAgICAgIGRhdGEuaXRlbXMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpdGVtWydpZCddWyd2aWRlb0lkJ10pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtdXNpY0NhcmQgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC5faWQgPSBpdGVtWydpZCddWyd2aWRlb0lkJ107XG4gICAgICAgICAgICAgICAgICAgICAgICBtdXNpY0NhcmQudGl0bGUgPSBpdGVtWydzbmlwcGV0J11bJ3RpdGxlJ107XG4gICAgICAgICAgICAgICAgICAgICAgICBtdXNpY0NhcmQudXJsID0gXCJodHRwczovL3d3dy55b3V0dWJlLmNvbS9lbWJlZC9cIiArIG11c2ljQ2FyZC5faWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBtdXNpY0NhcmQuaW1hZ2UgPSBcImh0dHA6Ly9pbWcueW91dHViZS5jb20vdmkvXCIgKyBtdXNpY0NhcmQuX2lkICsgXCIvMC5qcGdcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC5kZXNjcmlwdGlvbiA9IGl0ZW1bJ3NuaXBwZXQnXVsnZGVzY3JpcHRpb24nXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC5pc1NlbGVjdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbXVzaWNDYXJkLmlzRmF2b3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICRzY29wZS5tdXNpY0xpc3RzLnB1c2gobXVzaWNDYXJkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYWxlcnQoXCLmkJzlsIvpjK/oqqRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAkc2NvcGUuc2VhcmNoaW5nID0gZmFsc2U7XG4gICAgICAgICAgICBzYXZlU2VhcmNoKCRzY29wZS5tdXNpY0xpc3RzKTtcbiAgICAgICAgICAgIGFkZE1hcnF1ZWUoJHNjb3BlLm11c2ljTGlzdHMpO1xuICAgICAgICB9KTtcblxuXG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBsb2FkU2VhcmNoKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIuiugOWPluS4iuasoeaQnOWwi+eLgOaFiy4uXCIpO1xuICAgICAgICBpZiAobG9jYWxTdG9yYWdlU2VydmljZS5pc1N1cHBvcnRlZCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldExvY2FsU3RvcmdlKCdOVFUtSUNBTi1QTEFZRVItU0VBUkNIJyk7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNhdmVTZWFyY2gobXVzaWNMaXN0cykge1xuXG4gICAgICAgIGlmIChsb2NhbFN0b3JhZ2VTZXJ2aWNlLmlzU3VwcG9ydGVkKSB7XG5cbiAgICAgICAgICAgIHNldExvY2FsU3RvcmdlKCdOVFUtSUNBTi1QTEFZRVItU0VBUkNIJywgbXVzaWNMaXN0cylcbiAgICAgICAgfVxuXG5cbiAgICB9XG5cblxuXG4gICAgJHNjb3BlLnBsYXlWaWRlbyA9IGZ1bmN0aW9uKGV2ZW50LCBtdXNpY0NhcmQpIHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGNvbnNvbGUubG9nKG11c2ljQ2FyZCk7XG4gICAgICAgIC8vIHBsYXlWaWRlb1NldHRpbmcobXVzaWNDYXJkKTtcblxuICAgICAgICBwbGF5VmlkZW9JblBsYXllcihtdXNpY0NhcmQuX2lkKTtcbiAgICB9XG5cbiAgICAvLyBmdW5jdGlvbiBwbGF5VmlkZW9TZXR0aW5nKG11c2ljQ2FyZCkge1xuICAgIC8vICAgICB2YXIgdG9nZ2xlID0gdHJ1ZTtcbiAgICAvLyAgICAgaWYgKG11c2ljQ2FyZC5pc1BsYXlpbmdWaWRlbyA9PSB0cnVlKVxuICAgIC8vICAgICAgICAgdG9nZ2xlID0gZmFsc2U7XG5cbiAgICAvLyAgICAgY2xlYW5Jc1BsYXlpbmcoKTtcbiAgICAvLyAgICAgbXVzaWNDYXJkLmlzU2VsZWN0ID0gdG9nZ2xlO1xuXG4gICAgLy8gfVxuXG4gICAgLy8gZnVuY3Rpb24gY2xlYW5Jc1BsYXlpbmcoKSB7XG4gICAgLy8gICAgICRzY29wZS5tdXNpY0xpc3RzLmZvckVhY2goZnVuY3Rpb24obXVzaWNDYXJkLCBpKSB7XG4gICAgLy8gICAgICAgICBtdXNpY0NhcmQuaXNQbGF5aW5nVmlkZW8gPSBmYWxzZTtcblxuICAgIC8vICAgICB9KTtcblxuICAgIC8vIH1cblxuICAgIGZ1bmN0aW9uIHBsYXlWaWRlb0luUGxheWVyKF9pZCkge1xuICAgICAgICAkc2NvcGUuY3VycmVudFlvdXR1YmVWaWRlbyA9IF9pZDtcblxuICAgIH1cblxuICAgICRzY29wZS5hZGRUb015RmF2b3JpdGUgPSBmdW5jdGlvbihldmVudCwgbXVzaWNDYXJkKSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBtdXNpY0NhcmQuaXNGYXZvcml0ZSA9ICFtdXNpY0NhcmQuaXNGYXZvcml0ZTtcblxuXG5cbiAgICAgICAgLy8gdmFyIGZhdm9yaXRlTGlzdHMgPSAkc2NvcGUubXVzaWNMaXN0cy5maWx0ZXIoZnVuY3Rpb24obSkge1xuICAgICAgICAvLyAgICAgaWYgKG0uaXNGYXZvcml0ZSlcbiAgICAgICAgLy8gICAgICAgICByZXR1cm4gbTtcbiAgICAgICAgLy8gICAgIGVsc2VcbiAgICAgICAgLy8gICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgLy8gfSk7XG4gICAgICAgIGlmIChtdXNpY0NhcmQuaXNGYXZvcml0ZSlcbiAgICAgICAgICAgICRzY29wZS5mYXZvcml0ZUxpc3RzLnB1c2gobXVzaWNDYXJkKTtcbiAgICAgICAgZWxzZSB7XG5cbiAgICAgICAgICAgIHZhciBpZHggPSAkc2NvcGUuZmF2b3JpdGVMaXN0cy5pbmRleE9mKG11c2ljQ2FyZCk7XG4gICAgICAgICAgICAkc2NvcGUuZmF2b3JpdGVMaXN0cy5zcGxpY2UoaWR4LCAxKTtcblxuICAgICAgICB9XG5cblxuXG4gICAgICAgIGFkZE1hcnF1ZWUoJHNjb3BlLmZhdm9yaXRlTGlzdHMpO1xuICAgICAgICBzYXZlRmF2b3JpdGUoJHNjb3BlLmZhdm9yaXRlTGlzdHMpO1xuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9hZEZhdm9yaXRlKCkge1xuICAgICAgICBpZiAobG9jYWxTdG9yYWdlU2VydmljZS5pc1N1cHBvcnRlZCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldExvY2FsU3RvcmdlKCdOVFUtSUNBTi1QTEFZRVItRkFWT1JJVEUnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNhdmVGYXZvcml0ZShtdXNpY0xpc3RzKSB7XG5cbiAgICAgICAgaWYgKGxvY2FsU3RvcmFnZVNlcnZpY2UuaXNTdXBwb3J0ZWQpIHtcblxuICAgICAgICAgICAgc2V0TG9jYWxTdG9yZ2UoJ05UVS1JQ0FOLVBMQVlFUi1GQVZPUklURScsIG11c2ljTGlzdHMpXG4gICAgICAgIH1cblxuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2V0TG9jYWxTdG9yZ2Uoa2V5LCB2YWwpIHtcbiAgICAgICAgcmV0dXJuIGxvY2FsU3RvcmFnZVNlcnZpY2Uuc2V0KGtleSwgdmFsKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRMb2NhbFN0b3JnZShrZXkpIHtcbiAgICAgICAgcmV0dXJuIGxvY2FsU3RvcmFnZVNlcnZpY2UuZ2V0KGtleSk7XG4gICAgfVxuXG5cbiAgICAkc2NvcGUuYWRkVG9QbGF5ZXJMaXN0ID0gZnVuY3Rpb24oZXZlbnQsIG11c2ljQ2FyZCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblxuXG5cbiAgICAgICAgLy8gY29uc29sZS5sb2cobXVzaWNDYXJkKTtcblxuICAgIH1cblxuXG5cbiAgICAkc2NvcGUuc2VsZWN0TXVzaWNDYXJkID0gZnVuY3Rpb24obXVzaWNDYXJkKSB7XG4gICAgICAgIHZhciB0b2dnbGUgPSB0cnVlO1xuICAgICAgICBpZiAobXVzaWNDYXJkLmlzU2VsZWN0ID09IHRydWUpXG4gICAgICAgICAgICB0b2dnbGUgPSBmYWxzZTtcblxuICAgICAgICBjbGVhblNlbGVjdGVkKCk7XG5cbiAgICAgICAgbXVzaWNDYXJkLmlzU2VsZWN0ID0gdG9nZ2xlO1xuXG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBzYXZlTXlGYXZvcml0ZSgpIHtcbiAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMuZm9yRWFjaChmdW5jdGlvbihtdXNpY0NhcmQsIGkpIHtcbiAgICAgICAgICAgIG11c2ljQ2FyZC5pc1NlbGVjdCA9IGZhbHNlO1xuXG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xlYW5TZWxlY3RlZCgpIHtcbiAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMuZm9yRWFjaChmdW5jdGlvbihtdXNpY0NhcmQsIGkpIHtcbiAgICAgICAgICAgIG11c2ljQ2FyZC5pc1NlbGVjdCA9IGZhbHNlO1xuXG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG59KTtcblxuYXBwLmZhY3RvcnkoJ1BsYXllckZhY3RvcnknLCBmdW5jdGlvbigkcSwgJGh0dHApIHtcblxuICAgIHZhciBfZmFjdG9yeSA9IHt9O1xuICAgIF9mYWN0b3J5LnBsYXkgPSBmdW5jdGlvbihpZCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KFwiaHR0cDovLzE0MC4xMTIuMjYuMjM2OjgwL211c2ljP2lkPVwiICsgaWQpO1xuICAgIH07XG4gICAgX2ZhY3RvcnkubG9hZFZvbHVtZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KFwiaHR0cDovLzE0MC4xMTIuMjYuMjM2OjgwL2dldF92b2x1bWVcIik7XG4gICAgfTtcbiAgICBfZmFjdG9yeS5zZXRWb2x1bWUgPSBmdW5jdGlvbihyYW5nZSkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KFwiaHR0cDovLzE0MC4xMTIuMjYuMjM2OjgwL3NldF92b2x1bWU/dm9sdW1lPVwiICsgcmFuZ2UpO1xuICAgIH07XG4gICAgX2ZhY3RvcnkucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldChcImh0dHA6Ly8xNDAuMTEyLjI2LjIzNjo4MC9wYXVzZV9hbmRfcGxheVwiKTtcbiAgICB9O1xuXG5cbiAgICAvLyBfZmFjdG9yeS5hY2NlcHRJbml2dGUgPSBmdW5jdGlvbihpbnZpdGVJZCkge1xuICAgIC8vICAgICByZXR1cm4gJGh0dHAucG9zdChcIi9hcGkvaW52aXRlL2FjY2VwdFwiLCB7XG4gICAgLy8gICAgICAgICBpZDogaW52aXRlSWRcbiAgICAvLyAgICAgfSk7XG4gICAgLy8gfTtcblxuXG5cbiAgICByZXR1cm4gX2ZhY3Rvcnk7XG59KTtcblxuYXBwLmZhY3RvcnkoJ2dvb2dsZVNlcnZpY2UnLCBmdW5jdGlvbigkcSwgJGh0dHApIHtcblxuICAgIHZhciBfZmFjdG9yeSA9IHt9O1xuICAgIF9mYWN0b3J5Lmxpc3RJbnZpdGVzID0gZnVuY3Rpb24ocHJvamVjdElkKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoXCIvYXBpL2ludml0ZS9saXN0LWludml0ZXM/cHJvamVjdElkPVwiICsgcHJvamVjdElkKTtcbiAgICB9O1xuXG4gICAgX2ZhY3RvcnkuYWNjZXB0SW5pdnRlID0gZnVuY3Rpb24oaW52aXRlSWQpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoXCIvYXBpL2ludml0ZS9hY2NlcHRcIiwge1xuICAgICAgICAgICAgaWQ6IGludml0ZUlkXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBfZmFjdG9yeS5nb29nbGVBcGlDbGllbnRSZWFkeSA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG4gICAgICAgIHZhciBkZWZlcnJlZCA9ICRxLmRlZmVyKCk7XG5cbiAgICAgICAgZ2FwaS5jbGllbnQubG9hZCgneW91dHViZScsICd2MycsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgZ2FwaS5jbGllbnQuc2V0QXBpS2V5KCdBSXphU3lDUndNdUdQNTBhT3ZycHR5WFJadHZlRTUwZmFPTGI4UjAnKTtcbiAgICAgICAgICAgIHZhciByZXF1ZXN0ID0gZ2FwaS5jbGllbnQueW91dHViZS5zZWFyY2gubGlzdCh7XG4gICAgICAgICAgICAgICAgcGFydDogJ3NuaXBwZXQnLFxuICAgICAgICAgICAgICAgIHE6IHF1ZXJ5LFxuICAgICAgICAgICAgICAgIG1heFJlc3VsdHM6IDI0XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJlcXVlc3QuZXhlY3V0ZShmdW5jdGlvbihyZXNwb25zZSkge1xuXG4gICAgICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShyZXNwb25zZS5yZXN1bHQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xuICAgIH07XG5cbiAgICByZXR1cm4gX2ZhY3Rvcnk7XG59KTtcblxuXG5cbnZhciBkZWJvdW5jZSA9IGZ1bmN0aW9uKGZ1bmMsIHdhaXQpIHtcbiAgICAvLyB3ZSBuZWVkIHRvIHNhdmUgdGhlc2UgaW4gdGhlIGNsb3N1cmVcbiAgICB2YXIgdGltZW91dCwgYXJncywgY29udGV4dCwgdGltZXN0YW1wO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIC8vIHNhdmUgZGV0YWlscyBvZiBsYXRlc3QgY2FsbFxuICAgICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgICAgYXJncyA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcbiAgICAgICAgdGltZXN0YW1wID0gbmV3IERhdGUoKTtcblxuICAgICAgICAvLyB0aGlzIGlzIHdoZXJlIHRoZSBtYWdpYyBoYXBwZW5zXG4gICAgICAgIHZhciBsYXRlciA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICAvLyBob3cgbG9uZyBhZ28gd2FzIHRoZSBsYXN0IGNhbGxcbiAgICAgICAgICAgIHZhciBsYXN0ID0gKG5ldyBEYXRlKCkpIC0gdGltZXN0YW1wO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgbGF0ZXN0IGNhbGwgd2FzIGxlc3MgdGhhdCB0aGUgd2FpdCBwZXJpb2QgYWdvXG4gICAgICAgICAgICAvLyB0aGVuIHdlIHJlc2V0IHRoZSB0aW1lb3V0IHRvIHdhaXQgZm9yIHRoZSBkaWZmZXJlbmNlXG4gICAgICAgICAgICBpZiAobGFzdCA8IHdhaXQpIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCAtIGxhc3QpO1xuXG4gICAgICAgICAgICAgICAgLy8gb3IgaWYgbm90IHdlIGNhbiBudWxsIG91dCB0aGUgdGltZXIgYW5kIHJ1biB0aGUgbGF0ZXN0XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgICAgICAgIGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gd2Ugb25seSBuZWVkIHRvIHNldCB0aGUgdGltZXIgbm93IGlmIG9uZSBpc24ndCBhbHJlYWR5IHJ1bm5pbmdcbiAgICAgICAgaWYgKCF0aW1lb3V0KSB7XG4gICAgICAgICAgICB0aW1lb3V0ID0gc2V0VGltZW91dChsYXRlciwgd2FpdCk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuIiwiLyohXG4gKiBNaXpKcyB2MS4wLjAgXG4gKiBDb3B5cmlnaHQgTWl6VGVjaFxuICogTGljZW5zZWQgTWlrZVpoZW5nXG4gKiBodHRwOi8vbWlrZS16aGVuZy5naXRodWIuaW8vXG4gKi9cbiBcbi8vICEgalF1ZXJ5IHYxLjkuMSB8IChjKSAyMDA1LCAyMDEyIGpRdWVyeSBGb3VuZGF0aW9uLCBJbmMuIHwganF1ZXJ5Lm9yZy9saWNlbnNlXG4vL0Agc291cmNlTWFwcGluZ1VSTD1qcXVlcnkubWluLm1hcFxuKGZ1bmN0aW9uKGUsdCl7dmFyIG4scixpPXR5cGVvZiB0LG89ZS5kb2N1bWVudCxhPWUubG9jYXRpb24scz1lLmpRdWVyeSx1PWUuJCxsPXt9LGM9W10scD1cIjEuOS4xXCIsZj1jLmNvbmNhdCxkPWMucHVzaCxoPWMuc2xpY2UsZz1jLmluZGV4T2YsbT1sLnRvU3RyaW5nLHk9bC5oYXNPd25Qcm9wZXJ0eSx2PXAudHJpbSxiPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIG5ldyBiLmZuLmluaXQoZSx0LHIpfSx4PS9bKy1dPyg/OlxcZCpcXC58KVxcZCsoPzpbZUVdWystXT9cXGQrfCkvLnNvdXJjZSx3PS9cXFMrL2csVD0vXltcXHNcXHVGRUZGXFx4QTBdK3xbXFxzXFx1RkVGRlxceEEwXSskL2csTj0vXig/Oig8W1xcd1xcV10rPilbXj5dKnwjKFtcXHctXSopKSQvLEM9L148KFxcdyspXFxzKlxcLz8+KD86PFxcL1xcMT58KSQvLGs9L15bXFxdLDp7fVxcc10qJC8sRT0vKD86Xnw6fCwpKD86XFxzKlxcWykrL2csUz0vXFxcXCg/OltcIlxcXFxcXC9iZm5ydF18dVtcXGRhLWZBLUZdezR9KS9nLEE9L1wiW15cIlxcXFxcXHJcXG5dKlwifHRydWV8ZmFsc2V8bnVsbHwtPyg/OlxcZCtcXC58KVxcZCsoPzpbZUVdWystXT9cXGQrfCkvZyxqPS9eLW1zLS8sRD0vLShbXFxkYS16XSkvZ2ksTD1mdW5jdGlvbihlLHQpe3JldHVybiB0LnRvVXBwZXJDYXNlKCl9LEg9ZnVuY3Rpb24oZSl7KG8uYWRkRXZlbnRMaXN0ZW5lcnx8XCJsb2FkXCI9PT1lLnR5cGV8fFwiY29tcGxldGVcIj09PW8ucmVhZHlTdGF0ZSkmJihxKCksYi5yZWFkeSgpKX0scT1mdW5jdGlvbigpe28uYWRkRXZlbnRMaXN0ZW5lcj8oby5yZW1vdmVFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLEgsITEpLGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImxvYWRcIixILCExKSk6KG8uZGV0YWNoRXZlbnQoXCJvbnJlYWR5c3RhdGVjaGFuZ2VcIixIKSxlLmRldGFjaEV2ZW50KFwib25sb2FkXCIsSCkpfTtiLmZuPWIucHJvdG90eXBlPXtqcXVlcnk6cCxjb25zdHJ1Y3RvcjpiLGluaXQ6ZnVuY3Rpb24oZSxuLHIpe3ZhciBpLGE7aWYoIWUpcmV0dXJuIHRoaXM7aWYoXCJzdHJpbmdcIj09dHlwZW9mIGUpe2lmKGk9XCI8XCI9PT1lLmNoYXJBdCgwKSYmXCI+XCI9PT1lLmNoYXJBdChlLmxlbmd0aC0xKSYmZS5sZW5ndGg+PTM/W251bGwsZSxudWxsXTpOLmV4ZWMoZSksIWl8fCFpWzFdJiZuKXJldHVybiFufHxuLmpxdWVyeT8obnx8cikuZmluZChlKTp0aGlzLmNvbnN0cnVjdG9yKG4pLmZpbmQoZSk7aWYoaVsxXSl7aWYobj1uIGluc3RhbmNlb2YgYj9uWzBdOm4sYi5tZXJnZSh0aGlzLGIucGFyc2VIVE1MKGlbMV0sbiYmbi5ub2RlVHlwZT9uLm93bmVyRG9jdW1lbnR8fG46bywhMCkpLEMudGVzdChpWzFdKSYmYi5pc1BsYWluT2JqZWN0KG4pKWZvcihpIGluIG4pYi5pc0Z1bmN0aW9uKHRoaXNbaV0pP3RoaXNbaV0obltpXSk6dGhpcy5hdHRyKGksbltpXSk7cmV0dXJuIHRoaXN9aWYoYT1vLmdldEVsZW1lbnRCeUlkKGlbMl0pLGEmJmEucGFyZW50Tm9kZSl7aWYoYS5pZCE9PWlbMl0pcmV0dXJuIHIuZmluZChlKTt0aGlzLmxlbmd0aD0xLHRoaXNbMF09YX1yZXR1cm4gdGhpcy5jb250ZXh0PW8sdGhpcy5zZWxlY3Rvcj1lLHRoaXN9cmV0dXJuIGUubm9kZVR5cGU/KHRoaXMuY29udGV4dD10aGlzWzBdPWUsdGhpcy5sZW5ndGg9MSx0aGlzKTpiLmlzRnVuY3Rpb24oZSk/ci5yZWFkeShlKTooZS5zZWxlY3RvciE9PXQmJih0aGlzLnNlbGVjdG9yPWUuc2VsZWN0b3IsdGhpcy5jb250ZXh0PWUuY29udGV4dCksYi5tYWtlQXJyYXkoZSx0aGlzKSl9LHNlbGVjdG9yOlwiXCIsbGVuZ3RoOjAsc2l6ZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmxlbmd0aH0sdG9BcnJheTpmdW5jdGlvbigpe3JldHVybiBoLmNhbGwodGhpcyl9LGdldDpmdW5jdGlvbihlKXtyZXR1cm4gbnVsbD09ZT90aGlzLnRvQXJyYXkoKTowPmU/dGhpc1t0aGlzLmxlbmd0aCtlXTp0aGlzW2VdfSxwdXNoU3RhY2s6ZnVuY3Rpb24oZSl7dmFyIHQ9Yi5tZXJnZSh0aGlzLmNvbnN0cnVjdG9yKCksZSk7cmV0dXJuIHQucHJldk9iamVjdD10aGlzLHQuY29udGV4dD10aGlzLmNvbnRleHQsdH0sZWFjaDpmdW5jdGlvbihlLHQpe3JldHVybiBiLmVhY2godGhpcyxlLHQpfSxyZWFkeTpmdW5jdGlvbihlKXtyZXR1cm4gYi5yZWFkeS5wcm9taXNlKCkuZG9uZShlKSx0aGlzfSxzbGljZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLnB1c2hTdGFjayhoLmFwcGx5KHRoaXMsYXJndW1lbnRzKSl9LGZpcnN0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZXEoMCl9LGxhc3Q6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5lcSgtMSl9LGVxOmZ1bmN0aW9uKGUpe3ZhciB0PXRoaXMubGVuZ3RoLG49K2UrKDA+ZT90OjApO3JldHVybiB0aGlzLnB1c2hTdGFjayhuPj0wJiZ0Pm4/W3RoaXNbbl1dOltdKX0sbWFwOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLnB1c2hTdGFjayhiLm1hcCh0aGlzLGZ1bmN0aW9uKHQsbil7cmV0dXJuIGUuY2FsbCh0LG4sdCl9KSl9LGVuZDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnByZXZPYmplY3R8fHRoaXMuY29uc3RydWN0b3IobnVsbCl9LHB1c2g6ZCxzb3J0OltdLnNvcnQsc3BsaWNlOltdLnNwbGljZX0sYi5mbi5pbml0LnByb3RvdHlwZT1iLmZuLGIuZXh0ZW5kPWIuZm4uZXh0ZW5kPWZ1bmN0aW9uKCl7dmFyIGUsbixyLGksbyxhLHM9YXJndW1lbnRzWzBdfHx7fSx1PTEsbD1hcmd1bWVudHMubGVuZ3RoLGM9ITE7Zm9yKFwiYm9vbGVhblwiPT10eXBlb2YgcyYmKGM9cyxzPWFyZ3VtZW50c1sxXXx8e30sdT0yKSxcIm9iamVjdFwiPT10eXBlb2Ygc3x8Yi5pc0Z1bmN0aW9uKHMpfHwocz17fSksbD09PXUmJihzPXRoaXMsLS11KTtsPnU7dSsrKWlmKG51bGwhPShvPWFyZ3VtZW50c1t1XSkpZm9yKGkgaW4gbyllPXNbaV0scj1vW2ldLHMhPT1yJiYoYyYmciYmKGIuaXNQbGFpbk9iamVjdChyKXx8KG49Yi5pc0FycmF5KHIpKSk/KG4/KG49ITEsYT1lJiZiLmlzQXJyYXkoZSk/ZTpbXSk6YT1lJiZiLmlzUGxhaW5PYmplY3QoZSk/ZTp7fSxzW2ldPWIuZXh0ZW5kKGMsYSxyKSk6ciE9PXQmJihzW2ldPXIpKTtyZXR1cm4gc30sYi5leHRlbmQoe25vQ29uZmxpY3Q6ZnVuY3Rpb24odCl7cmV0dXJuIGUuJD09PWImJihlLiQ9dSksdCYmZS5qUXVlcnk9PT1iJiYoZS5qUXVlcnk9cyksYn0saXNSZWFkeTohMSxyZWFkeVdhaXQ6MSxob2xkUmVhZHk6ZnVuY3Rpb24oZSl7ZT9iLnJlYWR5V2FpdCsrOmIucmVhZHkoITApfSxyZWFkeTpmdW5jdGlvbihlKXtpZihlPT09ITA/IS0tYi5yZWFkeVdhaXQ6IWIuaXNSZWFkeSl7aWYoIW8uYm9keSlyZXR1cm4gc2V0VGltZW91dChiLnJlYWR5KTtiLmlzUmVhZHk9ITAsZSE9PSEwJiYtLWIucmVhZHlXYWl0PjB8fChuLnJlc29sdmVXaXRoKG8sW2JdKSxiLmZuLnRyaWdnZXImJmIobykudHJpZ2dlcihcInJlYWR5XCIpLm9mZihcInJlYWR5XCIpKX19LGlzRnVuY3Rpb246ZnVuY3Rpb24oZSl7cmV0dXJuXCJmdW5jdGlvblwiPT09Yi50eXBlKGUpfSxpc0FycmF5OkFycmF5LmlzQXJyYXl8fGZ1bmN0aW9uKGUpe3JldHVyblwiYXJyYXlcIj09PWIudHlwZShlKX0saXNXaW5kb3c6ZnVuY3Rpb24oZSl7cmV0dXJuIG51bGwhPWUmJmU9PWUud2luZG93fSxpc051bWVyaWM6ZnVuY3Rpb24oZSl7cmV0dXJuIWlzTmFOKHBhcnNlRmxvYXQoZSkpJiZpc0Zpbml0ZShlKX0sdHlwZTpmdW5jdGlvbihlKXtyZXR1cm4gbnVsbD09ZT9lK1wiXCI6XCJvYmplY3RcIj09dHlwZW9mIGV8fFwiZnVuY3Rpb25cIj09dHlwZW9mIGU/bFttLmNhbGwoZSldfHxcIm9iamVjdFwiOnR5cGVvZiBlfSxpc1BsYWluT2JqZWN0OmZ1bmN0aW9uKGUpe2lmKCFlfHxcIm9iamVjdFwiIT09Yi50eXBlKGUpfHxlLm5vZGVUeXBlfHxiLmlzV2luZG93KGUpKXJldHVybiExO3RyeXtpZihlLmNvbnN0cnVjdG9yJiYheS5jYWxsKGUsXCJjb25zdHJ1Y3RvclwiKSYmIXkuY2FsbChlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSxcImlzUHJvdG90eXBlT2ZcIikpcmV0dXJuITF9Y2F0Y2gobil7cmV0dXJuITF9dmFyIHI7Zm9yKHIgaW4gZSk7cmV0dXJuIHI9PT10fHx5LmNhbGwoZSxyKX0saXNFbXB0eU9iamVjdDpmdW5jdGlvbihlKXt2YXIgdDtmb3IodCBpbiBlKXJldHVybiExO3JldHVybiEwfSxlcnJvcjpmdW5jdGlvbihlKXt0aHJvdyBFcnJvcihlKX0scGFyc2VIVE1MOmZ1bmN0aW9uKGUsdCxuKXtpZighZXx8XCJzdHJpbmdcIiE9dHlwZW9mIGUpcmV0dXJuIG51bGw7XCJib29sZWFuXCI9PXR5cGVvZiB0JiYobj10LHQ9ITEpLHQ9dHx8bzt2YXIgcj1DLmV4ZWMoZSksaT0hbiYmW107cmV0dXJuIHI/W3QuY3JlYXRlRWxlbWVudChyWzFdKV06KHI9Yi5idWlsZEZyYWdtZW50KFtlXSx0LGkpLGkmJmIoaSkucmVtb3ZlKCksYi5tZXJnZShbXSxyLmNoaWxkTm9kZXMpKX0scGFyc2VKU09OOmZ1bmN0aW9uKG4pe3JldHVybiBlLkpTT04mJmUuSlNPTi5wYXJzZT9lLkpTT04ucGFyc2Uobik6bnVsbD09PW4/bjpcInN0cmluZ1wiPT10eXBlb2YgbiYmKG49Yi50cmltKG4pLG4mJmsudGVzdChuLnJlcGxhY2UoUyxcIkBcIikucmVwbGFjZShBLFwiXVwiKS5yZXBsYWNlKEUsXCJcIikpKT9GdW5jdGlvbihcInJldHVybiBcIituKSgpOihiLmVycm9yKFwiSW52YWxpZCBKU09OOiBcIituKSx0KX0scGFyc2VYTUw6ZnVuY3Rpb24obil7dmFyIHIsaTtpZighbnx8XCJzdHJpbmdcIiE9dHlwZW9mIG4pcmV0dXJuIG51bGw7dHJ5e2UuRE9NUGFyc2VyPyhpPW5ldyBET01QYXJzZXIscj1pLnBhcnNlRnJvbVN0cmluZyhuLFwidGV4dC94bWxcIikpOihyPW5ldyBBY3RpdmVYT2JqZWN0KFwiTWljcm9zb2Z0LlhNTERPTVwiKSxyLmFzeW5jPVwiZmFsc2VcIixyLmxvYWRYTUwobikpfWNhdGNoKG8pe3I9dH1yZXR1cm4gciYmci5kb2N1bWVudEVsZW1lbnQmJiFyLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwicGFyc2VyZXJyb3JcIikubGVuZ3RofHxiLmVycm9yKFwiSW52YWxpZCBYTUw6IFwiK24pLHJ9LG5vb3A6ZnVuY3Rpb24oKXt9LGdsb2JhbEV2YWw6ZnVuY3Rpb24odCl7dCYmYi50cmltKHQpJiYoZS5leGVjU2NyaXB0fHxmdW5jdGlvbih0KXtlLmV2YWwuY2FsbChlLHQpfSkodCl9LGNhbWVsQ2FzZTpmdW5jdGlvbihlKXtyZXR1cm4gZS5yZXBsYWNlKGosXCJtcy1cIikucmVwbGFjZShELEwpfSxub2RlTmFtZTpmdW5jdGlvbihlLHQpe3JldHVybiBlLm5vZGVOYW1lJiZlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk9PT10LnRvTG93ZXJDYXNlKCl9LGVhY2g6ZnVuY3Rpb24oZSx0LG4pe3ZhciByLGk9MCxvPWUubGVuZ3RoLGE9TShlKTtpZihuKXtpZihhKXtmb3IoO28+aTtpKyspaWYocj10LmFwcGx5KGVbaV0sbikscj09PSExKWJyZWFrfWVsc2UgZm9yKGkgaW4gZSlpZihyPXQuYXBwbHkoZVtpXSxuKSxyPT09ITEpYnJlYWt9ZWxzZSBpZihhKXtmb3IoO28+aTtpKyspaWYocj10LmNhbGwoZVtpXSxpLGVbaV0pLHI9PT0hMSlicmVha31lbHNlIGZvcihpIGluIGUpaWYocj10LmNhbGwoZVtpXSxpLGVbaV0pLHI9PT0hMSlicmVhaztyZXR1cm4gZX0sdHJpbTp2JiYhdi5jYWxsKFwiXFx1ZmVmZlxcdTAwYTBcIik/ZnVuY3Rpb24oZSl7cmV0dXJuIG51bGw9PWU/XCJcIjp2LmNhbGwoZSl9OmZ1bmN0aW9uKGUpe3JldHVybiBudWxsPT1lP1wiXCI6KGUrXCJcIikucmVwbGFjZShULFwiXCIpfSxtYWtlQXJyYXk6ZnVuY3Rpb24oZSx0KXt2YXIgbj10fHxbXTtyZXR1cm4gbnVsbCE9ZSYmKE0oT2JqZWN0KGUpKT9iLm1lcmdlKG4sXCJzdHJpbmdcIj09dHlwZW9mIGU/W2VdOmUpOmQuY2FsbChuLGUpKSxufSxpbkFycmF5OmZ1bmN0aW9uKGUsdCxuKXt2YXIgcjtpZih0KXtpZihnKXJldHVybiBnLmNhbGwodCxlLG4pO2ZvcihyPXQubGVuZ3RoLG49bj8wPm4/TWF0aC5tYXgoMCxyK24pOm46MDtyPm47bisrKWlmKG4gaW4gdCYmdFtuXT09PWUpcmV0dXJuIG59cmV0dXJuLTF9LG1lcmdlOmZ1bmN0aW9uKGUsbil7dmFyIHI9bi5sZW5ndGgsaT1lLmxlbmd0aCxvPTA7aWYoXCJudW1iZXJcIj09dHlwZW9mIHIpZm9yKDtyPm87bysrKWVbaSsrXT1uW29dO2Vsc2Ugd2hpbGUobltvXSE9PXQpZVtpKytdPW5bbysrXTtyZXR1cm4gZS5sZW5ndGg9aSxlfSxncmVwOmZ1bmN0aW9uKGUsdCxuKXt2YXIgcixpPVtdLG89MCxhPWUubGVuZ3RoO2ZvcihuPSEhbjthPm87bysrKXI9ISF0KGVbb10sbyksbiE9PXImJmkucHVzaChlW29dKTtyZXR1cm4gaX0sbWFwOmZ1bmN0aW9uKGUsdCxuKXt2YXIgcixpPTAsbz1lLmxlbmd0aCxhPU0oZSkscz1bXTtpZihhKWZvcig7bz5pO2krKylyPXQoZVtpXSxpLG4pLG51bGwhPXImJihzW3MubGVuZ3RoXT1yKTtlbHNlIGZvcihpIGluIGUpcj10KGVbaV0saSxuKSxudWxsIT1yJiYoc1tzLmxlbmd0aF09cik7cmV0dXJuIGYuYXBwbHkoW10scyl9LGd1aWQ6MSxwcm94eTpmdW5jdGlvbihlLG4pe3ZhciByLGksbztyZXR1cm5cInN0cmluZ1wiPT10eXBlb2YgbiYmKG89ZVtuXSxuPWUsZT1vKSxiLmlzRnVuY3Rpb24oZSk/KHI9aC5jYWxsKGFyZ3VtZW50cywyKSxpPWZ1bmN0aW9uKCl7cmV0dXJuIGUuYXBwbHkobnx8dGhpcyxyLmNvbmNhdChoLmNhbGwoYXJndW1lbnRzKSkpfSxpLmd1aWQ9ZS5ndWlkPWUuZ3VpZHx8Yi5ndWlkKyssaSk6dH0sYWNjZXNzOmZ1bmN0aW9uKGUsbixyLGksbyxhLHMpe3ZhciB1PTAsbD1lLmxlbmd0aCxjPW51bGw9PXI7aWYoXCJvYmplY3RcIj09PWIudHlwZShyKSl7bz0hMDtmb3IodSBpbiByKWIuYWNjZXNzKGUsbix1LHJbdV0sITAsYSxzKX1lbHNlIGlmKGkhPT10JiYobz0hMCxiLmlzRnVuY3Rpb24oaSl8fChzPSEwKSxjJiYocz8obi5jYWxsKGUsaSksbj1udWxsKTooYz1uLG49ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBjLmNhbGwoYihlKSxuKX0pKSxuKSlmb3IoO2w+dTt1KyspbihlW3VdLHIscz9pOmkuY2FsbChlW3VdLHUsbihlW3VdLHIpKSk7cmV0dXJuIG8/ZTpjP24uY2FsbChlKTpsP24oZVswXSxyKTphfSxub3c6ZnVuY3Rpb24oKXtyZXR1cm4obmV3IERhdGUpLmdldFRpbWUoKX19KSxiLnJlYWR5LnByb21pc2U9ZnVuY3Rpb24odCl7aWYoIW4paWYobj1iLkRlZmVycmVkKCksXCJjb21wbGV0ZVwiPT09by5yZWFkeVN0YXRlKXNldFRpbWVvdXQoYi5yZWFkeSk7ZWxzZSBpZihvLmFkZEV2ZW50TGlzdGVuZXIpby5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLEgsITEpLGUuYWRkRXZlbnRMaXN0ZW5lcihcImxvYWRcIixILCExKTtlbHNle28uYXR0YWNoRXZlbnQoXCJvbnJlYWR5c3RhdGVjaGFuZ2VcIixIKSxlLmF0dGFjaEV2ZW50KFwib25sb2FkXCIsSCk7dmFyIHI9ITE7dHJ5e3I9bnVsbD09ZS5mcmFtZUVsZW1lbnQmJm8uZG9jdW1lbnRFbGVtZW50fWNhdGNoKGkpe31yJiZyLmRvU2Nyb2xsJiZmdW5jdGlvbiBhKCl7aWYoIWIuaXNSZWFkeSl7dHJ5e3IuZG9TY3JvbGwoXCJsZWZ0XCIpfWNhdGNoKGUpe3JldHVybiBzZXRUaW1lb3V0KGEsNTApfXEoKSxiLnJlYWR5KCl9fSgpfXJldHVybiBuLnByb21pc2UodCl9LGIuZWFjaChcIkJvb2xlYW4gTnVtYmVyIFN0cmluZyBGdW5jdGlvbiBBcnJheSBEYXRlIFJlZ0V4cCBPYmplY3QgRXJyb3JcIi5zcGxpdChcIiBcIiksZnVuY3Rpb24oZSx0KXtsW1wiW29iamVjdCBcIit0K1wiXVwiXT10LnRvTG93ZXJDYXNlKCl9KTtmdW5jdGlvbiBNKGUpe3ZhciB0PWUubGVuZ3RoLG49Yi50eXBlKGUpO3JldHVybiBiLmlzV2luZG93KGUpPyExOjE9PT1lLm5vZGVUeXBlJiZ0PyEwOlwiYXJyYXlcIj09PW58fFwiZnVuY3Rpb25cIiE9PW4mJigwPT09dHx8XCJudW1iZXJcIj09dHlwZW9mIHQmJnQ+MCYmdC0xIGluIGUpfXI9YihvKTt2YXIgXz17fTtmdW5jdGlvbiBGKGUpe3ZhciB0PV9bZV09e307cmV0dXJuIGIuZWFjaChlLm1hdGNoKHcpfHxbXSxmdW5jdGlvbihlLG4pe3Rbbl09ITB9KSx0fWIuQ2FsbGJhY2tzPWZ1bmN0aW9uKGUpe2U9XCJzdHJpbmdcIj09dHlwZW9mIGU/X1tlXXx8RihlKTpiLmV4dGVuZCh7fSxlKTt2YXIgbixyLGksbyxhLHMsdT1bXSxsPSFlLm9uY2UmJltdLGM9ZnVuY3Rpb24odCl7Zm9yKHI9ZS5tZW1vcnkmJnQsaT0hMCxhPXN8fDAscz0wLG89dS5sZW5ndGgsbj0hMDt1JiZvPmE7YSsrKWlmKHVbYV0uYXBwbHkodFswXSx0WzFdKT09PSExJiZlLnN0b3BPbkZhbHNlKXtyPSExO2JyZWFrfW49ITEsdSYmKGw/bC5sZW5ndGgmJmMobC5zaGlmdCgpKTpyP3U9W106cC5kaXNhYmxlKCkpfSxwPXthZGQ6ZnVuY3Rpb24oKXtpZih1KXt2YXIgdD11Lmxlbmd0aDsoZnVuY3Rpb24gaSh0KXtiLmVhY2godCxmdW5jdGlvbih0LG4pe3ZhciByPWIudHlwZShuKTtcImZ1bmN0aW9uXCI9PT1yP2UudW5pcXVlJiZwLmhhcyhuKXx8dS5wdXNoKG4pOm4mJm4ubGVuZ3RoJiZcInN0cmluZ1wiIT09ciYmaShuKX0pfSkoYXJndW1lbnRzKSxuP289dS5sZW5ndGg6ciYmKHM9dCxjKHIpKX1yZXR1cm4gdGhpc30scmVtb3ZlOmZ1bmN0aW9uKCl7cmV0dXJuIHUmJmIuZWFjaChhcmd1bWVudHMsZnVuY3Rpb24oZSx0KXt2YXIgcjt3aGlsZSgocj1iLmluQXJyYXkodCx1LHIpKT4tMSl1LnNwbGljZShyLDEpLG4mJihvPj1yJiZvLS0sYT49ciYmYS0tKX0pLHRoaXN9LGhhczpmdW5jdGlvbihlKXtyZXR1cm4gZT9iLmluQXJyYXkoZSx1KT4tMTohKCF1fHwhdS5sZW5ndGgpfSxlbXB0eTpmdW5jdGlvbigpe3JldHVybiB1PVtdLHRoaXN9LGRpc2FibGU6ZnVuY3Rpb24oKXtyZXR1cm4gdT1sPXI9dCx0aGlzfSxkaXNhYmxlZDpmdW5jdGlvbigpe3JldHVybiF1fSxsb2NrOmZ1bmN0aW9uKCl7cmV0dXJuIGw9dCxyfHxwLmRpc2FibGUoKSx0aGlzfSxsb2NrZWQ6ZnVuY3Rpb24oKXtyZXR1cm4hbH0sZmlyZVdpdGg6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gdD10fHxbXSx0PVtlLHQuc2xpY2U/dC5zbGljZSgpOnRdLCF1fHxpJiYhbHx8KG4/bC5wdXNoKHQpOmModCkpLHRoaXN9LGZpcmU6ZnVuY3Rpb24oKXtyZXR1cm4gcC5maXJlV2l0aCh0aGlzLGFyZ3VtZW50cyksdGhpc30sZmlyZWQ6ZnVuY3Rpb24oKXtyZXR1cm4hIWl9fTtyZXR1cm4gcH0sYi5leHRlbmQoe0RlZmVycmVkOmZ1bmN0aW9uKGUpe3ZhciB0PVtbXCJyZXNvbHZlXCIsXCJkb25lXCIsYi5DYWxsYmFja3MoXCJvbmNlIG1lbW9yeVwiKSxcInJlc29sdmVkXCJdLFtcInJlamVjdFwiLFwiZmFpbFwiLGIuQ2FsbGJhY2tzKFwib25jZSBtZW1vcnlcIiksXCJyZWplY3RlZFwiXSxbXCJub3RpZnlcIixcInByb2dyZXNzXCIsYi5DYWxsYmFja3MoXCJtZW1vcnlcIildXSxuPVwicGVuZGluZ1wiLHI9e3N0YXRlOmZ1bmN0aW9uKCl7cmV0dXJuIG59LGFsd2F5czpmdW5jdGlvbigpe3JldHVybiBpLmRvbmUoYXJndW1lbnRzKS5mYWlsKGFyZ3VtZW50cyksdGhpc30sdGhlbjpmdW5jdGlvbigpe3ZhciBlPWFyZ3VtZW50cztyZXR1cm4gYi5EZWZlcnJlZChmdW5jdGlvbihuKXtiLmVhY2godCxmdW5jdGlvbih0LG8pe3ZhciBhPW9bMF0scz1iLmlzRnVuY3Rpb24oZVt0XSkmJmVbdF07aVtvWzFdXShmdW5jdGlvbigpe3ZhciBlPXMmJnMuYXBwbHkodGhpcyxhcmd1bWVudHMpO2UmJmIuaXNGdW5jdGlvbihlLnByb21pc2UpP2UucHJvbWlzZSgpLmRvbmUobi5yZXNvbHZlKS5mYWlsKG4ucmVqZWN0KS5wcm9ncmVzcyhuLm5vdGlmeSk6blthK1wiV2l0aFwiXSh0aGlzPT09cj9uLnByb21pc2UoKTp0aGlzLHM/W2VdOmFyZ3VtZW50cyl9KX0pLGU9bnVsbH0pLnByb21pc2UoKX0scHJvbWlzZTpmdW5jdGlvbihlKXtyZXR1cm4gbnVsbCE9ZT9iLmV4dGVuZChlLHIpOnJ9fSxpPXt9O3JldHVybiByLnBpcGU9ci50aGVuLGIuZWFjaCh0LGZ1bmN0aW9uKGUsbyl7dmFyIGE9b1syXSxzPW9bM107cltvWzFdXT1hLmFkZCxzJiZhLmFkZChmdW5jdGlvbigpe249c30sdFsxXmVdWzJdLmRpc2FibGUsdFsyXVsyXS5sb2NrKSxpW29bMF1dPWZ1bmN0aW9uKCl7cmV0dXJuIGlbb1swXStcIldpdGhcIl0odGhpcz09PWk/cjp0aGlzLGFyZ3VtZW50cyksdGhpc30saVtvWzBdK1wiV2l0aFwiXT1hLmZpcmVXaXRofSksci5wcm9taXNlKGkpLGUmJmUuY2FsbChpLGkpLGl9LHdoZW46ZnVuY3Rpb24oZSl7dmFyIHQ9MCxuPWguY2FsbChhcmd1bWVudHMpLHI9bi5sZW5ndGgsaT0xIT09cnx8ZSYmYi5pc0Z1bmN0aW9uKGUucHJvbWlzZSk/cjowLG89MT09PWk/ZTpiLkRlZmVycmVkKCksYT1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGZ1bmN0aW9uKHIpe3RbZV09dGhpcyxuW2VdPWFyZ3VtZW50cy5sZW5ndGg+MT9oLmNhbGwoYXJndW1lbnRzKTpyLG49PT1zP28ubm90aWZ5V2l0aCh0LG4pOi0taXx8by5yZXNvbHZlV2l0aCh0LG4pfX0scyx1LGw7aWYocj4xKWZvcihzPUFycmF5KHIpLHU9QXJyYXkociksbD1BcnJheShyKTtyPnQ7dCsrKW5bdF0mJmIuaXNGdW5jdGlvbihuW3RdLnByb21pc2UpP25bdF0ucHJvbWlzZSgpLmRvbmUoYSh0LGwsbikpLmZhaWwoby5yZWplY3QpLnByb2dyZXNzKGEodCx1LHMpKTotLWk7cmV0dXJuIGl8fG8ucmVzb2x2ZVdpdGgobCxuKSxvLnByb21pc2UoKX19KSxiLnN1cHBvcnQ9ZnVuY3Rpb24oKXt2YXIgdCxuLHIsYSxzLHUsbCxjLHAsZixkPW8uY3JlYXRlRWxlbWVudChcImRpdlwiKTtpZihkLnNldEF0dHJpYnV0ZShcImNsYXNzTmFtZVwiLFwidFwiKSxkLmlubmVySFRNTD1cIiAgPGxpbmsvPjx0YWJsZT48L3RhYmxlPjxhIGhyZWY9Jy9hJz5hPC9hPjxpbnB1dCB0eXBlPSdjaGVja2JveCcvPlwiLG49ZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcIipcIikscj1kLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYVwiKVswXSwhbnx8IXJ8fCFuLmxlbmd0aClyZXR1cm57fTtzPW8uY3JlYXRlRWxlbWVudChcInNlbGVjdFwiKSxsPXMuYXBwZW5kQ2hpbGQoby5jcmVhdGVFbGVtZW50KFwib3B0aW9uXCIpKSxhPWQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpbnB1dFwiKVswXSxyLnN0eWxlLmNzc1RleHQ9XCJ0b3A6MXB4O2Zsb2F0OmxlZnQ7b3BhY2l0eTouNVwiLHQ9e2dldFNldEF0dHJpYnV0ZTpcInRcIiE9PWQuY2xhc3NOYW1lLGxlYWRpbmdXaGl0ZXNwYWNlOjM9PT1kLmZpcnN0Q2hpbGQubm9kZVR5cGUsdGJvZHk6IWQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJ0Ym9keVwiKS5sZW5ndGgsaHRtbFNlcmlhbGl6ZTohIWQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJsaW5rXCIpLmxlbmd0aCxzdHlsZTovdG9wLy50ZXN0KHIuZ2V0QXR0cmlidXRlKFwic3R5bGVcIikpLGhyZWZOb3JtYWxpemVkOlwiL2FcIj09PXIuZ2V0QXR0cmlidXRlKFwiaHJlZlwiKSxvcGFjaXR5Oi9eMC41Ly50ZXN0KHIuc3R5bGUub3BhY2l0eSksY3NzRmxvYXQ6ISFyLnN0eWxlLmNzc0Zsb2F0LGNoZWNrT246ISFhLnZhbHVlLG9wdFNlbGVjdGVkOmwuc2VsZWN0ZWQsZW5jdHlwZTohIW8uY3JlYXRlRWxlbWVudChcImZvcm1cIikuZW5jdHlwZSxodG1sNUNsb25lOlwiPDpuYXY+PC86bmF2PlwiIT09by5jcmVhdGVFbGVtZW50KFwibmF2XCIpLmNsb25lTm9kZSghMCkub3V0ZXJIVE1MLGJveE1vZGVsOlwiQ1NTMUNvbXBhdFwiPT09by5jb21wYXRNb2RlLGRlbGV0ZUV4cGFuZG86ITAsbm9DbG9uZUV2ZW50OiEwLGlubGluZUJsb2NrTmVlZHNMYXlvdXQ6ITEsc2hyaW5rV3JhcEJsb2NrczohMSxyZWxpYWJsZU1hcmdpblJpZ2h0OiEwLGJveFNpemluZ1JlbGlhYmxlOiEwLHBpeGVsUG9zaXRpb246ITF9LGEuY2hlY2tlZD0hMCx0Lm5vQ2xvbmVDaGVja2VkPWEuY2xvbmVOb2RlKCEwKS5jaGVja2VkLHMuZGlzYWJsZWQ9ITAsdC5vcHREaXNhYmxlZD0hbC5kaXNhYmxlZDt0cnl7ZGVsZXRlIGQudGVzdH1jYXRjaChoKXt0LmRlbGV0ZUV4cGFuZG89ITF9YT1vLmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKSxhLnNldEF0dHJpYnV0ZShcInZhbHVlXCIsXCJcIiksdC5pbnB1dD1cIlwiPT09YS5nZXRBdHRyaWJ1dGUoXCJ2YWx1ZVwiKSxhLnZhbHVlPVwidFwiLGEuc2V0QXR0cmlidXRlKFwidHlwZVwiLFwicmFkaW9cIiksdC5yYWRpb1ZhbHVlPVwidFwiPT09YS52YWx1ZSxhLnNldEF0dHJpYnV0ZShcImNoZWNrZWRcIixcInRcIiksYS5zZXRBdHRyaWJ1dGUoXCJuYW1lXCIsXCJ0XCIpLHU9by5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCksdS5hcHBlbmRDaGlsZChhKSx0LmFwcGVuZENoZWNrZWQ9YS5jaGVja2VkLHQuY2hlY2tDbG9uZT11LmNsb25lTm9kZSghMCkuY2xvbmVOb2RlKCEwKS5sYXN0Q2hpbGQuY2hlY2tlZCxkLmF0dGFjaEV2ZW50JiYoZC5hdHRhY2hFdmVudChcIm9uY2xpY2tcIixmdW5jdGlvbigpe3Qubm9DbG9uZUV2ZW50PSExfSksZC5jbG9uZU5vZGUoITApLmNsaWNrKCkpO2ZvcihmIGlue3N1Ym1pdDohMCxjaGFuZ2U6ITAsZm9jdXNpbjohMH0pZC5zZXRBdHRyaWJ1dGUoYz1cIm9uXCIrZixcInRcIiksdFtmK1wiQnViYmxlc1wiXT1jIGluIGV8fGQuYXR0cmlidXRlc1tjXS5leHBhbmRvPT09ITE7cmV0dXJuIGQuc3R5bGUuYmFja2dyb3VuZENsaXA9XCJjb250ZW50LWJveFwiLGQuY2xvbmVOb2RlKCEwKS5zdHlsZS5iYWNrZ3JvdW5kQ2xpcD1cIlwiLHQuY2xlYXJDbG9uZVN0eWxlPVwiY29udGVudC1ib3hcIj09PWQuc3R5bGUuYmFja2dyb3VuZENsaXAsYihmdW5jdGlvbigpe3ZhciBuLHIsYSxzPVwicGFkZGluZzowO21hcmdpbjowO2JvcmRlcjowO2Rpc3BsYXk6YmxvY2s7Ym94LXNpemluZzpjb250ZW50LWJveDstbW96LWJveC1zaXppbmc6Y29udGVudC1ib3g7LXdlYmtpdC1ib3gtc2l6aW5nOmNvbnRlbnQtYm94O1wiLHU9by5nZXRFbGVtZW50c0J5VGFnTmFtZShcImJvZHlcIilbMF07dSYmKG49by5jcmVhdGVFbGVtZW50KFwiZGl2XCIpLG4uc3R5bGUuY3NzVGV4dD1cImJvcmRlcjowO3dpZHRoOjA7aGVpZ2h0OjA7cG9zaXRpb246YWJzb2x1dGU7dG9wOjA7bGVmdDotOTk5OXB4O21hcmdpbi10b3A6MXB4XCIsdS5hcHBlbmRDaGlsZChuKS5hcHBlbmRDaGlsZChkKSxkLmlubmVySFRNTD1cIjx0YWJsZT48dHI+PHRkPjwvdGQ+PHRkPnQ8L3RkPjwvdHI+PC90YWJsZT5cIixhPWQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJ0ZFwiKSxhWzBdLnN0eWxlLmNzc1RleHQ9XCJwYWRkaW5nOjA7bWFyZ2luOjA7Ym9yZGVyOjA7ZGlzcGxheTpub25lXCIscD0wPT09YVswXS5vZmZzZXRIZWlnaHQsYVswXS5zdHlsZS5kaXNwbGF5PVwiXCIsYVsxXS5zdHlsZS5kaXNwbGF5PVwibm9uZVwiLHQucmVsaWFibGVIaWRkZW5PZmZzZXRzPXAmJjA9PT1hWzBdLm9mZnNldEhlaWdodCxkLmlubmVySFRNTD1cIlwiLGQuc3R5bGUuY3NzVGV4dD1cImJveC1zaXppbmc6Ym9yZGVyLWJveDstbW96LWJveC1zaXppbmc6Ym9yZGVyLWJveDstd2Via2l0LWJveC1zaXppbmc6Ym9yZGVyLWJveDtwYWRkaW5nOjFweDtib3JkZXI6MXB4O2Rpc3BsYXk6YmxvY2s7d2lkdGg6NHB4O21hcmdpbi10b3A6MSU7cG9zaXRpb246YWJzb2x1dGU7dG9wOjElO1wiLHQuYm94U2l6aW5nPTQ9PT1kLm9mZnNldFdpZHRoLHQuZG9lc05vdEluY2x1ZGVNYXJnaW5JbkJvZHlPZmZzZXQ9MSE9PXUub2Zmc2V0VG9wLGUuZ2V0Q29tcHV0ZWRTdHlsZSYmKHQucGl4ZWxQb3NpdGlvbj1cIjElXCIhPT0oZS5nZXRDb21wdXRlZFN0eWxlKGQsbnVsbCl8fHt9KS50b3AsdC5ib3hTaXppbmdSZWxpYWJsZT1cIjRweFwiPT09KGUuZ2V0Q29tcHV0ZWRTdHlsZShkLG51bGwpfHx7d2lkdGg6XCI0cHhcIn0pLndpZHRoLHI9ZC5hcHBlbmRDaGlsZChvLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIikpLHIuc3R5bGUuY3NzVGV4dD1kLnN0eWxlLmNzc1RleHQ9cyxyLnN0eWxlLm1hcmdpblJpZ2h0PXIuc3R5bGUud2lkdGg9XCIwXCIsZC5zdHlsZS53aWR0aD1cIjFweFwiLHQucmVsaWFibGVNYXJnaW5SaWdodD0hcGFyc2VGbG9hdCgoZS5nZXRDb21wdXRlZFN0eWxlKHIsbnVsbCl8fHt9KS5tYXJnaW5SaWdodCkpLHR5cGVvZiBkLnN0eWxlLnpvb20hPT1pJiYoZC5pbm5lckhUTUw9XCJcIixkLnN0eWxlLmNzc1RleHQ9cytcIndpZHRoOjFweDtwYWRkaW5nOjFweDtkaXNwbGF5OmlubGluZTt6b29tOjFcIix0LmlubGluZUJsb2NrTmVlZHNMYXlvdXQ9Mz09PWQub2Zmc2V0V2lkdGgsZC5zdHlsZS5kaXNwbGF5PVwiYmxvY2tcIixkLmlubmVySFRNTD1cIjxkaXY+PC9kaXY+XCIsZC5maXJzdENoaWxkLnN0eWxlLndpZHRoPVwiNXB4XCIsdC5zaHJpbmtXcmFwQmxvY2tzPTMhPT1kLm9mZnNldFdpZHRoLHQuaW5saW5lQmxvY2tOZWVkc0xheW91dCYmKHUuc3R5bGUuem9vbT0xKSksdS5yZW1vdmVDaGlsZChuKSxuPWQ9YT1yPW51bGwpfSksbj1zPXU9bD1yPWE9bnVsbCx0fSgpO3ZhciBPPS8oPzpcXHtbXFxzXFxTXSpcXH18XFxbW1xcc1xcU10qXFxdKSQvLEI9LyhbQS1aXSkvZztmdW5jdGlvbiBQKGUsbixyLGkpe2lmKGIuYWNjZXB0RGF0YShlKSl7dmFyIG8sYSxzPWIuZXhwYW5kbyx1PVwic3RyaW5nXCI9PXR5cGVvZiBuLGw9ZS5ub2RlVHlwZSxwPWw/Yi5jYWNoZTplLGY9bD9lW3NdOmVbc10mJnM7aWYoZiYmcFtmXSYmKGl8fHBbZl0uZGF0YSl8fCF1fHxyIT09dClyZXR1cm4gZnx8KGw/ZVtzXT1mPWMucG9wKCl8fGIuZ3VpZCsrOmY9cykscFtmXXx8KHBbZl09e30sbHx8KHBbZl0udG9KU09OPWIubm9vcCkpLChcIm9iamVjdFwiPT10eXBlb2Ygbnx8XCJmdW5jdGlvblwiPT10eXBlb2YgbikmJihpP3BbZl09Yi5leHRlbmQocFtmXSxuKTpwW2ZdLmRhdGE9Yi5leHRlbmQocFtmXS5kYXRhLG4pKSxvPXBbZl0saXx8KG8uZGF0YXx8KG8uZGF0YT17fSksbz1vLmRhdGEpLHIhPT10JiYob1tiLmNhbWVsQ2FzZShuKV09ciksdT8oYT1vW25dLG51bGw9PWEmJihhPW9bYi5jYW1lbENhc2UobildKSk6YT1vLGF9fWZ1bmN0aW9uIFIoZSx0LG4pe2lmKGIuYWNjZXB0RGF0YShlKSl7dmFyIHIsaSxvLGE9ZS5ub2RlVHlwZSxzPWE/Yi5jYWNoZTplLHU9YT9lW2IuZXhwYW5kb106Yi5leHBhbmRvO2lmKHNbdV0pe2lmKHQmJihvPW4/c1t1XTpzW3VdLmRhdGEpKXtiLmlzQXJyYXkodCk/dD10LmNvbmNhdChiLm1hcCh0LGIuY2FtZWxDYXNlKSk6dCBpbiBvP3Q9W3RdOih0PWIuY2FtZWxDYXNlKHQpLHQ9dCBpbiBvP1t0XTp0LnNwbGl0KFwiIFwiKSk7Zm9yKHI9MCxpPXQubGVuZ3RoO2k+cjtyKyspZGVsZXRlIG9bdFtyXV07aWYoIShuPyQ6Yi5pc0VtcHR5T2JqZWN0KShvKSlyZXR1cm59KG58fChkZWxldGUgc1t1XS5kYXRhLCQoc1t1XSkpKSYmKGE/Yi5jbGVhbkRhdGEoW2VdLCEwKTpiLnN1cHBvcnQuZGVsZXRlRXhwYW5kb3x8cyE9cy53aW5kb3c/ZGVsZXRlIHNbdV06c1t1XT1udWxsKX19fWIuZXh0ZW5kKHtjYWNoZTp7fSxleHBhbmRvOlwialF1ZXJ5XCIrKHArTWF0aC5yYW5kb20oKSkucmVwbGFjZSgvXFxEL2csXCJcIiksbm9EYXRhOntlbWJlZDohMCxvYmplY3Q6XCJjbHNpZDpEMjdDREI2RS1BRTZELTExY2YtOTZCOC00NDQ1NTM1NDAwMDBcIixhcHBsZXQ6ITB9LGhhc0RhdGE6ZnVuY3Rpb24oZSl7cmV0dXJuIGU9ZS5ub2RlVHlwZT9iLmNhY2hlW2VbYi5leHBhbmRvXV06ZVtiLmV4cGFuZG9dLCEhZSYmISQoZSl9LGRhdGE6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBQKGUsdCxuKX0scmVtb3ZlRGF0YTpmdW5jdGlvbihlLHQpe3JldHVybiBSKGUsdCl9LF9kYXRhOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gUChlLHQsbiwhMCl9LF9yZW1vdmVEYXRhOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIFIoZSx0LCEwKX0sYWNjZXB0RGF0YTpmdW5jdGlvbihlKXtpZihlLm5vZGVUeXBlJiYxIT09ZS5ub2RlVHlwZSYmOSE9PWUubm9kZVR5cGUpcmV0dXJuITE7dmFyIHQ9ZS5ub2RlTmFtZSYmYi5ub0RhdGFbZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpXTtyZXR1cm4hdHx8dCE9PSEwJiZlLmdldEF0dHJpYnV0ZShcImNsYXNzaWRcIik9PT10fX0pLGIuZm4uZXh0ZW5kKHtkYXRhOmZ1bmN0aW9uKGUsbil7dmFyIHIsaSxvPXRoaXNbMF0sYT0wLHM9bnVsbDtpZihlPT09dCl7aWYodGhpcy5sZW5ndGgmJihzPWIuZGF0YShvKSwxPT09by5ub2RlVHlwZSYmIWIuX2RhdGEobyxcInBhcnNlZEF0dHJzXCIpKSl7Zm9yKHI9by5hdHRyaWJ1dGVzO3IubGVuZ3RoPmE7YSsrKWk9clthXS5uYW1lLGkuaW5kZXhPZihcImRhdGEtXCIpfHwoaT1iLmNhbWVsQ2FzZShpLnNsaWNlKDUpKSxXKG8saSxzW2ldKSk7Yi5fZGF0YShvLFwicGFyc2VkQXR0cnNcIiwhMCl9cmV0dXJuIHN9cmV0dXJuXCJvYmplY3RcIj09dHlwZW9mIGU/dGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5kYXRhKHRoaXMsZSl9KTpiLmFjY2Vzcyh0aGlzLGZ1bmN0aW9uKG4pe3JldHVybiBuPT09dD9vP1cobyxlLGIuZGF0YShvLGUpKTpudWxsOih0aGlzLmVhY2goZnVuY3Rpb24oKXtiLmRhdGEodGhpcyxlLG4pfSksdCl9LG51bGwsbixhcmd1bWVudHMubGVuZ3RoPjEsbnVsbCwhMCl9LHJlbW92ZURhdGE6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpe2IucmVtb3ZlRGF0YSh0aGlzLGUpfSl9fSk7ZnVuY3Rpb24gVyhlLG4scil7aWYocj09PXQmJjE9PT1lLm5vZGVUeXBlKXt2YXIgaT1cImRhdGEtXCIrbi5yZXBsYWNlKEIsXCItJDFcIikudG9Mb3dlckNhc2UoKTtpZihyPWUuZ2V0QXR0cmlidXRlKGkpLFwic3RyaW5nXCI9PXR5cGVvZiByKXt0cnl7cj1cInRydWVcIj09PXI/ITA6XCJmYWxzZVwiPT09cj8hMTpcIm51bGxcIj09PXI/bnVsbDorcitcIlwiPT09cj8rcjpPLnRlc3Qocik/Yi5wYXJzZUpTT04ocik6cn1jYXRjaChvKXt9Yi5kYXRhKGUsbixyKX1lbHNlIHI9dH1yZXR1cm4gcn1mdW5jdGlvbiAkKGUpe3ZhciB0O2Zvcih0IGluIGUpaWYoKFwiZGF0YVwiIT09dHx8IWIuaXNFbXB0eU9iamVjdChlW3RdKSkmJlwidG9KU09OXCIhPT10KXJldHVybiExO3JldHVybiEwfWIuZXh0ZW5kKHtxdWV1ZTpmdW5jdGlvbihlLG4scil7dmFyIGk7cmV0dXJuIGU/KG49KG58fFwiZnhcIikrXCJxdWV1ZVwiLGk9Yi5fZGF0YShlLG4pLHImJighaXx8Yi5pc0FycmF5KHIpP2k9Yi5fZGF0YShlLG4sYi5tYWtlQXJyYXkocikpOmkucHVzaChyKSksaXx8W10pOnR9LGRlcXVldWU6ZnVuY3Rpb24oZSx0KXt0PXR8fFwiZnhcIjt2YXIgbj1iLnF1ZXVlKGUsdCkscj1uLmxlbmd0aCxpPW4uc2hpZnQoKSxvPWIuX3F1ZXVlSG9va3MoZSx0KSxhPWZ1bmN0aW9uKCl7Yi5kZXF1ZXVlKGUsdCl9O1wiaW5wcm9ncmVzc1wiPT09aSYmKGk9bi5zaGlmdCgpLHItLSksby5jdXI9aSxpJiYoXCJmeFwiPT09dCYmbi51bnNoaWZ0KFwiaW5wcm9ncmVzc1wiKSxkZWxldGUgby5zdG9wLGkuY2FsbChlLGEsbykpLCFyJiZvJiZvLmVtcHR5LmZpcmUoKX0sX3F1ZXVlSG9va3M6ZnVuY3Rpb24oZSx0KXt2YXIgbj10K1wicXVldWVIb29rc1wiO3JldHVybiBiLl9kYXRhKGUsbil8fGIuX2RhdGEoZSxuLHtlbXB0eTpiLkNhbGxiYWNrcyhcIm9uY2UgbWVtb3J5XCIpLmFkZChmdW5jdGlvbigpe2IuX3JlbW92ZURhdGEoZSx0K1wicXVldWVcIiksYi5fcmVtb3ZlRGF0YShlLG4pfSl9KX19KSxiLmZuLmV4dGVuZCh7cXVldWU6ZnVuY3Rpb24oZSxuKXt2YXIgcj0yO3JldHVyblwic3RyaW5nXCIhPXR5cGVvZiBlJiYobj1lLGU9XCJmeFwiLHItLSkscj5hcmd1bWVudHMubGVuZ3RoP2IucXVldWUodGhpc1swXSxlKTpuPT09dD90aGlzOnRoaXMuZWFjaChmdW5jdGlvbigpe3ZhciB0PWIucXVldWUodGhpcyxlLG4pO2IuX3F1ZXVlSG9va3ModGhpcyxlKSxcImZ4XCI9PT1lJiZcImlucHJvZ3Jlc3NcIiE9PXRbMF0mJmIuZGVxdWV1ZSh0aGlzLGUpfSl9LGRlcXVldWU6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpe2IuZGVxdWV1ZSh0aGlzLGUpfSl9LGRlbGF5OmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGU9Yi5meD9iLmZ4LnNwZWVkc1tlXXx8ZTplLHQ9dHx8XCJmeFwiLHRoaXMucXVldWUodCxmdW5jdGlvbih0LG4pe3ZhciByPXNldFRpbWVvdXQodCxlKTtuLnN0b3A9ZnVuY3Rpb24oKXtjbGVhclRpbWVvdXQocil9fSl9LGNsZWFyUXVldWU6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMucXVldWUoZXx8XCJmeFwiLFtdKX0scHJvbWlzZTpmdW5jdGlvbihlLG4pe3ZhciByLGk9MSxvPWIuRGVmZXJyZWQoKSxhPXRoaXMscz10aGlzLmxlbmd0aCx1PWZ1bmN0aW9uKCl7LS1pfHxvLnJlc29sdmVXaXRoKGEsW2FdKX07XCJzdHJpbmdcIiE9dHlwZW9mIGUmJihuPWUsZT10KSxlPWV8fFwiZnhcIjt3aGlsZShzLS0pcj1iLl9kYXRhKGFbc10sZStcInF1ZXVlSG9va3NcIiksciYmci5lbXB0eSYmKGkrKyxyLmVtcHR5LmFkZCh1KSk7cmV0dXJuIHUoKSxvLnByb21pc2Uobil9fSk7dmFyIEkseixYPS9bXFx0XFxyXFxuXS9nLFU9L1xcci9nLFY9L14oPzppbnB1dHxzZWxlY3R8dGV4dGFyZWF8YnV0dG9ufG9iamVjdCkkL2ksWT0vXig/OmF8YXJlYSkkL2ksSj0vXig/OmNoZWNrZWR8c2VsZWN0ZWR8YXV0b2ZvY3VzfGF1dG9wbGF5fGFzeW5jfGNvbnRyb2xzfGRlZmVyfGRpc2FibGVkfGhpZGRlbnxsb29wfG11bHRpcGxlfG9wZW58cmVhZG9ubHl8cmVxdWlyZWR8c2NvcGVkKSQvaSxHPS9eKD86Y2hlY2tlZHxzZWxlY3RlZCkkL2ksUT1iLnN1cHBvcnQuZ2V0U2V0QXR0cmlidXRlLEs9Yi5zdXBwb3J0LmlucHV0O2IuZm4uZXh0ZW5kKHthdHRyOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGIuYWNjZXNzKHRoaXMsYi5hdHRyLGUsdCxhcmd1bWVudHMubGVuZ3RoPjEpfSxyZW1vdmVBdHRyOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXtiLnJlbW92ZUF0dHIodGhpcyxlKX0pfSxwcm9wOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGIuYWNjZXNzKHRoaXMsYi5wcm9wLGUsdCxhcmd1bWVudHMubGVuZ3RoPjEpfSxyZW1vdmVQcm9wOmZ1bmN0aW9uKGUpe3JldHVybiBlPWIucHJvcEZpeFtlXXx8ZSx0aGlzLmVhY2goZnVuY3Rpb24oKXt0cnl7dGhpc1tlXT10LGRlbGV0ZSB0aGlzW2VdfWNhdGNoKG4pe319KX0sYWRkQ2xhc3M6ZnVuY3Rpb24oZSl7dmFyIHQsbixyLGksbyxhPTAscz10aGlzLmxlbmd0aCx1PVwic3RyaW5nXCI9PXR5cGVvZiBlJiZlO2lmKGIuaXNGdW5jdGlvbihlKSlyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKHQpe2IodGhpcykuYWRkQ2xhc3MoZS5jYWxsKHRoaXMsdCx0aGlzLmNsYXNzTmFtZSkpfSk7aWYodSlmb3IodD0oZXx8XCJcIikubWF0Y2godyl8fFtdO3M+YTthKyspaWYobj10aGlzW2FdLHI9MT09PW4ubm9kZVR5cGUmJihuLmNsYXNzTmFtZT8oXCIgXCIrbi5jbGFzc05hbWUrXCIgXCIpLnJlcGxhY2UoWCxcIiBcIik6XCIgXCIpKXtvPTA7d2hpbGUoaT10W28rK10pMD5yLmluZGV4T2YoXCIgXCIraStcIiBcIikmJihyKz1pK1wiIFwiKTtuLmNsYXNzTmFtZT1iLnRyaW0ocil9cmV0dXJuIHRoaXN9LHJlbW92ZUNsYXNzOmZ1bmN0aW9uKGUpe3ZhciB0LG4scixpLG8sYT0wLHM9dGhpcy5sZW5ndGgsdT0wPT09YXJndW1lbnRzLmxlbmd0aHx8XCJzdHJpbmdcIj09dHlwZW9mIGUmJmU7aWYoYi5pc0Z1bmN0aW9uKGUpKXJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24odCl7Yih0aGlzKS5yZW1vdmVDbGFzcyhlLmNhbGwodGhpcyx0LHRoaXMuY2xhc3NOYW1lKSl9KTtpZih1KWZvcih0PShlfHxcIlwiKS5tYXRjaCh3KXx8W107cz5hO2ErKylpZihuPXRoaXNbYV0scj0xPT09bi5ub2RlVHlwZSYmKG4uY2xhc3NOYW1lPyhcIiBcIituLmNsYXNzTmFtZStcIiBcIikucmVwbGFjZShYLFwiIFwiKTpcIlwiKSl7bz0wO3doaWxlKGk9dFtvKytdKXdoaWxlKHIuaW5kZXhPZihcIiBcIitpK1wiIFwiKT49MClyPXIucmVwbGFjZShcIiBcIitpK1wiIFwiLFwiIFwiKTtuLmNsYXNzTmFtZT1lP2IudHJpbShyKTpcIlwifXJldHVybiB0aGlzfSx0b2dnbGVDbGFzczpmdW5jdGlvbihlLHQpe3ZhciBuPXR5cGVvZiBlLHI9XCJib29sZWFuXCI9PXR5cGVvZiB0O3JldHVybiBiLmlzRnVuY3Rpb24oZSk/dGhpcy5lYWNoKGZ1bmN0aW9uKG4pe2IodGhpcykudG9nZ2xlQ2xhc3MoZS5jYWxsKHRoaXMsbix0aGlzLmNsYXNzTmFtZSx0KSx0KX0pOnRoaXMuZWFjaChmdW5jdGlvbigpe2lmKFwic3RyaW5nXCI9PT1uKXt2YXIgbyxhPTAscz1iKHRoaXMpLHU9dCxsPWUubWF0Y2godyl8fFtdO3doaWxlKG89bFthKytdKXU9cj91OiFzLmhhc0NsYXNzKG8pLHNbdT9cImFkZENsYXNzXCI6XCJyZW1vdmVDbGFzc1wiXShvKX1lbHNlKG49PT1pfHxcImJvb2xlYW5cIj09PW4pJiYodGhpcy5jbGFzc05hbWUmJmIuX2RhdGEodGhpcyxcIl9fY2xhc3NOYW1lX19cIix0aGlzLmNsYXNzTmFtZSksdGhpcy5jbGFzc05hbWU9dGhpcy5jbGFzc05hbWV8fGU9PT0hMT9cIlwiOmIuX2RhdGEodGhpcyxcIl9fY2xhc3NOYW1lX19cIil8fFwiXCIpfSl9LGhhc0NsYXNzOmZ1bmN0aW9uKGUpe3ZhciB0PVwiIFwiK2UrXCIgXCIsbj0wLHI9dGhpcy5sZW5ndGg7Zm9yKDtyPm47bisrKWlmKDE9PT10aGlzW25dLm5vZGVUeXBlJiYoXCIgXCIrdGhpc1tuXS5jbGFzc05hbWUrXCIgXCIpLnJlcGxhY2UoWCxcIiBcIikuaW5kZXhPZih0KT49MClyZXR1cm4hMDtyZXR1cm4hMX0sdmFsOmZ1bmN0aW9uKGUpe3ZhciBuLHIsaSxvPXRoaXNbMF07e2lmKGFyZ3VtZW50cy5sZW5ndGgpcmV0dXJuIGk9Yi5pc0Z1bmN0aW9uKGUpLHRoaXMuZWFjaChmdW5jdGlvbihuKXt2YXIgbyxhPWIodGhpcyk7MT09PXRoaXMubm9kZVR5cGUmJihvPWk/ZS5jYWxsKHRoaXMsbixhLnZhbCgpKTplLG51bGw9PW8/bz1cIlwiOlwibnVtYmVyXCI9PXR5cGVvZiBvP28rPVwiXCI6Yi5pc0FycmF5KG8pJiYobz1iLm1hcChvLGZ1bmN0aW9uKGUpe3JldHVybiBudWxsPT1lP1wiXCI6ZStcIlwifSkpLHI9Yi52YWxIb29rc1t0aGlzLnR5cGVdfHxiLnZhbEhvb2tzW3RoaXMubm9kZU5hbWUudG9Mb3dlckNhc2UoKV0sciYmXCJzZXRcImluIHImJnIuc2V0KHRoaXMsbyxcInZhbHVlXCIpIT09dHx8KHRoaXMudmFsdWU9bykpfSk7aWYobylyZXR1cm4gcj1iLnZhbEhvb2tzW28udHlwZV18fGIudmFsSG9va3Nbby5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpXSxyJiZcImdldFwiaW4gciYmKG49ci5nZXQobyxcInZhbHVlXCIpKSE9PXQ/bjoobj1vLnZhbHVlLFwic3RyaW5nXCI9PXR5cGVvZiBuP24ucmVwbGFjZShVLFwiXCIpOm51bGw9PW4/XCJcIjpuKX19fSksYi5leHRlbmQoe3ZhbEhvb2tzOntvcHRpb246e2dldDpmdW5jdGlvbihlKXt2YXIgdD1lLmF0dHJpYnV0ZXMudmFsdWU7cmV0dXJuIXR8fHQuc3BlY2lmaWVkP2UudmFsdWU6ZS50ZXh0fX0sc2VsZWN0OntnZXQ6ZnVuY3Rpb24oZSl7dmFyIHQsbixyPWUub3B0aW9ucyxpPWUuc2VsZWN0ZWRJbmRleCxvPVwic2VsZWN0LW9uZVwiPT09ZS50eXBlfHwwPmksYT1vP251bGw6W10scz1vP2krMTpyLmxlbmd0aCx1PTA+aT9zOm8/aTowO2Zvcig7cz51O3UrKylpZihuPXJbdV0sISghbi5zZWxlY3RlZCYmdSE9PWl8fChiLnN1cHBvcnQub3B0RGlzYWJsZWQ/bi5kaXNhYmxlZDpudWxsIT09bi5nZXRBdHRyaWJ1dGUoXCJkaXNhYmxlZFwiKSl8fG4ucGFyZW50Tm9kZS5kaXNhYmxlZCYmYi5ub2RlTmFtZShuLnBhcmVudE5vZGUsXCJvcHRncm91cFwiKSkpe2lmKHQ9YihuKS52YWwoKSxvKXJldHVybiB0O2EucHVzaCh0KX1yZXR1cm4gYX0sc2V0OmZ1bmN0aW9uKGUsdCl7dmFyIG49Yi5tYWtlQXJyYXkodCk7cmV0dXJuIGIoZSkuZmluZChcIm9wdGlvblwiKS5lYWNoKGZ1bmN0aW9uKCl7dGhpcy5zZWxlY3RlZD1iLmluQXJyYXkoYih0aGlzKS52YWwoKSxuKT49MH0pLG4ubGVuZ3RofHwoZS5zZWxlY3RlZEluZGV4PS0xKSxufX19LGF0dHI6ZnVuY3Rpb24oZSxuLHIpe3ZhciBvLGEscyx1PWUubm9kZVR5cGU7aWYoZSYmMyE9PXUmJjghPT11JiYyIT09dSlyZXR1cm4gdHlwZW9mIGUuZ2V0QXR0cmlidXRlPT09aT9iLnByb3AoZSxuLHIpOihhPTEhPT11fHwhYi5pc1hNTERvYyhlKSxhJiYobj1uLnRvTG93ZXJDYXNlKCksbz1iLmF0dHJIb29rc1tuXXx8KEoudGVzdChuKT96OkkpKSxyPT09dD9vJiZhJiZcImdldFwiaW4gbyYmbnVsbCE9PShzPW8uZ2V0KGUsbikpP3M6KHR5cGVvZiBlLmdldEF0dHJpYnV0ZSE9PWkmJihzPWUuZ2V0QXR0cmlidXRlKG4pKSxudWxsPT1zP3Q6cyk6bnVsbCE9PXI/byYmYSYmXCJzZXRcImluIG8mJihzPW8uc2V0KGUscixuKSkhPT10P3M6KGUuc2V0QXR0cmlidXRlKG4scitcIlwiKSxyKTooYi5yZW1vdmVBdHRyKGUsbiksdCkpfSxyZW1vdmVBdHRyOmZ1bmN0aW9uKGUsdCl7dmFyIG4scixpPTAsbz10JiZ0Lm1hdGNoKHcpO2lmKG8mJjE9PT1lLm5vZGVUeXBlKXdoaWxlKG49b1tpKytdKXI9Yi5wcm9wRml4W25dfHxuLEoudGVzdChuKT8hUSYmRy50ZXN0KG4pP2VbYi5jYW1lbENhc2UoXCJkZWZhdWx0LVwiK24pXT1lW3JdPSExOmVbcl09ITE6Yi5hdHRyKGUsbixcIlwiKSxlLnJlbW92ZUF0dHJpYnV0ZShRP246cil9LGF0dHJIb29rczp7dHlwZTp7c2V0OmZ1bmN0aW9uKGUsdCl7aWYoIWIuc3VwcG9ydC5yYWRpb1ZhbHVlJiZcInJhZGlvXCI9PT10JiZiLm5vZGVOYW1lKGUsXCJpbnB1dFwiKSl7dmFyIG49ZS52YWx1ZTtyZXR1cm4gZS5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsdCksbiYmKGUudmFsdWU9biksdH19fX0scHJvcEZpeDp7dGFiaW5kZXg6XCJ0YWJJbmRleFwiLHJlYWRvbmx5OlwicmVhZE9ubHlcIixcImZvclwiOlwiaHRtbEZvclwiLFwiY2xhc3NcIjpcImNsYXNzTmFtZVwiLG1heGxlbmd0aDpcIm1heExlbmd0aFwiLGNlbGxzcGFjaW5nOlwiY2VsbFNwYWNpbmdcIixjZWxscGFkZGluZzpcImNlbGxQYWRkaW5nXCIscm93c3BhbjpcInJvd1NwYW5cIixjb2xzcGFuOlwiY29sU3BhblwiLHVzZW1hcDpcInVzZU1hcFwiLGZyYW1lYm9yZGVyOlwiZnJhbWVCb3JkZXJcIixjb250ZW50ZWRpdGFibGU6XCJjb250ZW50RWRpdGFibGVcIn0scHJvcDpmdW5jdGlvbihlLG4scil7dmFyIGksbyxhLHM9ZS5ub2RlVHlwZTtpZihlJiYzIT09cyYmOCE9PXMmJjIhPT1zKXJldHVybiBhPTEhPT1zfHwhYi5pc1hNTERvYyhlKSxhJiYobj1iLnByb3BGaXhbbl18fG4sbz1iLnByb3BIb29rc1tuXSksciE9PXQ/byYmXCJzZXRcImluIG8mJihpPW8uc2V0KGUscixuKSkhPT10P2k6ZVtuXT1yOm8mJlwiZ2V0XCJpbiBvJiZudWxsIT09KGk9by5nZXQoZSxuKSk/aTplW25dfSxwcm9wSG9va3M6e3RhYkluZGV4OntnZXQ6ZnVuY3Rpb24oZSl7dmFyIG49ZS5nZXRBdHRyaWJ1dGVOb2RlKFwidGFiaW5kZXhcIik7cmV0dXJuIG4mJm4uc3BlY2lmaWVkP3BhcnNlSW50KG4udmFsdWUsMTApOlYudGVzdChlLm5vZGVOYW1lKXx8WS50ZXN0KGUubm9kZU5hbWUpJiZlLmhyZWY/MDp0fX19fSksej17Z2V0OmZ1bmN0aW9uKGUsbil7dmFyIHI9Yi5wcm9wKGUsbiksaT1cImJvb2xlYW5cIj09dHlwZW9mIHImJmUuZ2V0QXR0cmlidXRlKG4pLG89XCJib29sZWFuXCI9PXR5cGVvZiByP0smJlE/bnVsbCE9aTpHLnRlc3Qobik/ZVtiLmNhbWVsQ2FzZShcImRlZmF1bHQtXCIrbildOiEhaTplLmdldEF0dHJpYnV0ZU5vZGUobik7cmV0dXJuIG8mJm8udmFsdWUhPT0hMT9uLnRvTG93ZXJDYXNlKCk6dH0sc2V0OmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gdD09PSExP2IucmVtb3ZlQXR0cihlLG4pOksmJlF8fCFHLnRlc3Qobik/ZS5zZXRBdHRyaWJ1dGUoIVEmJmIucHJvcEZpeFtuXXx8bixuKTplW2IuY2FtZWxDYXNlKFwiZGVmYXVsdC1cIituKV09ZVtuXT0hMCxufX0sSyYmUXx8KGIuYXR0ckhvb2tzLnZhbHVlPXtnZXQ6ZnVuY3Rpb24oZSxuKXt2YXIgcj1lLmdldEF0dHJpYnV0ZU5vZGUobik7cmV0dXJuIGIubm9kZU5hbWUoZSxcImlucHV0XCIpP2UuZGVmYXVsdFZhbHVlOnImJnIuc3BlY2lmaWVkP3IudmFsdWU6dH0sc2V0OmZ1bmN0aW9uKGUsbixyKXtyZXR1cm4gYi5ub2RlTmFtZShlLFwiaW5wdXRcIik/KGUuZGVmYXVsdFZhbHVlPW4sdCk6SSYmSS5zZXQoZSxuLHIpfX0pLFF8fChJPWIudmFsSG9va3MuYnV0dG9uPXtnZXQ6ZnVuY3Rpb24oZSxuKXt2YXIgcj1lLmdldEF0dHJpYnV0ZU5vZGUobik7cmV0dXJuIHImJihcImlkXCI9PT1ufHxcIm5hbWVcIj09PW58fFwiY29vcmRzXCI9PT1uP1wiXCIhPT1yLnZhbHVlOnIuc3BlY2lmaWVkKT9yLnZhbHVlOnR9LHNldDpmdW5jdGlvbihlLG4scil7dmFyIGk9ZS5nZXRBdHRyaWJ1dGVOb2RlKHIpO3JldHVybiBpfHxlLnNldEF0dHJpYnV0ZU5vZGUoaT1lLm93bmVyRG9jdW1lbnQuY3JlYXRlQXR0cmlidXRlKHIpKSxpLnZhbHVlPW4rPVwiXCIsXCJ2YWx1ZVwiPT09cnx8bj09PWUuZ2V0QXR0cmlidXRlKHIpP246dH19LGIuYXR0ckhvb2tzLmNvbnRlbnRlZGl0YWJsZT17Z2V0OkkuZ2V0LHNldDpmdW5jdGlvbihlLHQsbil7SS5zZXQoZSxcIlwiPT09dD8hMTp0LG4pfX0sYi5lYWNoKFtcIndpZHRoXCIsXCJoZWlnaHRcIl0sZnVuY3Rpb24oZSxuKXtiLmF0dHJIb29rc1tuXT1iLmV4dGVuZChiLmF0dHJIb29rc1tuXSx7c2V0OmZ1bmN0aW9uKGUscil7cmV0dXJuXCJcIj09PXI/KGUuc2V0QXR0cmlidXRlKG4sXCJhdXRvXCIpLHIpOnR9fSl9KSksYi5zdXBwb3J0LmhyZWZOb3JtYWxpemVkfHwoYi5lYWNoKFtcImhyZWZcIixcInNyY1wiLFwid2lkdGhcIixcImhlaWdodFwiXSxmdW5jdGlvbihlLG4pe2IuYXR0ckhvb2tzW25dPWIuZXh0ZW5kKGIuYXR0ckhvb2tzW25dLHtnZXQ6ZnVuY3Rpb24oZSl7dmFyIHI9ZS5nZXRBdHRyaWJ1dGUobiwyKTtyZXR1cm4gbnVsbD09cj90OnJ9fSl9KSxiLmVhY2goW1wiaHJlZlwiLFwic3JjXCJdLGZ1bmN0aW9uKGUsdCl7Yi5wcm9wSG9va3NbdF09e2dldDpmdW5jdGlvbihlKXtyZXR1cm4gZS5nZXRBdHRyaWJ1dGUodCw0KX19fSkpLGIuc3VwcG9ydC5zdHlsZXx8KGIuYXR0ckhvb2tzLnN0eWxlPXtnZXQ6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuc3R5bGUuY3NzVGV4dHx8dH0sc2V0OmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGUuc3R5bGUuY3NzVGV4dD10K1wiXCJ9fSksYi5zdXBwb3J0Lm9wdFNlbGVjdGVkfHwoYi5wcm9wSG9va3Muc2VsZWN0ZWQ9Yi5leHRlbmQoYi5wcm9wSG9va3Muc2VsZWN0ZWQse2dldDpmdW5jdGlvbihlKXt2YXIgdD1lLnBhcmVudE5vZGU7cmV0dXJuIHQmJih0LnNlbGVjdGVkSW5kZXgsdC5wYXJlbnROb2RlJiZ0LnBhcmVudE5vZGUuc2VsZWN0ZWRJbmRleCksbnVsbH19KSksYi5zdXBwb3J0LmVuY3R5cGV8fChiLnByb3BGaXguZW5jdHlwZT1cImVuY29kaW5nXCIpLGIuc3VwcG9ydC5jaGVja09ufHxiLmVhY2goW1wicmFkaW9cIixcImNoZWNrYm94XCJdLGZ1bmN0aW9uKCl7Yi52YWxIb29rc1t0aGlzXT17Z2V0OmZ1bmN0aW9uKGUpe3JldHVybiBudWxsPT09ZS5nZXRBdHRyaWJ1dGUoXCJ2YWx1ZVwiKT9cIm9uXCI6ZS52YWx1ZX19fSksYi5lYWNoKFtcInJhZGlvXCIsXCJjaGVja2JveFwiXSxmdW5jdGlvbigpe2IudmFsSG9va3NbdGhpc109Yi5leHRlbmQoYi52YWxIb29rc1t0aGlzXSx7c2V0OmZ1bmN0aW9uKGUsbil7cmV0dXJuIGIuaXNBcnJheShuKT9lLmNoZWNrZWQ9Yi5pbkFycmF5KGIoZSkudmFsKCksbik+PTA6dH19KX0pO3ZhciBaPS9eKD86aW5wdXR8c2VsZWN0fHRleHRhcmVhKSQvaSxldD0vXmtleS8sdHQ9L14oPzptb3VzZXxjb250ZXh0bWVudSl8Y2xpY2svLG50PS9eKD86Zm9jdXNpbmZvY3VzfGZvY3Vzb3V0Ymx1cikkLyxydD0vXihbXi5dKikoPzpcXC4oLispfCkkLztmdW5jdGlvbiBpdCgpe3JldHVybiEwfWZ1bmN0aW9uIG90KCl7cmV0dXJuITF9Yi5ldmVudD17Z2xvYmFsOnt9LGFkZDpmdW5jdGlvbihlLG4scixvLGEpe3ZhciBzLHUsbCxjLHAsZixkLGgsZyxtLHksdj1iLl9kYXRhKGUpO2lmKHYpe3IuaGFuZGxlciYmKGM9cixyPWMuaGFuZGxlcixhPWMuc2VsZWN0b3IpLHIuZ3VpZHx8KHIuZ3VpZD1iLmd1aWQrKyksKHU9di5ldmVudHMpfHwodT12LmV2ZW50cz17fSksKGY9di5oYW5kbGUpfHwoZj12LmhhbmRsZT1mdW5jdGlvbihlKXtyZXR1cm4gdHlwZW9mIGI9PT1pfHxlJiZiLmV2ZW50LnRyaWdnZXJlZD09PWUudHlwZT90OmIuZXZlbnQuZGlzcGF0Y2guYXBwbHkoZi5lbGVtLGFyZ3VtZW50cyl9LGYuZWxlbT1lKSxuPShufHxcIlwiKS5tYXRjaCh3KXx8W1wiXCJdLGw9bi5sZW5ndGg7d2hpbGUobC0tKXM9cnQuZXhlYyhuW2xdKXx8W10sZz15PXNbMV0sbT0oc1syXXx8XCJcIikuc3BsaXQoXCIuXCIpLnNvcnQoKSxwPWIuZXZlbnQuc3BlY2lhbFtnXXx8e30sZz0oYT9wLmRlbGVnYXRlVHlwZTpwLmJpbmRUeXBlKXx8ZyxwPWIuZXZlbnQuc3BlY2lhbFtnXXx8e30sZD1iLmV4dGVuZCh7dHlwZTpnLG9yaWdUeXBlOnksZGF0YTpvLGhhbmRsZXI6cixndWlkOnIuZ3VpZCxzZWxlY3RvcjphLG5lZWRzQ29udGV4dDphJiZiLmV4cHIubWF0Y2gubmVlZHNDb250ZXh0LnRlc3QoYSksbmFtZXNwYWNlOm0uam9pbihcIi5cIil9LGMpLChoPXVbZ10pfHwoaD11W2ddPVtdLGguZGVsZWdhdGVDb3VudD0wLHAuc2V0dXAmJnAuc2V0dXAuY2FsbChlLG8sbSxmKSE9PSExfHwoZS5hZGRFdmVudExpc3RlbmVyP2UuYWRkRXZlbnRMaXN0ZW5lcihnLGYsITEpOmUuYXR0YWNoRXZlbnQmJmUuYXR0YWNoRXZlbnQoXCJvblwiK2csZikpKSxwLmFkZCYmKHAuYWRkLmNhbGwoZSxkKSxkLmhhbmRsZXIuZ3VpZHx8KGQuaGFuZGxlci5ndWlkPXIuZ3VpZCkpLGE/aC5zcGxpY2UoaC5kZWxlZ2F0ZUNvdW50KyssMCxkKTpoLnB1c2goZCksYi5ldmVudC5nbG9iYWxbZ109ITA7ZT1udWxsfX0scmVtb3ZlOmZ1bmN0aW9uKGUsdCxuLHIsaSl7dmFyIG8sYSxzLHUsbCxjLHAsZixkLGgsZyxtPWIuaGFzRGF0YShlKSYmYi5fZGF0YShlKTtpZihtJiYoYz1tLmV2ZW50cykpe3Q9KHR8fFwiXCIpLm1hdGNoKHcpfHxbXCJcIl0sbD10Lmxlbmd0aDt3aGlsZShsLS0paWYocz1ydC5leGVjKHRbbF0pfHxbXSxkPWc9c1sxXSxoPShzWzJdfHxcIlwiKS5zcGxpdChcIi5cIikuc29ydCgpLGQpe3A9Yi5ldmVudC5zcGVjaWFsW2RdfHx7fSxkPShyP3AuZGVsZWdhdGVUeXBlOnAuYmluZFR5cGUpfHxkLGY9Y1tkXXx8W10scz1zWzJdJiZSZWdFeHAoXCIoXnxcXFxcLilcIitoLmpvaW4oXCJcXFxcLig/Oi4qXFxcXC58KVwiKStcIihcXFxcLnwkKVwiKSx1PW89Zi5sZW5ndGg7d2hpbGUoby0tKWE9ZltvXSwhaSYmZyE9PWEub3JpZ1R5cGV8fG4mJm4uZ3VpZCE9PWEuZ3VpZHx8cyYmIXMudGVzdChhLm5hbWVzcGFjZSl8fHImJnIhPT1hLnNlbGVjdG9yJiYoXCIqKlwiIT09cnx8IWEuc2VsZWN0b3IpfHwoZi5zcGxpY2UobywxKSxhLnNlbGVjdG9yJiZmLmRlbGVnYXRlQ291bnQtLSxwLnJlbW92ZSYmcC5yZW1vdmUuY2FsbChlLGEpKTt1JiYhZi5sZW5ndGgmJihwLnRlYXJkb3duJiZwLnRlYXJkb3duLmNhbGwoZSxoLG0uaGFuZGxlKSE9PSExfHxiLnJlbW92ZUV2ZW50KGUsZCxtLmhhbmRsZSksZGVsZXRlIGNbZF0pfWVsc2UgZm9yKGQgaW4gYyliLmV2ZW50LnJlbW92ZShlLGQrdFtsXSxuLHIsITApO2IuaXNFbXB0eU9iamVjdChjKSYmKGRlbGV0ZSBtLmhhbmRsZSxiLl9yZW1vdmVEYXRhKGUsXCJldmVudHNcIikpfX0sdHJpZ2dlcjpmdW5jdGlvbihuLHIsaSxhKXt2YXIgcyx1LGwsYyxwLGYsZCxoPVtpfHxvXSxnPXkuY2FsbChuLFwidHlwZVwiKT9uLnR5cGU6bixtPXkuY2FsbChuLFwibmFtZXNwYWNlXCIpP24ubmFtZXNwYWNlLnNwbGl0KFwiLlwiKTpbXTtpZihsPWY9aT1pfHxvLDMhPT1pLm5vZGVUeXBlJiY4IT09aS5ub2RlVHlwZSYmIW50LnRlc3QoZytiLmV2ZW50LnRyaWdnZXJlZCkmJihnLmluZGV4T2YoXCIuXCIpPj0wJiYobT1nLnNwbGl0KFwiLlwiKSxnPW0uc2hpZnQoKSxtLnNvcnQoKSksdT0wPmcuaW5kZXhPZihcIjpcIikmJlwib25cIitnLG49bltiLmV4cGFuZG9dP246bmV3IGIuRXZlbnQoZyxcIm9iamVjdFwiPT10eXBlb2YgbiYmbiksbi5pc1RyaWdnZXI9ITAsbi5uYW1lc3BhY2U9bS5qb2luKFwiLlwiKSxuLm5hbWVzcGFjZV9yZT1uLm5hbWVzcGFjZT9SZWdFeHAoXCIoXnxcXFxcLilcIittLmpvaW4oXCJcXFxcLig/Oi4qXFxcXC58KVwiKStcIihcXFxcLnwkKVwiKTpudWxsLG4ucmVzdWx0PXQsbi50YXJnZXR8fChuLnRhcmdldD1pKSxyPW51bGw9PXI/W25dOmIubWFrZUFycmF5KHIsW25dKSxwPWIuZXZlbnQuc3BlY2lhbFtnXXx8e30sYXx8IXAudHJpZ2dlcnx8cC50cmlnZ2VyLmFwcGx5KGkscikhPT0hMSkpe2lmKCFhJiYhcC5ub0J1YmJsZSYmIWIuaXNXaW5kb3coaSkpe2ZvcihjPXAuZGVsZWdhdGVUeXBlfHxnLG50LnRlc3QoYytnKXx8KGw9bC5wYXJlbnROb2RlKTtsO2w9bC5wYXJlbnROb2RlKWgucHVzaChsKSxmPWw7Zj09PShpLm93bmVyRG9jdW1lbnR8fG8pJiZoLnB1c2goZi5kZWZhdWx0Vmlld3x8Zi5wYXJlbnRXaW5kb3d8fGUpfWQ9MDt3aGlsZSgobD1oW2QrK10pJiYhbi5pc1Byb3BhZ2F0aW9uU3RvcHBlZCgpKW4udHlwZT1kPjE/YzpwLmJpbmRUeXBlfHxnLHM9KGIuX2RhdGEobCxcImV2ZW50c1wiKXx8e30pW24udHlwZV0mJmIuX2RhdGEobCxcImhhbmRsZVwiKSxzJiZzLmFwcGx5KGwscikscz11JiZsW3VdLHMmJmIuYWNjZXB0RGF0YShsKSYmcy5hcHBseSYmcy5hcHBseShsLHIpPT09ITEmJm4ucHJldmVudERlZmF1bHQoKTtpZihuLnR5cGU9ZywhKGF8fG4uaXNEZWZhdWx0UHJldmVudGVkKCl8fHAuX2RlZmF1bHQmJnAuX2RlZmF1bHQuYXBwbHkoaS5vd25lckRvY3VtZW50LHIpIT09ITF8fFwiY2xpY2tcIj09PWcmJmIubm9kZU5hbWUoaSxcImFcIil8fCFiLmFjY2VwdERhdGEoaSl8fCF1fHwhaVtnXXx8Yi5pc1dpbmRvdyhpKSkpe2Y9aVt1XSxmJiYoaVt1XT1udWxsKSxiLmV2ZW50LnRyaWdnZXJlZD1nO3RyeXtpW2ddKCl9Y2F0Y2godil7fWIuZXZlbnQudHJpZ2dlcmVkPXQsZiYmKGlbdV09Zil9cmV0dXJuIG4ucmVzdWx0fX0sZGlzcGF0Y2g6ZnVuY3Rpb24oZSl7ZT1iLmV2ZW50LmZpeChlKTt2YXIgbixyLGksbyxhLHM9W10sdT1oLmNhbGwoYXJndW1lbnRzKSxsPShiLl9kYXRhKHRoaXMsXCJldmVudHNcIil8fHt9KVtlLnR5cGVdfHxbXSxjPWIuZXZlbnQuc3BlY2lhbFtlLnR5cGVdfHx7fTtpZih1WzBdPWUsZS5kZWxlZ2F0ZVRhcmdldD10aGlzLCFjLnByZURpc3BhdGNofHxjLnByZURpc3BhdGNoLmNhbGwodGhpcyxlKSE9PSExKXtzPWIuZXZlbnQuaGFuZGxlcnMuY2FsbCh0aGlzLGUsbCksbj0wO3doaWxlKChvPXNbbisrXSkmJiFlLmlzUHJvcGFnYXRpb25TdG9wcGVkKCkpe2UuY3VycmVudFRhcmdldD1vLmVsZW0sYT0wO3doaWxlKChpPW8uaGFuZGxlcnNbYSsrXSkmJiFlLmlzSW1tZWRpYXRlUHJvcGFnYXRpb25TdG9wcGVkKCkpKCFlLm5hbWVzcGFjZV9yZXx8ZS5uYW1lc3BhY2VfcmUudGVzdChpLm5hbWVzcGFjZSkpJiYoZS5oYW5kbGVPYmo9aSxlLmRhdGE9aS5kYXRhLHI9KChiLmV2ZW50LnNwZWNpYWxbaS5vcmlnVHlwZV18fHt9KS5oYW5kbGV8fGkuaGFuZGxlcikuYXBwbHkoby5lbGVtLHUpLHIhPT10JiYoZS5yZXN1bHQ9cik9PT0hMSYmKGUucHJldmVudERlZmF1bHQoKSxlLnN0b3BQcm9wYWdhdGlvbigpKSl9cmV0dXJuIGMucG9zdERpc3BhdGNoJiZjLnBvc3REaXNwYXRjaC5jYWxsKHRoaXMsZSksZS5yZXN1bHR9fSxoYW5kbGVyczpmdW5jdGlvbihlLG4pe3ZhciByLGksbyxhLHM9W10sdT1uLmRlbGVnYXRlQ291bnQsbD1lLnRhcmdldDtpZih1JiZsLm5vZGVUeXBlJiYoIWUuYnV0dG9ufHxcImNsaWNrXCIhPT1lLnR5cGUpKWZvcig7bCE9dGhpcztsPWwucGFyZW50Tm9kZXx8dGhpcylpZigxPT09bC5ub2RlVHlwZSYmKGwuZGlzYWJsZWQhPT0hMHx8XCJjbGlja1wiIT09ZS50eXBlKSl7Zm9yKG89W10sYT0wO3U+YTthKyspaT1uW2FdLHI9aS5zZWxlY3RvcitcIiBcIixvW3JdPT09dCYmKG9bcl09aS5uZWVkc0NvbnRleHQ/YihyLHRoaXMpLmluZGV4KGwpPj0wOmIuZmluZChyLHRoaXMsbnVsbCxbbF0pLmxlbmd0aCksb1tyXSYmby5wdXNoKGkpO28ubGVuZ3RoJiZzLnB1c2goe2VsZW06bCxoYW5kbGVyczpvfSl9cmV0dXJuIG4ubGVuZ3RoPnUmJnMucHVzaCh7ZWxlbTp0aGlzLGhhbmRsZXJzOm4uc2xpY2UodSl9KSxzfSxmaXg6ZnVuY3Rpb24oZSl7aWYoZVtiLmV4cGFuZG9dKXJldHVybiBlO3ZhciB0LG4scixpPWUudHlwZSxhPWUscz10aGlzLmZpeEhvb2tzW2ldO3N8fCh0aGlzLmZpeEhvb2tzW2ldPXM9dHQudGVzdChpKT90aGlzLm1vdXNlSG9va3M6ZXQudGVzdChpKT90aGlzLmtleUhvb2tzOnt9KSxyPXMucHJvcHM/dGhpcy5wcm9wcy5jb25jYXQocy5wcm9wcyk6dGhpcy5wcm9wcyxlPW5ldyBiLkV2ZW50KGEpLHQ9ci5sZW5ndGg7d2hpbGUodC0tKW49clt0XSxlW25dPWFbbl07cmV0dXJuIGUudGFyZ2V0fHwoZS50YXJnZXQ9YS5zcmNFbGVtZW50fHxvKSwzPT09ZS50YXJnZXQubm9kZVR5cGUmJihlLnRhcmdldD1lLnRhcmdldC5wYXJlbnROb2RlKSxlLm1ldGFLZXk9ISFlLm1ldGFLZXkscy5maWx0ZXI/cy5maWx0ZXIoZSxhKTplfSxwcm9wczpcImFsdEtleSBidWJibGVzIGNhbmNlbGFibGUgY3RybEtleSBjdXJyZW50VGFyZ2V0IGV2ZW50UGhhc2UgbWV0YUtleSByZWxhdGVkVGFyZ2V0IHNoaWZ0S2V5IHRhcmdldCB0aW1lU3RhbXAgdmlldyB3aGljaFwiLnNwbGl0KFwiIFwiKSxmaXhIb29rczp7fSxrZXlIb29rczp7cHJvcHM6XCJjaGFyIGNoYXJDb2RlIGtleSBrZXlDb2RlXCIuc3BsaXQoXCIgXCIpLGZpbHRlcjpmdW5jdGlvbihlLHQpe3JldHVybiBudWxsPT1lLndoaWNoJiYoZS53aGljaD1udWxsIT10LmNoYXJDb2RlP3QuY2hhckNvZGU6dC5rZXlDb2RlKSxlfX0sbW91c2VIb29rczp7cHJvcHM6XCJidXR0b24gYnV0dG9ucyBjbGllbnRYIGNsaWVudFkgZnJvbUVsZW1lbnQgb2Zmc2V0WCBvZmZzZXRZIHBhZ2VYIHBhZ2VZIHNjcmVlblggc2NyZWVuWSB0b0VsZW1lbnRcIi5zcGxpdChcIiBcIiksZmlsdGVyOmZ1bmN0aW9uKGUsbil7dmFyIHIsaSxhLHM9bi5idXR0b24sdT1uLmZyb21FbGVtZW50O3JldHVybiBudWxsPT1lLnBhZ2VYJiZudWxsIT1uLmNsaWVudFgmJihpPWUudGFyZ2V0Lm93bmVyRG9jdW1lbnR8fG8sYT1pLmRvY3VtZW50RWxlbWVudCxyPWkuYm9keSxlLnBhZ2VYPW4uY2xpZW50WCsoYSYmYS5zY3JvbGxMZWZ0fHxyJiZyLnNjcm9sbExlZnR8fDApLShhJiZhLmNsaWVudExlZnR8fHImJnIuY2xpZW50TGVmdHx8MCksZS5wYWdlWT1uLmNsaWVudFkrKGEmJmEuc2Nyb2xsVG9wfHxyJiZyLnNjcm9sbFRvcHx8MCktKGEmJmEuY2xpZW50VG9wfHxyJiZyLmNsaWVudFRvcHx8MCkpLCFlLnJlbGF0ZWRUYXJnZXQmJnUmJihlLnJlbGF0ZWRUYXJnZXQ9dT09PWUudGFyZ2V0P24udG9FbGVtZW50OnUpLGUud2hpY2h8fHM9PT10fHwoZS53aGljaD0xJnM/MToyJnM/Mzo0JnM/MjowKSxlfX0sc3BlY2lhbDp7bG9hZDp7bm9CdWJibGU6ITB9LGNsaWNrOnt0cmlnZ2VyOmZ1bmN0aW9uKCl7cmV0dXJuIGIubm9kZU5hbWUodGhpcyxcImlucHV0XCIpJiZcImNoZWNrYm94XCI9PT10aGlzLnR5cGUmJnRoaXMuY2xpY2s/KHRoaXMuY2xpY2soKSwhMSk6dH19LGZvY3VzOnt0cmlnZ2VyOmZ1bmN0aW9uKCl7aWYodGhpcyE9PW8uYWN0aXZlRWxlbWVudCYmdGhpcy5mb2N1cyl0cnl7cmV0dXJuIHRoaXMuZm9jdXMoKSwhMX1jYXRjaChlKXt9fSxkZWxlZ2F0ZVR5cGU6XCJmb2N1c2luXCJ9LGJsdXI6e3RyaWdnZXI6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcz09PW8uYWN0aXZlRWxlbWVudCYmdGhpcy5ibHVyPyh0aGlzLmJsdXIoKSwhMSk6dH0sZGVsZWdhdGVUeXBlOlwiZm9jdXNvdXRcIn0sYmVmb3JldW5sb2FkOntwb3N0RGlzcGF0Y2g6ZnVuY3Rpb24oZSl7ZS5yZXN1bHQhPT10JiYoZS5vcmlnaW5hbEV2ZW50LnJldHVyblZhbHVlPWUucmVzdWx0KX19fSxzaW11bGF0ZTpmdW5jdGlvbihlLHQsbixyKXt2YXIgaT1iLmV4dGVuZChuZXcgYi5FdmVudCxuLHt0eXBlOmUsaXNTaW11bGF0ZWQ6ITAsb3JpZ2luYWxFdmVudDp7fX0pO3I/Yi5ldmVudC50cmlnZ2VyKGksbnVsbCx0KTpiLmV2ZW50LmRpc3BhdGNoLmNhbGwodCxpKSxpLmlzRGVmYXVsdFByZXZlbnRlZCgpJiZuLnByZXZlbnREZWZhdWx0KCl9fSxiLnJlbW92ZUV2ZW50PW8ucmVtb3ZlRXZlbnRMaXN0ZW5lcj9mdW5jdGlvbihlLHQsbil7ZS5yZW1vdmVFdmVudExpc3RlbmVyJiZlLnJlbW92ZUV2ZW50TGlzdGVuZXIodCxuLCExKX06ZnVuY3Rpb24oZSx0LG4pe3ZhciByPVwib25cIit0O2UuZGV0YWNoRXZlbnQmJih0eXBlb2YgZVtyXT09PWkmJihlW3JdPW51bGwpLGUuZGV0YWNoRXZlbnQocixuKSl9LGIuRXZlbnQ9ZnVuY3Rpb24oZSxuKXtyZXR1cm4gdGhpcyBpbnN0YW5jZW9mIGIuRXZlbnQ/KGUmJmUudHlwZT8odGhpcy5vcmlnaW5hbEV2ZW50PWUsdGhpcy50eXBlPWUudHlwZSx0aGlzLmlzRGVmYXVsdFByZXZlbnRlZD1lLmRlZmF1bHRQcmV2ZW50ZWR8fGUucmV0dXJuVmFsdWU9PT0hMXx8ZS5nZXRQcmV2ZW50RGVmYXVsdCYmZS5nZXRQcmV2ZW50RGVmYXVsdCgpP2l0Om90KTp0aGlzLnR5cGU9ZSxuJiZiLmV4dGVuZCh0aGlzLG4pLHRoaXMudGltZVN0YW1wPWUmJmUudGltZVN0YW1wfHxiLm5vdygpLHRoaXNbYi5leHBhbmRvXT0hMCx0KTpuZXcgYi5FdmVudChlLG4pfSxiLkV2ZW50LnByb3RvdHlwZT17aXNEZWZhdWx0UHJldmVudGVkOm90LGlzUHJvcGFnYXRpb25TdG9wcGVkOm90LGlzSW1tZWRpYXRlUHJvcGFnYXRpb25TdG9wcGVkOm90LHByZXZlbnREZWZhdWx0OmZ1bmN0aW9uKCl7dmFyIGU9dGhpcy5vcmlnaW5hbEV2ZW50O3RoaXMuaXNEZWZhdWx0UHJldmVudGVkPWl0LGUmJihlLnByZXZlbnREZWZhdWx0P2UucHJldmVudERlZmF1bHQoKTplLnJldHVyblZhbHVlPSExKX0sc3RvcFByb3BhZ2F0aW9uOmZ1bmN0aW9uKCl7dmFyIGU9dGhpcy5vcmlnaW5hbEV2ZW50O3RoaXMuaXNQcm9wYWdhdGlvblN0b3BwZWQ9aXQsZSYmKGUuc3RvcFByb3BhZ2F0aW9uJiZlLnN0b3BQcm9wYWdhdGlvbigpLGUuY2FuY2VsQnViYmxlPSEwKX0sc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uOmZ1bmN0aW9uKCl7dGhpcy5pc0ltbWVkaWF0ZVByb3BhZ2F0aW9uU3RvcHBlZD1pdCx0aGlzLnN0b3BQcm9wYWdhdGlvbigpfX0sYi5lYWNoKHttb3VzZWVudGVyOlwibW91c2VvdmVyXCIsbW91c2VsZWF2ZTpcIm1vdXNlb3V0XCJ9LGZ1bmN0aW9uKGUsdCl7Yi5ldmVudC5zcGVjaWFsW2VdPXtkZWxlZ2F0ZVR5cGU6dCxiaW5kVHlwZTp0LGhhbmRsZTpmdW5jdGlvbihlKXt2YXIgbixyPXRoaXMsaT1lLnJlbGF0ZWRUYXJnZXQsbz1lLmhhbmRsZU9iajtcbnJldHVybighaXx8aSE9PXImJiFiLmNvbnRhaW5zKHIsaSkpJiYoZS50eXBlPW8ub3JpZ1R5cGUsbj1vLmhhbmRsZXIuYXBwbHkodGhpcyxhcmd1bWVudHMpLGUudHlwZT10KSxufX19KSxiLnN1cHBvcnQuc3VibWl0QnViYmxlc3x8KGIuZXZlbnQuc3BlY2lhbC5zdWJtaXQ9e3NldHVwOmZ1bmN0aW9uKCl7cmV0dXJuIGIubm9kZU5hbWUodGhpcyxcImZvcm1cIik/ITE6KGIuZXZlbnQuYWRkKHRoaXMsXCJjbGljay5fc3VibWl0IGtleXByZXNzLl9zdWJtaXRcIixmdW5jdGlvbihlKXt2YXIgbj1lLnRhcmdldCxyPWIubm9kZU5hbWUobixcImlucHV0XCIpfHxiLm5vZGVOYW1lKG4sXCJidXR0b25cIik/bi5mb3JtOnQ7ciYmIWIuX2RhdGEocixcInN1Ym1pdEJ1YmJsZXNcIikmJihiLmV2ZW50LmFkZChyLFwic3VibWl0Ll9zdWJtaXRcIixmdW5jdGlvbihlKXtlLl9zdWJtaXRfYnViYmxlPSEwfSksYi5fZGF0YShyLFwic3VibWl0QnViYmxlc1wiLCEwKSl9KSx0KX0scG9zdERpc3BhdGNoOmZ1bmN0aW9uKGUpe2UuX3N1Ym1pdF9idWJibGUmJihkZWxldGUgZS5fc3VibWl0X2J1YmJsZSx0aGlzLnBhcmVudE5vZGUmJiFlLmlzVHJpZ2dlciYmYi5ldmVudC5zaW11bGF0ZShcInN1Ym1pdFwiLHRoaXMucGFyZW50Tm9kZSxlLCEwKSl9LHRlYXJkb3duOmZ1bmN0aW9uKCl7cmV0dXJuIGIubm9kZU5hbWUodGhpcyxcImZvcm1cIik/ITE6KGIuZXZlbnQucmVtb3ZlKHRoaXMsXCIuX3N1Ym1pdFwiKSx0KX19KSxiLnN1cHBvcnQuY2hhbmdlQnViYmxlc3x8KGIuZXZlbnQuc3BlY2lhbC5jaGFuZ2U9e3NldHVwOmZ1bmN0aW9uKCl7cmV0dXJuIFoudGVzdCh0aGlzLm5vZGVOYW1lKT8oKFwiY2hlY2tib3hcIj09PXRoaXMudHlwZXx8XCJyYWRpb1wiPT09dGhpcy50eXBlKSYmKGIuZXZlbnQuYWRkKHRoaXMsXCJwcm9wZXJ0eWNoYW5nZS5fY2hhbmdlXCIsZnVuY3Rpb24oZSl7XCJjaGVja2VkXCI9PT1lLm9yaWdpbmFsRXZlbnQucHJvcGVydHlOYW1lJiYodGhpcy5fanVzdF9jaGFuZ2VkPSEwKX0pLGIuZXZlbnQuYWRkKHRoaXMsXCJjbGljay5fY2hhbmdlXCIsZnVuY3Rpb24oZSl7dGhpcy5fanVzdF9jaGFuZ2VkJiYhZS5pc1RyaWdnZXImJih0aGlzLl9qdXN0X2NoYW5nZWQ9ITEpLGIuZXZlbnQuc2ltdWxhdGUoXCJjaGFuZ2VcIix0aGlzLGUsITApfSkpLCExKTooYi5ldmVudC5hZGQodGhpcyxcImJlZm9yZWFjdGl2YXRlLl9jaGFuZ2VcIixmdW5jdGlvbihlKXt2YXIgdD1lLnRhcmdldDtaLnRlc3QodC5ub2RlTmFtZSkmJiFiLl9kYXRhKHQsXCJjaGFuZ2VCdWJibGVzXCIpJiYoYi5ldmVudC5hZGQodCxcImNoYW5nZS5fY2hhbmdlXCIsZnVuY3Rpb24oZSl7IXRoaXMucGFyZW50Tm9kZXx8ZS5pc1NpbXVsYXRlZHx8ZS5pc1RyaWdnZXJ8fGIuZXZlbnQuc2ltdWxhdGUoXCJjaGFuZ2VcIix0aGlzLnBhcmVudE5vZGUsZSwhMCl9KSxiLl9kYXRhKHQsXCJjaGFuZ2VCdWJibGVzXCIsITApKX0pLHQpfSxoYW5kbGU6ZnVuY3Rpb24oZSl7dmFyIG49ZS50YXJnZXQ7cmV0dXJuIHRoaXMhPT1ufHxlLmlzU2ltdWxhdGVkfHxlLmlzVHJpZ2dlcnx8XCJyYWRpb1wiIT09bi50eXBlJiZcImNoZWNrYm94XCIhPT1uLnR5cGU/ZS5oYW5kbGVPYmouaGFuZGxlci5hcHBseSh0aGlzLGFyZ3VtZW50cyk6dH0sdGVhcmRvd246ZnVuY3Rpb24oKXtyZXR1cm4gYi5ldmVudC5yZW1vdmUodGhpcyxcIi5fY2hhbmdlXCIpLCFaLnRlc3QodGhpcy5ub2RlTmFtZSl9fSksYi5zdXBwb3J0LmZvY3VzaW5CdWJibGVzfHxiLmVhY2goe2ZvY3VzOlwiZm9jdXNpblwiLGJsdXI6XCJmb2N1c291dFwifSxmdW5jdGlvbihlLHQpe3ZhciBuPTAscj1mdW5jdGlvbihlKXtiLmV2ZW50LnNpbXVsYXRlKHQsZS50YXJnZXQsYi5ldmVudC5maXgoZSksITApfTtiLmV2ZW50LnNwZWNpYWxbdF09e3NldHVwOmZ1bmN0aW9uKCl7MD09PW4rKyYmby5hZGRFdmVudExpc3RlbmVyKGUsciwhMCl9LHRlYXJkb3duOmZ1bmN0aW9uKCl7MD09PS0tbiYmby5yZW1vdmVFdmVudExpc3RlbmVyKGUsciwhMCl9fX0pLGIuZm4uZXh0ZW5kKHtvbjpmdW5jdGlvbihlLG4scixpLG8pe3ZhciBhLHM7aWYoXCJvYmplY3RcIj09dHlwZW9mIGUpe1wic3RyaW5nXCIhPXR5cGVvZiBuJiYocj1yfHxuLG49dCk7Zm9yKGEgaW4gZSl0aGlzLm9uKGEsbixyLGVbYV0sbyk7cmV0dXJuIHRoaXN9aWYobnVsbD09ciYmbnVsbD09aT8oaT1uLHI9bj10KTpudWxsPT1pJiYoXCJzdHJpbmdcIj09dHlwZW9mIG4/KGk9cixyPXQpOihpPXIscj1uLG49dCkpLGk9PT0hMSlpPW90O2Vsc2UgaWYoIWkpcmV0dXJuIHRoaXM7cmV0dXJuIDE9PT1vJiYocz1pLGk9ZnVuY3Rpb24oZSl7cmV0dXJuIGIoKS5vZmYoZSkscy5hcHBseSh0aGlzLGFyZ3VtZW50cyl9LGkuZ3VpZD1zLmd1aWR8fChzLmd1aWQ9Yi5ndWlkKyspKSx0aGlzLmVhY2goZnVuY3Rpb24oKXtiLmV2ZW50LmFkZCh0aGlzLGUsaSxyLG4pfSl9LG9uZTpmdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gdGhpcy5vbihlLHQsbixyLDEpfSxvZmY6ZnVuY3Rpb24oZSxuLHIpe3ZhciBpLG87aWYoZSYmZS5wcmV2ZW50RGVmYXVsdCYmZS5oYW5kbGVPYmopcmV0dXJuIGk9ZS5oYW5kbGVPYmosYihlLmRlbGVnYXRlVGFyZ2V0KS5vZmYoaS5uYW1lc3BhY2U/aS5vcmlnVHlwZStcIi5cIitpLm5hbWVzcGFjZTppLm9yaWdUeXBlLGkuc2VsZWN0b3IsaS5oYW5kbGVyKSx0aGlzO2lmKFwib2JqZWN0XCI9PXR5cGVvZiBlKXtmb3IobyBpbiBlKXRoaXMub2ZmKG8sbixlW29dKTtyZXR1cm4gdGhpc31yZXR1cm4obj09PSExfHxcImZ1bmN0aW9uXCI9PXR5cGVvZiBuKSYmKHI9bixuPXQpLHI9PT0hMSYmKHI9b3QpLHRoaXMuZWFjaChmdW5jdGlvbigpe2IuZXZlbnQucmVtb3ZlKHRoaXMsZSxyLG4pfSl9LGJpbmQ6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiB0aGlzLm9uKGUsbnVsbCx0LG4pfSx1bmJpbmQ6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gdGhpcy5vZmYoZSxudWxsLHQpfSxkZWxlZ2F0ZTpmdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gdGhpcy5vbih0LGUsbixyKX0sdW5kZWxlZ2F0ZTpmdW5jdGlvbihlLHQsbil7cmV0dXJuIDE9PT1hcmd1bWVudHMubGVuZ3RoP3RoaXMub2ZmKGUsXCIqKlwiKTp0aGlzLm9mZih0LGV8fFwiKipcIixuKX0sdHJpZ2dlcjpmdW5jdGlvbihlLHQpe3JldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXtiLmV2ZW50LnRyaWdnZXIoZSx0LHRoaXMpfSl9LHRyaWdnZXJIYW5kbGVyOmZ1bmN0aW9uKGUsbil7dmFyIHI9dGhpc1swXTtyZXR1cm4gcj9iLmV2ZW50LnRyaWdnZXIoZSxuLHIsITApOnR9fSksZnVuY3Rpb24oZSx0KXt2YXIgbixyLGksbyxhLHMsdSxsLGMscCxmLGQsaCxnLG0seSx2LHg9XCJzaXp6bGVcIistbmV3IERhdGUsdz1lLmRvY3VtZW50LFQ9e30sTj0wLEM9MCxrPWl0KCksRT1pdCgpLFM9aXQoKSxBPXR5cGVvZiB0LGo9MTw8MzEsRD1bXSxMPUQucG9wLEg9RC5wdXNoLHE9RC5zbGljZSxNPUQuaW5kZXhPZnx8ZnVuY3Rpb24oZSl7dmFyIHQ9MCxuPXRoaXMubGVuZ3RoO2Zvcig7bj50O3QrKylpZih0aGlzW3RdPT09ZSlyZXR1cm4gdDtyZXR1cm4tMX0sXz1cIltcXFxceDIwXFxcXHRcXFxcclxcXFxuXFxcXGZdXCIsRj1cIig/OlxcXFxcXFxcLnxbXFxcXHctXXxbXlxcXFx4MDAtXFxcXHhhMF0pK1wiLE89Ri5yZXBsYWNlKFwid1wiLFwidyNcIiksQj1cIihbKl4kfCF+XT89KVwiLFA9XCJcXFxcW1wiK18rXCIqKFwiK0YrXCIpXCIrXytcIiooPzpcIitCK18rXCIqKD86KFsnXFxcIl0pKCg/OlxcXFxcXFxcLnxbXlxcXFxcXFxcXSkqPylcXFxcM3woXCIrTytcIil8KXwpXCIrXytcIipcXFxcXVwiLFI9XCI6KFwiK0YrXCIpKD86XFxcXCgoKFsnXFxcIl0pKCg/OlxcXFxcXFxcLnxbXlxcXFxcXFxcXSkqPylcXFxcM3woKD86XFxcXFxcXFwufFteXFxcXFxcXFwoKVtcXFxcXV18XCIrUC5yZXBsYWNlKDMsOCkrXCIpKil8LiopXFxcXCl8KVwiLFc9UmVnRXhwKFwiXlwiK18rXCIrfCgoPzpefFteXFxcXFxcXFxdKSg/OlxcXFxcXFxcLikqKVwiK18rXCIrJFwiLFwiZ1wiKSwkPVJlZ0V4cChcIl5cIitfK1wiKixcIitfK1wiKlwiKSxJPVJlZ0V4cChcIl5cIitfK1wiKihbXFxcXHgyMFxcXFx0XFxcXHJcXFxcblxcXFxmPit+XSlcIitfK1wiKlwiKSx6PVJlZ0V4cChSKSxYPVJlZ0V4cChcIl5cIitPK1wiJFwiKSxVPXtJRDpSZWdFeHAoXCJeIyhcIitGK1wiKVwiKSxDTEFTUzpSZWdFeHAoXCJeXFxcXC4oXCIrRitcIilcIiksTkFNRTpSZWdFeHAoXCJeXFxcXFtuYW1lPVsnXFxcIl0/KFwiK0YrXCIpWydcXFwiXT9cXFxcXVwiKSxUQUc6UmVnRXhwKFwiXihcIitGLnJlcGxhY2UoXCJ3XCIsXCJ3KlwiKStcIilcIiksQVRUUjpSZWdFeHAoXCJeXCIrUCksUFNFVURPOlJlZ0V4cChcIl5cIitSKSxDSElMRDpSZWdFeHAoXCJeOihvbmx5fGZpcnN0fGxhc3R8bnRofG50aC1sYXN0KS0oY2hpbGR8b2YtdHlwZSkoPzpcXFxcKFwiK18rXCIqKGV2ZW58b2RkfCgoWystXXwpKFxcXFxkKilufClcIitfK1wiKig/OihbKy1dfClcIitfK1wiKihcXFxcZCspfCkpXCIrXytcIipcXFxcKXwpXCIsXCJpXCIpLG5lZWRzQ29udGV4dDpSZWdFeHAoXCJeXCIrXytcIipbPit+XXw6KGV2ZW58b2RkfGVxfGd0fGx0fG50aHxmaXJzdHxsYXN0KSg/OlxcXFwoXCIrXytcIiooKD86LVxcXFxkKT9cXFxcZCopXCIrXytcIipcXFxcKXwpKD89W14tXXwkKVwiLFwiaVwiKX0sVj0vW1xceDIwXFx0XFxyXFxuXFxmXSpbK35dLyxZPS9eW157XStcXHtcXHMqXFxbbmF0aXZlIGNvZGUvLEo9L14oPzojKFtcXHctXSspfChcXHcrKXxcXC4oW1xcdy1dKykpJC8sRz0vXig/OmlucHV0fHNlbGVjdHx0ZXh0YXJlYXxidXR0b24pJC9pLFE9L15oXFxkJC9pLEs9Lyd8XFxcXC9nLFo9L1xcPVtcXHgyMFxcdFxcclxcblxcZl0qKFteJ1wiXFxdXSopW1xceDIwXFx0XFxyXFxuXFxmXSpcXF0vZyxldD0vXFxcXChbXFxkYS1mQS1GXXsxLDZ9W1xceDIwXFx0XFxyXFxuXFxmXT98LikvZyx0dD1mdW5jdGlvbihlLHQpe3ZhciBuPVwiMHhcIit0LTY1NTM2O3JldHVybiBuIT09bj90OjA+bj9TdHJpbmcuZnJvbUNoYXJDb2RlKG4rNjU1MzYpOlN0cmluZy5mcm9tQ2hhckNvZGUoNTUyOTZ8bj4+MTAsNTYzMjB8MTAyMyZuKX07dHJ5e3EuY2FsbCh3LmRvY3VtZW50RWxlbWVudC5jaGlsZE5vZGVzLDApWzBdLm5vZGVUeXBlfWNhdGNoKG50KXtxPWZ1bmN0aW9uKGUpe3ZhciB0LG49W107d2hpbGUodD10aGlzW2UrK10pbi5wdXNoKHQpO3JldHVybiBufX1mdW5jdGlvbiBydChlKXtyZXR1cm4gWS50ZXN0KGUrXCJcIil9ZnVuY3Rpb24gaXQoKXt2YXIgZSx0PVtdO3JldHVybiBlPWZ1bmN0aW9uKG4scil7cmV0dXJuIHQucHVzaChuKz1cIiBcIik+aS5jYWNoZUxlbmd0aCYmZGVsZXRlIGVbdC5zaGlmdCgpXSxlW25dPXJ9fWZ1bmN0aW9uIG90KGUpe3JldHVybiBlW3hdPSEwLGV9ZnVuY3Rpb24gYXQoZSl7dmFyIHQ9cC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO3RyeXtyZXR1cm4gZSh0KX1jYXRjaChuKXtyZXR1cm4hMX1maW5hbGx5e3Q9bnVsbH19ZnVuY3Rpb24gc3QoZSx0LG4scil7dmFyIGksbyxhLHMsdSxsLGYsZyxtLHY7aWYoKHQ/dC5vd25lckRvY3VtZW50fHx0OncpIT09cCYmYyh0KSx0PXR8fHAsbj1ufHxbXSwhZXx8XCJzdHJpbmdcIiE9dHlwZW9mIGUpcmV0dXJuIG47aWYoMSE9PShzPXQubm9kZVR5cGUpJiY5IT09cylyZXR1cm5bXTtpZighZCYmIXIpe2lmKGk9Si5leGVjKGUpKWlmKGE9aVsxXSl7aWYoOT09PXMpe2lmKG89dC5nZXRFbGVtZW50QnlJZChhKSwhb3x8IW8ucGFyZW50Tm9kZSlyZXR1cm4gbjtpZihvLmlkPT09YSlyZXR1cm4gbi5wdXNoKG8pLG59ZWxzZSBpZih0Lm93bmVyRG9jdW1lbnQmJihvPXQub3duZXJEb2N1bWVudC5nZXRFbGVtZW50QnlJZChhKSkmJnkodCxvKSYmby5pZD09PWEpcmV0dXJuIG4ucHVzaChvKSxufWVsc2V7aWYoaVsyXSlyZXR1cm4gSC5hcHBseShuLHEuY2FsbCh0LmdldEVsZW1lbnRzQnlUYWdOYW1lKGUpLDApKSxuO2lmKChhPWlbM10pJiZULmdldEJ5Q2xhc3NOYW1lJiZ0LmdldEVsZW1lbnRzQnlDbGFzc05hbWUpcmV0dXJuIEguYXBwbHkobixxLmNhbGwodC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKGEpLDApKSxufWlmKFQucXNhJiYhaC50ZXN0KGUpKXtpZihmPSEwLGc9eCxtPXQsdj05PT09cyYmZSwxPT09cyYmXCJvYmplY3RcIiE9PXQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSl7bD1mdChlKSwoZj10LmdldEF0dHJpYnV0ZShcImlkXCIpKT9nPWYucmVwbGFjZShLLFwiXFxcXCQmXCIpOnQuc2V0QXR0cmlidXRlKFwiaWRcIixnKSxnPVwiW2lkPSdcIitnK1wiJ10gXCIsdT1sLmxlbmd0aDt3aGlsZSh1LS0pbFt1XT1nK2R0KGxbdV0pO209Vi50ZXN0KGUpJiZ0LnBhcmVudE5vZGV8fHQsdj1sLmpvaW4oXCIsXCIpfWlmKHYpdHJ5e3JldHVybiBILmFwcGx5KG4scS5jYWxsKG0ucXVlcnlTZWxlY3RvckFsbCh2KSwwKSksbn1jYXRjaChiKXt9ZmluYWxseXtmfHx0LnJlbW92ZUF0dHJpYnV0ZShcImlkXCIpfX19cmV0dXJuIHd0KGUucmVwbGFjZShXLFwiJDFcIiksdCxuLHIpfWE9c3QuaXNYTUw9ZnVuY3Rpb24oZSl7dmFyIHQ9ZSYmKGUub3duZXJEb2N1bWVudHx8ZSkuZG9jdW1lbnRFbGVtZW50O3JldHVybiB0P1wiSFRNTFwiIT09dC5ub2RlTmFtZTohMX0sYz1zdC5zZXREb2N1bWVudD1mdW5jdGlvbihlKXt2YXIgbj1lP2Uub3duZXJEb2N1bWVudHx8ZTp3O3JldHVybiBuIT09cCYmOT09PW4ubm9kZVR5cGUmJm4uZG9jdW1lbnRFbGVtZW50PyhwPW4sZj1uLmRvY3VtZW50RWxlbWVudCxkPWEobiksVC50YWdOYW1lTm9Db21tZW50cz1hdChmdW5jdGlvbihlKXtyZXR1cm4gZS5hcHBlbmRDaGlsZChuLmNyZWF0ZUNvbW1lbnQoXCJcIikpLCFlLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiKlwiKS5sZW5ndGh9KSxULmF0dHJpYnV0ZXM9YXQoZnVuY3Rpb24oZSl7ZS5pbm5lckhUTUw9XCI8c2VsZWN0Pjwvc2VsZWN0PlwiO3ZhciB0PXR5cGVvZiBlLmxhc3RDaGlsZC5nZXRBdHRyaWJ1dGUoXCJtdWx0aXBsZVwiKTtyZXR1cm5cImJvb2xlYW5cIiE9PXQmJlwic3RyaW5nXCIhPT10fSksVC5nZXRCeUNsYXNzTmFtZT1hdChmdW5jdGlvbihlKXtyZXR1cm4gZS5pbm5lckhUTUw9XCI8ZGl2IGNsYXNzPSdoaWRkZW4gZSc+PC9kaXY+PGRpdiBjbGFzcz0naGlkZGVuJz48L2Rpdj5cIixlLmdldEVsZW1lbnRzQnlDbGFzc05hbWUmJmUuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImVcIikubGVuZ3RoPyhlLmxhc3RDaGlsZC5jbGFzc05hbWU9XCJlXCIsMj09PWUuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcImVcIikubGVuZ3RoKTohMX0pLFQuZ2V0QnlOYW1lPWF0KGZ1bmN0aW9uKGUpe2UuaWQ9eCswLGUuaW5uZXJIVE1MPVwiPGEgbmFtZT0nXCIreCtcIic+PC9hPjxkaXYgbmFtZT0nXCIreCtcIic+PC9kaXY+XCIsZi5pbnNlcnRCZWZvcmUoZSxmLmZpcnN0Q2hpbGQpO3ZhciB0PW4uZ2V0RWxlbWVudHNCeU5hbWUmJm4uZ2V0RWxlbWVudHNCeU5hbWUoeCkubGVuZ3RoPT09MituLmdldEVsZW1lbnRzQnlOYW1lKHgrMCkubGVuZ3RoO3JldHVybiBULmdldElkTm90TmFtZT0hbi5nZXRFbGVtZW50QnlJZCh4KSxmLnJlbW92ZUNoaWxkKGUpLHR9KSxpLmF0dHJIYW5kbGU9YXQoZnVuY3Rpb24oZSl7cmV0dXJuIGUuaW5uZXJIVE1MPVwiPGEgaHJlZj0nIyc+PC9hPlwiLGUuZmlyc3RDaGlsZCYmdHlwZW9mIGUuZmlyc3RDaGlsZC5nZXRBdHRyaWJ1dGUhPT1BJiZcIiNcIj09PWUuZmlyc3RDaGlsZC5nZXRBdHRyaWJ1dGUoXCJocmVmXCIpfSk/e306e2hyZWY6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuZ2V0QXR0cmlidXRlKFwiaHJlZlwiLDIpfSx0eXBlOmZ1bmN0aW9uKGUpe3JldHVybiBlLmdldEF0dHJpYnV0ZShcInR5cGVcIil9fSxULmdldElkTm90TmFtZT8oaS5maW5kLklEPWZ1bmN0aW9uKGUsdCl7aWYodHlwZW9mIHQuZ2V0RWxlbWVudEJ5SWQhPT1BJiYhZCl7dmFyIG49dC5nZXRFbGVtZW50QnlJZChlKTtyZXR1cm4gbiYmbi5wYXJlbnROb2RlP1tuXTpbXX19LGkuZmlsdGVyLklEPWZ1bmN0aW9uKGUpe3ZhciB0PWUucmVwbGFjZShldCx0dCk7cmV0dXJuIGZ1bmN0aW9uKGUpe3JldHVybiBlLmdldEF0dHJpYnV0ZShcImlkXCIpPT09dH19KTooaS5maW5kLklEPWZ1bmN0aW9uKGUsbil7aWYodHlwZW9mIG4uZ2V0RWxlbWVudEJ5SWQhPT1BJiYhZCl7dmFyIHI9bi5nZXRFbGVtZW50QnlJZChlKTtyZXR1cm4gcj9yLmlkPT09ZXx8dHlwZW9mIHIuZ2V0QXR0cmlidXRlTm9kZSE9PUEmJnIuZ2V0QXR0cmlidXRlTm9kZShcImlkXCIpLnZhbHVlPT09ZT9bcl06dDpbXX19LGkuZmlsdGVyLklEPWZ1bmN0aW9uKGUpe3ZhciB0PWUucmVwbGFjZShldCx0dCk7cmV0dXJuIGZ1bmN0aW9uKGUpe3ZhciBuPXR5cGVvZiBlLmdldEF0dHJpYnV0ZU5vZGUhPT1BJiZlLmdldEF0dHJpYnV0ZU5vZGUoXCJpZFwiKTtyZXR1cm4gbiYmbi52YWx1ZT09PXR9fSksaS5maW5kLlRBRz1ULnRhZ05hbWVOb0NvbW1lbnRzP2Z1bmN0aW9uKGUsbil7cmV0dXJuIHR5cGVvZiBuLmdldEVsZW1lbnRzQnlUYWdOYW1lIT09QT9uLmdldEVsZW1lbnRzQnlUYWdOYW1lKGUpOnR9OmZ1bmN0aW9uKGUsdCl7dmFyIG4scj1bXSxpPTAsbz10LmdldEVsZW1lbnRzQnlUYWdOYW1lKGUpO2lmKFwiKlwiPT09ZSl7d2hpbGUobj1vW2krK10pMT09PW4ubm9kZVR5cGUmJnIucHVzaChuKTtyZXR1cm4gcn1yZXR1cm4gb30saS5maW5kLk5BTUU9VC5nZXRCeU5hbWUmJmZ1bmN0aW9uKGUsbil7cmV0dXJuIHR5cGVvZiBuLmdldEVsZW1lbnRzQnlOYW1lIT09QT9uLmdldEVsZW1lbnRzQnlOYW1lKG5hbWUpOnR9LGkuZmluZC5DTEFTUz1ULmdldEJ5Q2xhc3NOYW1lJiZmdW5jdGlvbihlLG4pe3JldHVybiB0eXBlb2Ygbi5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lPT09QXx8ZD90Om4uZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShlKX0sZz1bXSxoPVtcIjpmb2N1c1wiXSwoVC5xc2E9cnQobi5xdWVyeVNlbGVjdG9yQWxsKSkmJihhdChmdW5jdGlvbihlKXtlLmlubmVySFRNTD1cIjxzZWxlY3Q+PG9wdGlvbiBzZWxlY3RlZD0nJz48L29wdGlvbj48L3NlbGVjdD5cIixlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJbc2VsZWN0ZWRdXCIpLmxlbmd0aHx8aC5wdXNoKFwiXFxcXFtcIitfK1wiKig/OmNoZWNrZWR8ZGlzYWJsZWR8aXNtYXB8bXVsdGlwbGV8cmVhZG9ubHl8c2VsZWN0ZWR8dmFsdWUpXCIpLGUucXVlcnlTZWxlY3RvckFsbChcIjpjaGVja2VkXCIpLmxlbmd0aHx8aC5wdXNoKFwiOmNoZWNrZWRcIil9KSxhdChmdW5jdGlvbihlKXtlLmlubmVySFRNTD1cIjxpbnB1dCB0eXBlPSdoaWRkZW4nIGk9JycvPlwiLGUucXVlcnlTZWxlY3RvckFsbChcIltpXj0nJ11cIikubGVuZ3RoJiZoLnB1c2goXCJbKl4kXT1cIitfK1wiKig/OlxcXCJcXFwifCcnKVwiKSxlLnF1ZXJ5U2VsZWN0b3JBbGwoXCI6ZW5hYmxlZFwiKS5sZW5ndGh8fGgucHVzaChcIjplbmFibGVkXCIsXCI6ZGlzYWJsZWRcIiksZS5xdWVyeVNlbGVjdG9yQWxsKFwiKiw6eFwiKSxoLnB1c2goXCIsLio6XCIpfSkpLChULm1hdGNoZXNTZWxlY3Rvcj1ydChtPWYubWF0Y2hlc1NlbGVjdG9yfHxmLm1vek1hdGNoZXNTZWxlY3Rvcnx8Zi53ZWJraXRNYXRjaGVzU2VsZWN0b3J8fGYub01hdGNoZXNTZWxlY3Rvcnx8Zi5tc01hdGNoZXNTZWxlY3RvcikpJiZhdChmdW5jdGlvbihlKXtULmRpc2Nvbm5lY3RlZE1hdGNoPW0uY2FsbChlLFwiZGl2XCIpLG0uY2FsbChlLFwiW3MhPScnXTp4XCIpLGcucHVzaChcIiE9XCIsUil9KSxoPVJlZ0V4cChoLmpvaW4oXCJ8XCIpKSxnPVJlZ0V4cChnLmpvaW4oXCJ8XCIpKSx5PXJ0KGYuY29udGFpbnMpfHxmLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uP2Z1bmN0aW9uKGUsdCl7dmFyIG49OT09PWUubm9kZVR5cGU/ZS5kb2N1bWVudEVsZW1lbnQ6ZSxyPXQmJnQucGFyZW50Tm9kZTtyZXR1cm4gZT09PXJ8fCEoIXJ8fDEhPT1yLm5vZGVUeXBlfHwhKG4uY29udGFpbnM/bi5jb250YWlucyhyKTplLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uJiYxNiZlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKHIpKSl9OmZ1bmN0aW9uKGUsdCl7aWYodCl3aGlsZSh0PXQucGFyZW50Tm9kZSlpZih0PT09ZSlyZXR1cm4hMDtyZXR1cm4hMX0sdj1mLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uP2Z1bmN0aW9uKGUsdCl7dmFyIHI7cmV0dXJuIGU9PT10Pyh1PSEwLDApOihyPXQuY29tcGFyZURvY3VtZW50UG9zaXRpb24mJmUuY29tcGFyZURvY3VtZW50UG9zaXRpb24mJmUuY29tcGFyZURvY3VtZW50UG9zaXRpb24odCkpPzEmcnx8ZS5wYXJlbnROb2RlJiYxMT09PWUucGFyZW50Tm9kZS5ub2RlVHlwZT9lPT09bnx8eSh3LGUpPy0xOnQ9PT1ufHx5KHcsdCk/MTowOjQmcj8tMToxOmUuY29tcGFyZURvY3VtZW50UG9zaXRpb24/LTE6MX06ZnVuY3Rpb24oZSx0KXt2YXIgcixpPTAsbz1lLnBhcmVudE5vZGUsYT10LnBhcmVudE5vZGUscz1bZV0sbD1bdF07aWYoZT09PXQpcmV0dXJuIHU9ITAsMDtpZighb3x8IWEpcmV0dXJuIGU9PT1uPy0xOnQ9PT1uPzE6bz8tMTphPzE6MDtpZihvPT09YSlyZXR1cm4gdXQoZSx0KTtyPWU7d2hpbGUocj1yLnBhcmVudE5vZGUpcy51bnNoaWZ0KHIpO3I9dDt3aGlsZShyPXIucGFyZW50Tm9kZSlsLnVuc2hpZnQocik7d2hpbGUoc1tpXT09PWxbaV0paSsrO3JldHVybiBpP3V0KHNbaV0sbFtpXSk6c1tpXT09PXc/LTE6bFtpXT09PXc/MTowfSx1PSExLFswLDBdLnNvcnQodiksVC5kZXRlY3REdXBsaWNhdGVzPXUscCk6cH0sc3QubWF0Y2hlcz1mdW5jdGlvbihlLHQpe3JldHVybiBzdChlLG51bGwsbnVsbCx0KX0sc3QubWF0Y2hlc1NlbGVjdG9yPWZ1bmN0aW9uKGUsdCl7aWYoKGUub3duZXJEb2N1bWVudHx8ZSkhPT1wJiZjKGUpLHQ9dC5yZXBsYWNlKFosXCI9JyQxJ11cIiksISghVC5tYXRjaGVzU2VsZWN0b3J8fGR8fGcmJmcudGVzdCh0KXx8aC50ZXN0KHQpKSl0cnl7dmFyIG49bS5jYWxsKGUsdCk7aWYobnx8VC5kaXNjb25uZWN0ZWRNYXRjaHx8ZS5kb2N1bWVudCYmMTEhPT1lLmRvY3VtZW50Lm5vZGVUeXBlKXJldHVybiBufWNhdGNoKHIpe31yZXR1cm4gc3QodCxwLG51bGwsW2VdKS5sZW5ndGg+MH0sc3QuY29udGFpbnM9ZnVuY3Rpb24oZSx0KXtyZXR1cm4oZS5vd25lckRvY3VtZW50fHxlKSE9PXAmJmMoZSkseShlLHQpfSxzdC5hdHRyPWZ1bmN0aW9uKGUsdCl7dmFyIG47cmV0dXJuKGUub3duZXJEb2N1bWVudHx8ZSkhPT1wJiZjKGUpLGR8fCh0PXQudG9Mb3dlckNhc2UoKSksKG49aS5hdHRySGFuZGxlW3RdKT9uKGUpOmR8fFQuYXR0cmlidXRlcz9lLmdldEF0dHJpYnV0ZSh0KTooKG49ZS5nZXRBdHRyaWJ1dGVOb2RlKHQpKXx8ZS5nZXRBdHRyaWJ1dGUodCkpJiZlW3RdPT09ITA/dDpuJiZuLnNwZWNpZmllZD9uLnZhbHVlOm51bGx9LHN0LmVycm9yPWZ1bmN0aW9uKGUpe3Rocm93IEVycm9yKFwiU3ludGF4IGVycm9yLCB1bnJlY29nbml6ZWQgZXhwcmVzc2lvbjogXCIrZSl9LHN0LnVuaXF1ZVNvcnQ9ZnVuY3Rpb24oZSl7dmFyIHQsbj1bXSxyPTEsaT0wO2lmKHU9IVQuZGV0ZWN0RHVwbGljYXRlcyxlLnNvcnQodiksdSl7Zm9yKDt0PWVbcl07cisrKXQ9PT1lW3ItMV0mJihpPW4ucHVzaChyKSk7d2hpbGUoaS0tKWUuc3BsaWNlKG5baV0sMSl9cmV0dXJuIGV9O2Z1bmN0aW9uIHV0KGUsdCl7dmFyIG49dCYmZSxyPW4mJih+dC5zb3VyY2VJbmRleHx8aiktKH5lLnNvdXJjZUluZGV4fHxqKTtpZihyKXJldHVybiByO2lmKG4pd2hpbGUobj1uLm5leHRTaWJsaW5nKWlmKG49PT10KXJldHVybi0xO3JldHVybiBlPzE6LTF9ZnVuY3Rpb24gbHQoZSl7cmV0dXJuIGZ1bmN0aW9uKHQpe3ZhciBuPXQubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtyZXR1cm5cImlucHV0XCI9PT1uJiZ0LnR5cGU9PT1lfX1mdW5jdGlvbiBjdChlKXtyZXR1cm4gZnVuY3Rpb24odCl7dmFyIG49dC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO3JldHVybihcImlucHV0XCI9PT1ufHxcImJ1dHRvblwiPT09bikmJnQudHlwZT09PWV9fWZ1bmN0aW9uIHB0KGUpe3JldHVybiBvdChmdW5jdGlvbih0KXtyZXR1cm4gdD0rdCxvdChmdW5jdGlvbihuLHIpe3ZhciBpLG89ZShbXSxuLmxlbmd0aCx0KSxhPW8ubGVuZ3RoO3doaWxlKGEtLSluW2k9b1thXV0mJihuW2ldPSEocltpXT1uW2ldKSl9KX0pfW89c3QuZ2V0VGV4dD1mdW5jdGlvbihlKXt2YXIgdCxuPVwiXCIscj0wLGk9ZS5ub2RlVHlwZTtpZihpKXtpZigxPT09aXx8OT09PWl8fDExPT09aSl7aWYoXCJzdHJpbmdcIj09dHlwZW9mIGUudGV4dENvbnRlbnQpcmV0dXJuIGUudGV4dENvbnRlbnQ7Zm9yKGU9ZS5maXJzdENoaWxkO2U7ZT1lLm5leHRTaWJsaW5nKW4rPW8oZSl9ZWxzZSBpZigzPT09aXx8ND09PWkpcmV0dXJuIGUubm9kZVZhbHVlfWVsc2UgZm9yKDt0PWVbcl07cisrKW4rPW8odCk7cmV0dXJuIG59LGk9c3Quc2VsZWN0b3JzPXtjYWNoZUxlbmd0aDo1MCxjcmVhdGVQc2V1ZG86b3QsbWF0Y2g6VSxmaW5kOnt9LHJlbGF0aXZlOntcIj5cIjp7ZGlyOlwicGFyZW50Tm9kZVwiLGZpcnN0OiEwfSxcIiBcIjp7ZGlyOlwicGFyZW50Tm9kZVwifSxcIitcIjp7ZGlyOlwicHJldmlvdXNTaWJsaW5nXCIsZmlyc3Q6ITB9LFwiflwiOntkaXI6XCJwcmV2aW91c1NpYmxpbmdcIn19LHByZUZpbHRlcjp7QVRUUjpmdW5jdGlvbihlKXtyZXR1cm4gZVsxXT1lWzFdLnJlcGxhY2UoZXQsdHQpLGVbM109KGVbNF18fGVbNV18fFwiXCIpLnJlcGxhY2UoZXQsdHQpLFwifj1cIj09PWVbMl0mJihlWzNdPVwiIFwiK2VbM10rXCIgXCIpLGUuc2xpY2UoMCw0KX0sQ0hJTEQ6ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMV09ZVsxXS50b0xvd2VyQ2FzZSgpLFwibnRoXCI9PT1lWzFdLnNsaWNlKDAsMyk/KGVbM118fHN0LmVycm9yKGVbMF0pLGVbNF09KyhlWzRdP2VbNV0rKGVbNl18fDEpOjIqKFwiZXZlblwiPT09ZVszXXx8XCJvZGRcIj09PWVbM10pKSxlWzVdPSsoZVs3XStlWzhdfHxcIm9kZFwiPT09ZVszXSkpOmVbM10mJnN0LmVycm9yKGVbMF0pLGV9LFBTRVVETzpmdW5jdGlvbihlKXt2YXIgdCxuPSFlWzVdJiZlWzJdO3JldHVybiBVLkNISUxELnRlc3QoZVswXSk/bnVsbDooZVs0XT9lWzJdPWVbNF06biYmei50ZXN0KG4pJiYodD1mdChuLCEwKSkmJih0PW4uaW5kZXhPZihcIilcIixuLmxlbmd0aC10KS1uLmxlbmd0aCkmJihlWzBdPWVbMF0uc2xpY2UoMCx0KSxlWzJdPW4uc2xpY2UoMCx0KSksZS5zbGljZSgwLDMpKX19LGZpbHRlcjp7VEFHOmZ1bmN0aW9uKGUpe3JldHVyblwiKlwiPT09ZT9mdW5jdGlvbigpe3JldHVybiEwfTooZT1lLnJlcGxhY2UoZXQsdHQpLnRvTG93ZXJDYXNlKCksZnVuY3Rpb24odCl7cmV0dXJuIHQubm9kZU5hbWUmJnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKT09PWV9KX0sQ0xBU1M6ZnVuY3Rpb24oZSl7dmFyIHQ9a1tlK1wiIFwiXTtyZXR1cm4gdHx8KHQ9UmVnRXhwKFwiKF58XCIrXytcIilcIitlK1wiKFwiK18rXCJ8JClcIikpJiZrKGUsZnVuY3Rpb24oZSl7cmV0dXJuIHQudGVzdChlLmNsYXNzTmFtZXx8dHlwZW9mIGUuZ2V0QXR0cmlidXRlIT09QSYmZS5nZXRBdHRyaWJ1dGUoXCJjbGFzc1wiKXx8XCJcIil9KX0sQVRUUjpmdW5jdGlvbihlLHQsbil7cmV0dXJuIGZ1bmN0aW9uKHIpe3ZhciBpPXN0LmF0dHIocixlKTtyZXR1cm4gbnVsbD09aT9cIiE9XCI9PT10OnQ/KGkrPVwiXCIsXCI9XCI9PT10P2k9PT1uOlwiIT1cIj09PXQ/aSE9PW46XCJePVwiPT09dD9uJiYwPT09aS5pbmRleE9mKG4pOlwiKj1cIj09PXQ/biYmaS5pbmRleE9mKG4pPi0xOlwiJD1cIj09PXQ/biYmaS5zbGljZSgtbi5sZW5ndGgpPT09bjpcIn49XCI9PT10PyhcIiBcIitpK1wiIFwiKS5pbmRleE9mKG4pPi0xOlwifD1cIj09PXQ/aT09PW58fGkuc2xpY2UoMCxuLmxlbmd0aCsxKT09PW4rXCItXCI6ITEpOiEwfX0sQ0hJTEQ6ZnVuY3Rpb24oZSx0LG4scixpKXt2YXIgbz1cIm50aFwiIT09ZS5zbGljZSgwLDMpLGE9XCJsYXN0XCIhPT1lLnNsaWNlKC00KSxzPVwib2YtdHlwZVwiPT09dDtyZXR1cm4gMT09PXImJjA9PT1pP2Z1bmN0aW9uKGUpe3JldHVybiEhZS5wYXJlbnROb2RlfTpmdW5jdGlvbih0LG4sdSl7dmFyIGwsYyxwLGYsZCxoLGc9byE9PWE/XCJuZXh0U2libGluZ1wiOlwicHJldmlvdXNTaWJsaW5nXCIsbT10LnBhcmVudE5vZGUseT1zJiZ0Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCksdj0hdSYmIXM7aWYobSl7aWYobyl7d2hpbGUoZyl7cD10O3doaWxlKHA9cFtnXSlpZihzP3Aubm9kZU5hbWUudG9Mb3dlckNhc2UoKT09PXk6MT09PXAubm9kZVR5cGUpcmV0dXJuITE7aD1nPVwib25seVwiPT09ZSYmIWgmJlwibmV4dFNpYmxpbmdcIn1yZXR1cm4hMH1pZihoPVthP20uZmlyc3RDaGlsZDptLmxhc3RDaGlsZF0sYSYmdil7Yz1tW3hdfHwobVt4XT17fSksbD1jW2VdfHxbXSxkPWxbMF09PT1OJiZsWzFdLGY9bFswXT09PU4mJmxbMl0scD1kJiZtLmNoaWxkTm9kZXNbZF07d2hpbGUocD0rK2QmJnAmJnBbZ118fChmPWQ9MCl8fGgucG9wKCkpaWYoMT09PXAubm9kZVR5cGUmJisrZiYmcD09PXQpe2NbZV09W04sZCxmXTticmVha319ZWxzZSBpZih2JiYobD0odFt4XXx8KHRbeF09e30pKVtlXSkmJmxbMF09PT1OKWY9bFsxXTtlbHNlIHdoaWxlKHA9KytkJiZwJiZwW2ddfHwoZj1kPTApfHxoLnBvcCgpKWlmKChzP3Aubm9kZU5hbWUudG9Mb3dlckNhc2UoKT09PXk6MT09PXAubm9kZVR5cGUpJiYrK2YmJih2JiYoKHBbeF18fChwW3hdPXt9KSlbZV09W04sZl0pLHA9PT10KSlicmVhaztyZXR1cm4gZi09aSxmPT09cnx8MD09PWYlciYmZi9yPj0wfX19LFBTRVVETzpmdW5jdGlvbihlLHQpe3ZhciBuLHI9aS5wc2V1ZG9zW2VdfHxpLnNldEZpbHRlcnNbZS50b0xvd2VyQ2FzZSgpXXx8c3QuZXJyb3IoXCJ1bnN1cHBvcnRlZCBwc2V1ZG86IFwiK2UpO3JldHVybiByW3hdP3IodCk6ci5sZW5ndGg+MT8obj1bZSxlLFwiXCIsdF0saS5zZXRGaWx0ZXJzLmhhc093blByb3BlcnR5KGUudG9Mb3dlckNhc2UoKSk/b3QoZnVuY3Rpb24oZSxuKXt2YXIgaSxvPXIoZSx0KSxhPW8ubGVuZ3RoO3doaWxlKGEtLSlpPU0uY2FsbChlLG9bYV0pLGVbaV09IShuW2ldPW9bYV0pfSk6ZnVuY3Rpb24oZSl7cmV0dXJuIHIoZSwwLG4pfSk6cn19LHBzZXVkb3M6e25vdDpvdChmdW5jdGlvbihlKXt2YXIgdD1bXSxuPVtdLHI9cyhlLnJlcGxhY2UoVyxcIiQxXCIpKTtyZXR1cm4gclt4XT9vdChmdW5jdGlvbihlLHQsbixpKXt2YXIgbyxhPXIoZSxudWxsLGksW10pLHM9ZS5sZW5ndGg7d2hpbGUocy0tKShvPWFbc10pJiYoZVtzXT0hKHRbc109bykpfSk6ZnVuY3Rpb24oZSxpLG8pe3JldHVybiB0WzBdPWUscih0LG51bGwsbyxuKSwhbi5wb3AoKX19KSxoYXM6b3QoZnVuY3Rpb24oZSl7cmV0dXJuIGZ1bmN0aW9uKHQpe3JldHVybiBzdChlLHQpLmxlbmd0aD4wfX0pLGNvbnRhaW5zOm90KGZ1bmN0aW9uKGUpe3JldHVybiBmdW5jdGlvbih0KXtyZXR1cm4odC50ZXh0Q29udGVudHx8dC5pbm5lclRleHR8fG8odCkpLmluZGV4T2YoZSk+LTF9fSksbGFuZzpvdChmdW5jdGlvbihlKXtyZXR1cm4gWC50ZXN0KGV8fFwiXCIpfHxzdC5lcnJvcihcInVuc3VwcG9ydGVkIGxhbmc6IFwiK2UpLGU9ZS5yZXBsYWNlKGV0LHR0KS50b0xvd2VyQ2FzZSgpLGZ1bmN0aW9uKHQpe3ZhciBuO2RvIGlmKG49ZD90LmdldEF0dHJpYnV0ZShcInhtbDpsYW5nXCIpfHx0LmdldEF0dHJpYnV0ZShcImxhbmdcIik6dC5sYW5nKXJldHVybiBuPW4udG9Mb3dlckNhc2UoKSxuPT09ZXx8MD09PW4uaW5kZXhPZihlK1wiLVwiKTt3aGlsZSgodD10LnBhcmVudE5vZGUpJiYxPT09dC5ub2RlVHlwZSk7cmV0dXJuITF9fSksdGFyZ2V0OmZ1bmN0aW9uKHQpe3ZhciBuPWUubG9jYXRpb24mJmUubG9jYXRpb24uaGFzaDtyZXR1cm4gbiYmbi5zbGljZSgxKT09PXQuaWR9LHJvb3Q6ZnVuY3Rpb24oZSl7cmV0dXJuIGU9PT1mfSxmb2N1czpmdW5jdGlvbihlKXtyZXR1cm4gZT09PXAuYWN0aXZlRWxlbWVudCYmKCFwLmhhc0ZvY3VzfHxwLmhhc0ZvY3VzKCkpJiYhIShlLnR5cGV8fGUuaHJlZnx8fmUudGFiSW5kZXgpfSxlbmFibGVkOmZ1bmN0aW9uKGUpe3JldHVybiBlLmRpc2FibGVkPT09ITF9LGRpc2FibGVkOmZ1bmN0aW9uKGUpe3JldHVybiBlLmRpc2FibGVkPT09ITB9LGNoZWNrZWQ6ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO3JldHVyblwiaW5wdXRcIj09PXQmJiEhZS5jaGVja2VkfHxcIm9wdGlvblwiPT09dCYmISFlLnNlbGVjdGVkfSxzZWxlY3RlZDpmdW5jdGlvbihlKXtyZXR1cm4gZS5wYXJlbnROb2RlJiZlLnBhcmVudE5vZGUuc2VsZWN0ZWRJbmRleCxlLnNlbGVjdGVkPT09ITB9LGVtcHR5OmZ1bmN0aW9uKGUpe2ZvcihlPWUuZmlyc3RDaGlsZDtlO2U9ZS5uZXh0U2libGluZylpZihlLm5vZGVOYW1lPlwiQFwifHwzPT09ZS5ub2RlVHlwZXx8ND09PWUubm9kZVR5cGUpcmV0dXJuITE7cmV0dXJuITB9LHBhcmVudDpmdW5jdGlvbihlKXtyZXR1cm4haS5wc2V1ZG9zLmVtcHR5KGUpfSxoZWFkZXI6ZnVuY3Rpb24oZSl7cmV0dXJuIFEudGVzdChlLm5vZGVOYW1lKX0saW5wdXQ6ZnVuY3Rpb24oZSl7cmV0dXJuIEcudGVzdChlLm5vZGVOYW1lKX0sYnV0dG9uOmZ1bmN0aW9uKGUpe3ZhciB0PWUubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtyZXR1cm5cImlucHV0XCI9PT10JiZcImJ1dHRvblwiPT09ZS50eXBlfHxcImJ1dHRvblwiPT09dH0sdGV4dDpmdW5jdGlvbihlKXt2YXIgdDtyZXR1cm5cImlucHV0XCI9PT1lLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkmJlwidGV4dFwiPT09ZS50eXBlJiYobnVsbD09KHQ9ZS5nZXRBdHRyaWJ1dGUoXCJ0eXBlXCIpKXx8dC50b0xvd2VyQ2FzZSgpPT09ZS50eXBlKX0sZmlyc3Q6cHQoZnVuY3Rpb24oKXtyZXR1cm5bMF19KSxsYXN0OnB0KGZ1bmN0aW9uKGUsdCl7cmV0dXJuW3QtMV19KSxlcTpwdChmdW5jdGlvbihlLHQsbil7cmV0dXJuWzA+bj9uK3Q6bl19KSxldmVuOnB0KGZ1bmN0aW9uKGUsdCl7dmFyIG49MDtmb3IoO3Q+bjtuKz0yKWUucHVzaChuKTtyZXR1cm4gZX0pLG9kZDpwdChmdW5jdGlvbihlLHQpe3ZhciBuPTE7Zm9yKDt0Pm47bis9MillLnB1c2gobik7cmV0dXJuIGV9KSxsdDpwdChmdW5jdGlvbihlLHQsbil7dmFyIHI9MD5uP24rdDpuO2Zvcig7LS1yPj0wOyllLnB1c2gocik7cmV0dXJuIGV9KSxndDpwdChmdW5jdGlvbihlLHQsbil7dmFyIHI9MD5uP24rdDpuO2Zvcig7dD4rK3I7KWUucHVzaChyKTtyZXR1cm4gZX0pfX07Zm9yKG4gaW57cmFkaW86ITAsY2hlY2tib3g6ITAsZmlsZTohMCxwYXNzd29yZDohMCxpbWFnZTohMH0paS5wc2V1ZG9zW25dPWx0KG4pO2ZvcihuIGlue3N1Ym1pdDohMCxyZXNldDohMH0paS5wc2V1ZG9zW25dPWN0KG4pO2Z1bmN0aW9uIGZ0KGUsdCl7dmFyIG4scixvLGEscyx1LGwsYz1FW2UrXCIgXCJdO2lmKGMpcmV0dXJuIHQ/MDpjLnNsaWNlKDApO3M9ZSx1PVtdLGw9aS5wcmVGaWx0ZXI7d2hpbGUocyl7KCFufHwocj0kLmV4ZWMocykpKSYmKHImJihzPXMuc2xpY2UoclswXS5sZW5ndGgpfHxzKSx1LnB1c2gobz1bXSkpLG49ITEsKHI9SS5leGVjKHMpKSYmKG49ci5zaGlmdCgpLG8ucHVzaCh7dmFsdWU6bix0eXBlOnJbMF0ucmVwbGFjZShXLFwiIFwiKX0pLHM9cy5zbGljZShuLmxlbmd0aCkpO2ZvcihhIGluIGkuZmlsdGVyKSEocj1VW2FdLmV4ZWMocykpfHxsW2FdJiYhKHI9bFthXShyKSl8fChuPXIuc2hpZnQoKSxvLnB1c2goe3ZhbHVlOm4sdHlwZTphLG1hdGNoZXM6cn0pLHM9cy5zbGljZShuLmxlbmd0aCkpO2lmKCFuKWJyZWFrfXJldHVybiB0P3MubGVuZ3RoOnM/c3QuZXJyb3IoZSk6RShlLHUpLnNsaWNlKDApfWZ1bmN0aW9uIGR0KGUpe3ZhciB0PTAsbj1lLmxlbmd0aCxyPVwiXCI7Zm9yKDtuPnQ7dCsrKXIrPWVbdF0udmFsdWU7cmV0dXJuIHJ9ZnVuY3Rpb24gaHQoZSx0LG4pe3ZhciBpPXQuZGlyLG89biYmXCJwYXJlbnROb2RlXCI9PT1pLGE9QysrO3JldHVybiB0LmZpcnN0P2Z1bmN0aW9uKHQsbixyKXt3aGlsZSh0PXRbaV0paWYoMT09PXQubm9kZVR5cGV8fG8pcmV0dXJuIGUodCxuLHIpfTpmdW5jdGlvbih0LG4scyl7dmFyIHUsbCxjLHA9TitcIiBcIithO2lmKHMpe3doaWxlKHQ9dFtpXSlpZigoMT09PXQubm9kZVR5cGV8fG8pJiZlKHQsbixzKSlyZXR1cm4hMH1lbHNlIHdoaWxlKHQ9dFtpXSlpZigxPT09dC5ub2RlVHlwZXx8bylpZihjPXRbeF18fCh0W3hdPXt9KSwobD1jW2ldKSYmbFswXT09PXApe2lmKCh1PWxbMV0pPT09ITB8fHU9PT1yKXJldHVybiB1PT09ITB9ZWxzZSBpZihsPWNbaV09W3BdLGxbMV09ZSh0LG4scyl8fHIsbFsxXT09PSEwKXJldHVybiEwfX1mdW5jdGlvbiBndChlKXtyZXR1cm4gZS5sZW5ndGg+MT9mdW5jdGlvbih0LG4scil7dmFyIGk9ZS5sZW5ndGg7d2hpbGUoaS0tKWlmKCFlW2ldKHQsbixyKSlyZXR1cm4hMTtyZXR1cm4hMH06ZVswXX1mdW5jdGlvbiBtdChlLHQsbixyLGkpe3ZhciBvLGE9W10scz0wLHU9ZS5sZW5ndGgsbD1udWxsIT10O2Zvcig7dT5zO3MrKykobz1lW3NdKSYmKCFufHxuKG8scixpKSkmJihhLnB1c2gobyksbCYmdC5wdXNoKHMpKTtyZXR1cm4gYX1mdW5jdGlvbiB5dChlLHQsbixyLGksbyl7cmV0dXJuIHImJiFyW3hdJiYocj15dChyKSksaSYmIWlbeF0mJihpPXl0KGksbykpLG90KGZ1bmN0aW9uKG8sYSxzLHUpe3ZhciBsLGMscCxmPVtdLGQ9W10saD1hLmxlbmd0aCxnPW98fHh0KHR8fFwiKlwiLHMubm9kZVR5cGU/W3NdOnMsW10pLG09IWV8fCFvJiZ0P2c6bXQoZyxmLGUscyx1KSx5PW4/aXx8KG8/ZTpofHxyKT9bXTphOm07aWYobiYmbihtLHkscyx1KSxyKXtsPW10KHksZCkscihsLFtdLHMsdSksYz1sLmxlbmd0aDt3aGlsZShjLS0pKHA9bFtjXSkmJih5W2RbY11dPSEobVtkW2NdXT1wKSl9aWYobyl7aWYoaXx8ZSl7aWYoaSl7bD1bXSxjPXkubGVuZ3RoO3doaWxlKGMtLSkocD15W2NdKSYmbC5wdXNoKG1bY109cCk7aShudWxsLHk9W10sbCx1KX1jPXkubGVuZ3RoO3doaWxlKGMtLSkocD15W2NdKSYmKGw9aT9NLmNhbGwobyxwKTpmW2NdKT4tMSYmKG9bbF09IShhW2xdPXApKX19ZWxzZSB5PW10KHk9PT1hP3kuc3BsaWNlKGgseS5sZW5ndGgpOnkpLGk/aShudWxsLGEseSx1KTpILmFwcGx5KGEseSl9KX1mdW5jdGlvbiB2dChlKXt2YXIgdCxuLHIsbz1lLmxlbmd0aCxhPWkucmVsYXRpdmVbZVswXS50eXBlXSxzPWF8fGkucmVsYXRpdmVbXCIgXCJdLHU9YT8xOjAsYz1odChmdW5jdGlvbihlKXtyZXR1cm4gZT09PXR9LHMsITApLHA9aHQoZnVuY3Rpb24oZSl7cmV0dXJuIE0uY2FsbCh0LGUpPi0xfSxzLCEwKSxmPVtmdW5jdGlvbihlLG4scil7cmV0dXJuIWEmJihyfHxuIT09bCl8fCgodD1uKS5ub2RlVHlwZT9jKGUsbixyKTpwKGUsbixyKSl9XTtmb3IoO28+dTt1KyspaWYobj1pLnJlbGF0aXZlW2VbdV0udHlwZV0pZj1baHQoZ3QoZiksbildO2Vsc2V7aWYobj1pLmZpbHRlcltlW3VdLnR5cGVdLmFwcGx5KG51bGwsZVt1XS5tYXRjaGVzKSxuW3hdKXtmb3Iocj0rK3U7bz5yO3IrKylpZihpLnJlbGF0aXZlW2Vbcl0udHlwZV0pYnJlYWs7cmV0dXJuIHl0KHU+MSYmZ3QoZiksdT4xJiZkdChlLnNsaWNlKDAsdS0xKSkucmVwbGFjZShXLFwiJDFcIiksbixyPnUmJnZ0KGUuc2xpY2UodSxyKSksbz5yJiZ2dChlPWUuc2xpY2UocikpLG8+ciYmZHQoZSkpfWYucHVzaChuKX1yZXR1cm4gZ3QoZil9ZnVuY3Rpb24gYnQoZSx0KXt2YXIgbj0wLG89dC5sZW5ndGg+MCxhPWUubGVuZ3RoPjAscz1mdW5jdGlvbihzLHUsYyxmLGQpe3ZhciBoLGcsbSx5PVtdLHY9MCxiPVwiMFwiLHg9cyYmW10sdz1udWxsIT1kLFQ9bCxDPXN8fGEmJmkuZmluZC5UQUcoXCIqXCIsZCYmdS5wYXJlbnROb2RlfHx1KSxrPU4rPW51bGw9PVQ/MTpNYXRoLnJhbmRvbSgpfHwuMTtmb3IodyYmKGw9dSE9PXAmJnUscj1uKTtudWxsIT0oaD1DW2JdKTtiKyspe2lmKGEmJmgpe2c9MDt3aGlsZShtPWVbZysrXSlpZihtKGgsdSxjKSl7Zi5wdXNoKGgpO2JyZWFrfXcmJihOPWsscj0rK24pfW8mJigoaD0hbSYmaCkmJnYtLSxzJiZ4LnB1c2goaCkpfWlmKHYrPWIsbyYmYiE9PXYpe2c9MDt3aGlsZShtPXRbZysrXSltKHgseSx1LGMpO2lmKHMpe2lmKHY+MCl3aGlsZShiLS0peFtiXXx8eVtiXXx8KHlbYl09TC5jYWxsKGYpKTt5PW10KHkpfUguYXBwbHkoZix5KSx3JiYhcyYmeS5sZW5ndGg+MCYmdit0Lmxlbmd0aD4xJiZzdC51bmlxdWVTb3J0KGYpfXJldHVybiB3JiYoTj1rLGw9VCkseH07cmV0dXJuIG8/b3Qocyk6c31zPXN0LmNvbXBpbGU9ZnVuY3Rpb24oZSx0KXt2YXIgbixyPVtdLGk9W10sbz1TW2UrXCIgXCJdO2lmKCFvKXt0fHwodD1mdChlKSksbj10Lmxlbmd0aDt3aGlsZShuLS0pbz12dCh0W25dKSxvW3hdP3IucHVzaChvKTppLnB1c2gobyk7bz1TKGUsYnQoaSxyKSl9cmV0dXJuIG99O2Z1bmN0aW9uIHh0KGUsdCxuKXt2YXIgcj0wLGk9dC5sZW5ndGg7Zm9yKDtpPnI7cisrKXN0KGUsdFtyXSxuKTtyZXR1cm4gbn1mdW5jdGlvbiB3dChlLHQsbixyKXt2YXIgbyxhLHUsbCxjLHA9ZnQoZSk7aWYoIXImJjE9PT1wLmxlbmd0aCl7aWYoYT1wWzBdPXBbMF0uc2xpY2UoMCksYS5sZW5ndGg+MiYmXCJJRFwiPT09KHU9YVswXSkudHlwZSYmOT09PXQubm9kZVR5cGUmJiFkJiZpLnJlbGF0aXZlW2FbMV0udHlwZV0pe2lmKHQ9aS5maW5kLklEKHUubWF0Y2hlc1swXS5yZXBsYWNlKGV0LHR0KSx0KVswXSwhdClyZXR1cm4gbjtlPWUuc2xpY2UoYS5zaGlmdCgpLnZhbHVlLmxlbmd0aCl9bz1VLm5lZWRzQ29udGV4dC50ZXN0KGUpPzA6YS5sZW5ndGg7d2hpbGUoby0tKXtpZih1PWFbb10saS5yZWxhdGl2ZVtsPXUudHlwZV0pYnJlYWs7aWYoKGM9aS5maW5kW2xdKSYmKHI9Yyh1Lm1hdGNoZXNbMF0ucmVwbGFjZShldCx0dCksVi50ZXN0KGFbMF0udHlwZSkmJnQucGFyZW50Tm9kZXx8dCkpKXtpZihhLnNwbGljZShvLDEpLGU9ci5sZW5ndGgmJmR0KGEpLCFlKXJldHVybiBILmFwcGx5KG4scS5jYWxsKHIsMCkpLG47YnJlYWt9fX1yZXR1cm4gcyhlLHApKHIsdCxkLG4sVi50ZXN0KGUpKSxufWkucHNldWRvcy5udGg9aS5wc2V1ZG9zLmVxO2Z1bmN0aW9uIFR0KCl7fWkuZmlsdGVycz1UdC5wcm90b3R5cGU9aS5wc2V1ZG9zLGkuc2V0RmlsdGVycz1uZXcgVHQsYygpLHN0LmF0dHI9Yi5hdHRyLGIuZmluZD1zdCxiLmV4cHI9c3Quc2VsZWN0b3JzLGIuZXhwcltcIjpcIl09Yi5leHByLnBzZXVkb3MsYi51bmlxdWU9c3QudW5pcXVlU29ydCxiLnRleHQ9c3QuZ2V0VGV4dCxiLmlzWE1MRG9jPXN0LmlzWE1MLGIuY29udGFpbnM9c3QuY29udGFpbnN9KGUpO3ZhciBhdD0vVW50aWwkLyxzdD0vXig/OnBhcmVudHN8cHJldig/OlVudGlsfEFsbCkpLyx1dD0vXi5bXjojXFxbXFwuLF0qJC8sbHQ9Yi5leHByLm1hdGNoLm5lZWRzQ29udGV4dCxjdD17Y2hpbGRyZW46ITAsY29udGVudHM6ITAsbmV4dDohMCxwcmV2OiEwfTtiLmZuLmV4dGVuZCh7ZmluZDpmdW5jdGlvbihlKXt2YXIgdCxuLHIsaT10aGlzLmxlbmd0aDtpZihcInN0cmluZ1wiIT10eXBlb2YgZSlyZXR1cm4gcj10aGlzLHRoaXMucHVzaFN0YWNrKGIoZSkuZmlsdGVyKGZ1bmN0aW9uKCl7Zm9yKHQ9MDtpPnQ7dCsrKWlmKGIuY29udGFpbnMoclt0XSx0aGlzKSlyZXR1cm4hMH0pKTtmb3Iobj1bXSx0PTA7aT50O3QrKyliLmZpbmQoZSx0aGlzW3RdLG4pO3JldHVybiBuPXRoaXMucHVzaFN0YWNrKGk+MT9iLnVuaXF1ZShuKTpuKSxuLnNlbGVjdG9yPSh0aGlzLnNlbGVjdG9yP3RoaXMuc2VsZWN0b3IrXCIgXCI6XCJcIikrZSxufSxoYXM6ZnVuY3Rpb24oZSl7dmFyIHQsbj1iKGUsdGhpcykscj1uLmxlbmd0aDtyZXR1cm4gdGhpcy5maWx0ZXIoZnVuY3Rpb24oKXtmb3IodD0wO3I+dDt0KyspaWYoYi5jb250YWlucyh0aGlzLG5bdF0pKXJldHVybiEwfSl9LG5vdDpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5wdXNoU3RhY2soZnQodGhpcyxlLCExKSl9LGZpbHRlcjpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5wdXNoU3RhY2soZnQodGhpcyxlLCEwKSl9LGlzOmZ1bmN0aW9uKGUpe3JldHVybiEhZSYmKFwic3RyaW5nXCI9PXR5cGVvZiBlP2x0LnRlc3QoZSk/YihlLHRoaXMuY29udGV4dCkuaW5kZXgodGhpc1swXSk+PTA6Yi5maWx0ZXIoZSx0aGlzKS5sZW5ndGg+MDp0aGlzLmZpbHRlcihlKS5sZW5ndGg+MCl9LGNsb3Nlc3Q6ZnVuY3Rpb24oZSx0KXt2YXIgbixyPTAsaT10aGlzLmxlbmd0aCxvPVtdLGE9bHQudGVzdChlKXx8XCJzdHJpbmdcIiE9dHlwZW9mIGU/YihlLHR8fHRoaXMuY29udGV4dCk6MDtmb3IoO2k+cjtyKyspe249dGhpc1tyXTt3aGlsZShuJiZuLm93bmVyRG9jdW1lbnQmJm4hPT10JiYxMSE9PW4ubm9kZVR5cGUpe2lmKGE/YS5pbmRleChuKT4tMTpiLmZpbmQubWF0Y2hlc1NlbGVjdG9yKG4sZSkpe28ucHVzaChuKTticmVha31uPW4ucGFyZW50Tm9kZX19cmV0dXJuIHRoaXMucHVzaFN0YWNrKG8ubGVuZ3RoPjE/Yi51bmlxdWUobyk6byl9LGluZGV4OmZ1bmN0aW9uKGUpe3JldHVybiBlP1wic3RyaW5nXCI9PXR5cGVvZiBlP2IuaW5BcnJheSh0aGlzWzBdLGIoZSkpOmIuaW5BcnJheShlLmpxdWVyeT9lWzBdOmUsdGhpcyk6dGhpc1swXSYmdGhpc1swXS5wYXJlbnROb2RlP3RoaXMuZmlyc3QoKS5wcmV2QWxsKCkubGVuZ3RoOi0xfSxhZGQ6ZnVuY3Rpb24oZSx0KXt2YXIgbj1cInN0cmluZ1wiPT10eXBlb2YgZT9iKGUsdCk6Yi5tYWtlQXJyYXkoZSYmZS5ub2RlVHlwZT9bZV06ZSkscj1iLm1lcmdlKHRoaXMuZ2V0KCksbik7cmV0dXJuIHRoaXMucHVzaFN0YWNrKGIudW5pcXVlKHIpKX0sYWRkQmFjazpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5hZGQobnVsbD09ZT90aGlzLnByZXZPYmplY3Q6dGhpcy5wcmV2T2JqZWN0LmZpbHRlcihlKSl9fSksYi5mbi5hbmRTZWxmPWIuZm4uYWRkQmFjaztmdW5jdGlvbiBwdChlLHQpe2RvIGU9ZVt0XTt3aGlsZShlJiYxIT09ZS5ub2RlVHlwZSk7cmV0dXJuIGV9Yi5lYWNoKHtwYXJlbnQ6ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5wYXJlbnROb2RlO3JldHVybiB0JiYxMSE9PXQubm9kZVR5cGU/dDpudWxsfSxwYXJlbnRzOmZ1bmN0aW9uKGUpe3JldHVybiBiLmRpcihlLFwicGFyZW50Tm9kZVwiKX0scGFyZW50c1VudGlsOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gYi5kaXIoZSxcInBhcmVudE5vZGVcIixuKX0sbmV4dDpmdW5jdGlvbihlKXtyZXR1cm4gcHQoZSxcIm5leHRTaWJsaW5nXCIpfSxwcmV2OmZ1bmN0aW9uKGUpe3JldHVybiBwdChlLFwicHJldmlvdXNTaWJsaW5nXCIpfSxuZXh0QWxsOmZ1bmN0aW9uKGUpe3JldHVybiBiLmRpcihlLFwibmV4dFNpYmxpbmdcIil9LHByZXZBbGw6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuZGlyKGUsXCJwcmV2aW91c1NpYmxpbmdcIil9LG5leHRVbnRpbDpmdW5jdGlvbihlLHQsbil7cmV0dXJuIGIuZGlyKGUsXCJuZXh0U2libGluZ1wiLG4pfSxwcmV2VW50aWw6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBiLmRpcihlLFwicHJldmlvdXNTaWJsaW5nXCIsbil9LHNpYmxpbmdzOmZ1bmN0aW9uKGUpe3JldHVybiBiLnNpYmxpbmcoKGUucGFyZW50Tm9kZXx8e30pLmZpcnN0Q2hpbGQsZSl9LGNoaWxkcmVuOmZ1bmN0aW9uKGUpe3JldHVybiBiLnNpYmxpbmcoZS5maXJzdENoaWxkKX0sY29udGVudHM6ZnVuY3Rpb24oZSl7cmV0dXJuIGIubm9kZU5hbWUoZSxcImlmcmFtZVwiKT9lLmNvbnRlbnREb2N1bWVudHx8ZS5jb250ZW50V2luZG93LmRvY3VtZW50OmIubWVyZ2UoW10sZS5jaGlsZE5vZGVzKX19LGZ1bmN0aW9uKGUsdCl7Yi5mbltlXT1mdW5jdGlvbihuLHIpe3ZhciBpPWIubWFwKHRoaXMsdCxuKTtyZXR1cm4gYXQudGVzdChlKXx8KHI9biksciYmXCJzdHJpbmdcIj09dHlwZW9mIHImJihpPWIuZmlsdGVyKHIsaSkpLGk9dGhpcy5sZW5ndGg+MSYmIWN0W2VdP2IudW5pcXVlKGkpOmksdGhpcy5sZW5ndGg+MSYmc3QudGVzdChlKSYmKGk9aS5yZXZlcnNlKCkpLHRoaXMucHVzaFN0YWNrKGkpfX0pLGIuZXh0ZW5kKHtmaWx0ZXI6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBuJiYoZT1cIjpub3QoXCIrZStcIilcIiksMT09PXQubGVuZ3RoP2IuZmluZC5tYXRjaGVzU2VsZWN0b3IodFswXSxlKT9bdFswXV06W106Yi5maW5kLm1hdGNoZXMoZSx0KX0sZGlyOmZ1bmN0aW9uKGUsbixyKXt2YXIgaT1bXSxvPWVbbl07d2hpbGUobyYmOSE9PW8ubm9kZVR5cGUmJihyPT09dHx8MSE9PW8ubm9kZVR5cGV8fCFiKG8pLmlzKHIpKSkxPT09by5ub2RlVHlwZSYmaS5wdXNoKG8pLG89b1tuXTtyZXR1cm4gaX0sc2libGluZzpmdW5jdGlvbihlLHQpe3ZhciBuPVtdO2Zvcig7ZTtlPWUubmV4dFNpYmxpbmcpMT09PWUubm9kZVR5cGUmJmUhPT10JiZuLnB1c2goZSk7cmV0dXJuIG59fSk7ZnVuY3Rpb24gZnQoZSx0LG4pe2lmKHQ9dHx8MCxiLmlzRnVuY3Rpb24odCkpcmV0dXJuIGIuZ3JlcChlLGZ1bmN0aW9uKGUscil7dmFyIGk9ISF0LmNhbGwoZSxyLGUpO3JldHVybiBpPT09bn0pO2lmKHQubm9kZVR5cGUpcmV0dXJuIGIuZ3JlcChlLGZ1bmN0aW9uKGUpe3JldHVybiBlPT09dD09PW59KTtpZihcInN0cmluZ1wiPT10eXBlb2YgdCl7dmFyIHI9Yi5ncmVwKGUsZnVuY3Rpb24oZSl7cmV0dXJuIDE9PT1lLm5vZGVUeXBlfSk7aWYodXQudGVzdCh0KSlyZXR1cm4gYi5maWx0ZXIodCxyLCFuKTt0PWIuZmlsdGVyKHQscil9cmV0dXJuIGIuZ3JlcChlLGZ1bmN0aW9uKGUpe3JldHVybiBiLmluQXJyYXkoZSx0KT49MD09PW59KX1mdW5jdGlvbiBkdChlKXt2YXIgdD1odC5zcGxpdChcInxcIiksbj1lLmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtpZihuLmNyZWF0ZUVsZW1lbnQpd2hpbGUodC5sZW5ndGgpbi5jcmVhdGVFbGVtZW50KHQucG9wKCkpO3JldHVybiBufXZhciBodD1cImFiYnJ8YXJ0aWNsZXxhc2lkZXxhdWRpb3xiZGl8Y2FudmFzfGRhdGF8ZGF0YWxpc3R8ZGV0YWlsc3xmaWdjYXB0aW9ufGZpZ3VyZXxmb290ZXJ8aGVhZGVyfGhncm91cHxtYXJrfG1ldGVyfG5hdnxvdXRwdXR8cHJvZ3Jlc3N8c2VjdGlvbnxzdW1tYXJ5fHRpbWV8dmlkZW9cIixndD0vIGpRdWVyeVxcZCs9XCIoPzpudWxsfFxcZCspXCIvZyxtdD1SZWdFeHAoXCI8KD86XCIraHQrXCIpW1xcXFxzLz5dXCIsXCJpXCIpLHl0PS9eXFxzKy8sdnQ9LzwoPyFhcmVhfGJyfGNvbHxlbWJlZHxocnxpbWd8aW5wdXR8bGlua3xtZXRhfHBhcmFtKSgoW1xcdzpdKylbXj5dKilcXC8+L2dpLGJ0PS88KFtcXHc6XSspLyx4dD0vPHRib2R5L2ksd3Q9Lzx8JiM/XFx3KzsvLFR0PS88KD86c2NyaXB0fHN0eWxlfGxpbmspL2ksTnQ9L14oPzpjaGVja2JveHxyYWRpbykkL2ksQ3Q9L2NoZWNrZWRcXHMqKD86W149XXw9XFxzKi5jaGVja2VkLikvaSxrdD0vXiR8XFwvKD86amF2YXxlY21hKXNjcmlwdC9pLEV0PS9edHJ1ZVxcLyguKikvLFN0PS9eXFxzKjwhKD86XFxbQ0RBVEFcXFt8LS0pfCg/OlxcXVxcXXwtLSk+XFxzKiQvZyxBdD17b3B0aW9uOlsxLFwiPHNlbGVjdCBtdWx0aXBsZT0nbXVsdGlwbGUnPlwiLFwiPC9zZWxlY3Q+XCJdLGxlZ2VuZDpbMSxcIjxmaWVsZHNldD5cIixcIjwvZmllbGRzZXQ+XCJdLGFyZWE6WzEsXCI8bWFwPlwiLFwiPC9tYXA+XCJdLHBhcmFtOlsxLFwiPG9iamVjdD5cIixcIjwvb2JqZWN0PlwiXSx0aGVhZDpbMSxcIjx0YWJsZT5cIixcIjwvdGFibGU+XCJdLHRyOlsyLFwiPHRhYmxlPjx0Ym9keT5cIixcIjwvdGJvZHk+PC90YWJsZT5cIl0sY29sOlsyLFwiPHRhYmxlPjx0Ym9keT48L3Rib2R5Pjxjb2xncm91cD5cIixcIjwvY29sZ3JvdXA+PC90YWJsZT5cIl0sdGQ6WzMsXCI8dGFibGU+PHRib2R5Pjx0cj5cIixcIjwvdHI+PC90Ym9keT48L3RhYmxlPlwiXSxfZGVmYXVsdDpiLnN1cHBvcnQuaHRtbFNlcmlhbGl6ZT9bMCxcIlwiLFwiXCJdOlsxLFwiWDxkaXY+XCIsXCI8L2Rpdj5cIl19LGp0PWR0KG8pLER0PWp0LmFwcGVuZENoaWxkKG8uY3JlYXRlRWxlbWVudChcImRpdlwiKSk7QXQub3B0Z3JvdXA9QXQub3B0aW9uLEF0LnRib2R5PUF0LnRmb290PUF0LmNvbGdyb3VwPUF0LmNhcHRpb249QXQudGhlYWQsQXQudGg9QXQudGQsYi5mbi5leHRlbmQoe3RleHQ6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuYWNjZXNzKHRoaXMsZnVuY3Rpb24oZSl7cmV0dXJuIGU9PT10P2IudGV4dCh0aGlzKTp0aGlzLmVtcHR5KCkuYXBwZW5kKCh0aGlzWzBdJiZ0aGlzWzBdLm93bmVyRG9jdW1lbnR8fG8pLmNyZWF0ZVRleHROb2RlKGUpKX0sbnVsbCxlLGFyZ3VtZW50cy5sZW5ndGgpfSx3cmFwQWxsOmZ1bmN0aW9uKGUpe2lmKGIuaXNGdW5jdGlvbihlKSlyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKHQpe2IodGhpcykud3JhcEFsbChlLmNhbGwodGhpcyx0KSl9KTtpZih0aGlzWzBdKXt2YXIgdD1iKGUsdGhpc1swXS5vd25lckRvY3VtZW50KS5lcSgwKS5jbG9uZSghMCk7dGhpc1swXS5wYXJlbnROb2RlJiZ0Lmluc2VydEJlZm9yZSh0aGlzWzBdKSx0Lm1hcChmdW5jdGlvbigpe3ZhciBlPXRoaXM7d2hpbGUoZS5maXJzdENoaWxkJiYxPT09ZS5maXJzdENoaWxkLm5vZGVUeXBlKWU9ZS5maXJzdENoaWxkO3JldHVybiBlfSkuYXBwZW5kKHRoaXMpfXJldHVybiB0aGlzfSx3cmFwSW5uZXI6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuaXNGdW5jdGlvbihlKT90aGlzLmVhY2goZnVuY3Rpb24odCl7Yih0aGlzKS53cmFwSW5uZXIoZS5jYWxsKHRoaXMsdCkpfSk6dGhpcy5lYWNoKGZ1bmN0aW9uKCl7dmFyIHQ9Yih0aGlzKSxuPXQuY29udGVudHMoKTtuLmxlbmd0aD9uLndyYXBBbGwoZSk6dC5hcHBlbmQoZSl9KX0sd3JhcDpmdW5jdGlvbihlKXt2YXIgdD1iLmlzRnVuY3Rpb24oZSk7cmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbihuKXtiKHRoaXMpLndyYXBBbGwodD9lLmNhbGwodGhpcyxuKTplKX0pfSx1bndyYXA6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5wYXJlbnQoKS5lYWNoKGZ1bmN0aW9uKCl7Yi5ub2RlTmFtZSh0aGlzLFwiYm9keVwiKXx8Yih0aGlzKS5yZXBsYWNlV2l0aCh0aGlzLmNoaWxkTm9kZXMpfSkuZW5kKCl9LGFwcGVuZDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRvbU1hbmlwKGFyZ3VtZW50cywhMCxmdW5jdGlvbihlKXsoMT09PXRoaXMubm9kZVR5cGV8fDExPT09dGhpcy5ub2RlVHlwZXx8OT09PXRoaXMubm9kZVR5cGUpJiZ0aGlzLmFwcGVuZENoaWxkKGUpfSl9LHByZXBlbmQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kb21NYW5pcChhcmd1bWVudHMsITAsZnVuY3Rpb24oZSl7KDE9PT10aGlzLm5vZGVUeXBlfHwxMT09PXRoaXMubm9kZVR5cGV8fDk9PT10aGlzLm5vZGVUeXBlKSYmdGhpcy5pbnNlcnRCZWZvcmUoZSx0aGlzLmZpcnN0Q2hpbGQpfSl9LGJlZm9yZTpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRvbU1hbmlwKGFyZ3VtZW50cywhMSxmdW5jdGlvbihlKXt0aGlzLnBhcmVudE5vZGUmJnRoaXMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZSx0aGlzKX0pfSxhZnRlcjpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRvbU1hbmlwKGFyZ3VtZW50cywhMSxmdW5jdGlvbihlKXt0aGlzLnBhcmVudE5vZGUmJnRoaXMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoZSx0aGlzLm5leHRTaWJsaW5nKX0pfSxyZW1vdmU6ZnVuY3Rpb24oZSx0KXt2YXIgbixyPTA7Zm9yKDtudWxsIT0obj10aGlzW3JdKTtyKyspKCFlfHxiLmZpbHRlcihlLFtuXSkubGVuZ3RoPjApJiYodHx8MSE9PW4ubm9kZVR5cGV8fGIuY2xlYW5EYXRhKE90KG4pKSxuLnBhcmVudE5vZGUmJih0JiZiLmNvbnRhaW5zKG4ub3duZXJEb2N1bWVudCxuKSYmTXQoT3QobixcInNjcmlwdFwiKSksbi5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG4pKSk7cmV0dXJuIHRoaXN9LGVtcHR5OmZ1bmN0aW9uKCl7dmFyIGUsdD0wO2Zvcig7bnVsbCE9KGU9dGhpc1t0XSk7dCsrKXsxPT09ZS5ub2RlVHlwZSYmYi5jbGVhbkRhdGEoT3QoZSwhMSkpO3doaWxlKGUuZmlyc3RDaGlsZCllLnJlbW92ZUNoaWxkKGUuZmlyc3RDaGlsZCk7ZS5vcHRpb25zJiZiLm5vZGVOYW1lKGUsXCJzZWxlY3RcIikmJihlLm9wdGlvbnMubGVuZ3RoPTApfXJldHVybiB0aGlzfSxjbG9uZTpmdW5jdGlvbihlLHQpe3JldHVybiBlPW51bGw9PWU/ITE6ZSx0PW51bGw9PXQ/ZTp0LHRoaXMubWFwKGZ1bmN0aW9uKCl7cmV0dXJuIGIuY2xvbmUodGhpcyxlLHQpfSl9LGh0bWw6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuYWNjZXNzKHRoaXMsZnVuY3Rpb24oZSl7dmFyIG49dGhpc1swXXx8e30scj0wLGk9dGhpcy5sZW5ndGg7aWYoZT09PXQpcmV0dXJuIDE9PT1uLm5vZGVUeXBlP24uaW5uZXJIVE1MLnJlcGxhY2UoZ3QsXCJcIik6dDtpZighKFwic3RyaW5nXCIhPXR5cGVvZiBlfHxUdC50ZXN0KGUpfHwhYi5zdXBwb3J0Lmh0bWxTZXJpYWxpemUmJm10LnRlc3QoZSl8fCFiLnN1cHBvcnQubGVhZGluZ1doaXRlc3BhY2UmJnl0LnRlc3QoZSl8fEF0WyhidC5leGVjKGUpfHxbXCJcIixcIlwiXSlbMV0udG9Mb3dlckNhc2UoKV0pKXtlPWUucmVwbGFjZSh2dCxcIjwkMT48LyQyPlwiKTt0cnl7Zm9yKDtpPnI7cisrKW49dGhpc1tyXXx8e30sMT09PW4ubm9kZVR5cGUmJihiLmNsZWFuRGF0YShPdChuLCExKSksbi5pbm5lckhUTUw9ZSk7bj0wfWNhdGNoKG8pe319biYmdGhpcy5lbXB0eSgpLmFwcGVuZChlKX0sbnVsbCxlLGFyZ3VtZW50cy5sZW5ndGgpfSxyZXBsYWNlV2l0aDpmdW5jdGlvbihlKXt2YXIgdD1iLmlzRnVuY3Rpb24oZSk7cmV0dXJuIHR8fFwic3RyaW5nXCI9PXR5cGVvZiBlfHwoZT1iKGUpLm5vdCh0aGlzKS5kZXRhY2goKSksdGhpcy5kb21NYW5pcChbZV0sITAsZnVuY3Rpb24oZSl7dmFyIHQ9dGhpcy5uZXh0U2libGluZyxuPXRoaXMucGFyZW50Tm9kZTtuJiYoYih0aGlzKS5yZW1vdmUoKSxuLmluc2VydEJlZm9yZShlLHQpKX0pfSxkZXRhY2g6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMucmVtb3ZlKGUsITApfSxkb21NYW5pcDpmdW5jdGlvbihlLG4scil7ZT1mLmFwcGx5KFtdLGUpO3ZhciBpLG8sYSxzLHUsbCxjPTAscD10aGlzLmxlbmd0aCxkPXRoaXMsaD1wLTEsZz1lWzBdLG09Yi5pc0Z1bmN0aW9uKGcpO2lmKG18fCEoMT49cHx8XCJzdHJpbmdcIiE9dHlwZW9mIGd8fGIuc3VwcG9ydC5jaGVja0Nsb25lKSYmQ3QudGVzdChnKSlyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKGkpe3ZhciBvPWQuZXEoaSk7bSYmKGVbMF09Zy5jYWxsKHRoaXMsaSxuP28uaHRtbCgpOnQpKSxvLmRvbU1hbmlwKGUsbixyKX0pO2lmKHAmJihsPWIuYnVpbGRGcmFnbWVudChlLHRoaXNbMF0ub3duZXJEb2N1bWVudCwhMSx0aGlzKSxpPWwuZmlyc3RDaGlsZCwxPT09bC5jaGlsZE5vZGVzLmxlbmd0aCYmKGw9aSksaSkpe2ZvcihuPW4mJmIubm9kZU5hbWUoaSxcInRyXCIpLHM9Yi5tYXAoT3QobCxcInNjcmlwdFwiKSxIdCksYT1zLmxlbmd0aDtwPmM7YysrKW89bCxjIT09aCYmKG89Yi5jbG9uZShvLCEwLCEwKSxhJiZiLm1lcmdlKHMsT3QobyxcInNjcmlwdFwiKSkpLHIuY2FsbChuJiZiLm5vZGVOYW1lKHRoaXNbY10sXCJ0YWJsZVwiKT9MdCh0aGlzW2NdLFwidGJvZHlcIik6dGhpc1tjXSxvLGMpO2lmKGEpZm9yKHU9c1tzLmxlbmd0aC0xXS5vd25lckRvY3VtZW50LGIubWFwKHMscXQpLGM9MDthPmM7YysrKW89c1tjXSxrdC50ZXN0KG8udHlwZXx8XCJcIikmJiFiLl9kYXRhKG8sXCJnbG9iYWxFdmFsXCIpJiZiLmNvbnRhaW5zKHUsbykmJihvLnNyYz9iLmFqYXgoe3VybDpvLnNyYyx0eXBlOlwiR0VUXCIsZGF0YVR5cGU6XCJzY3JpcHRcIixhc3luYzohMSxnbG9iYWw6ITEsXCJ0aHJvd3NcIjohMH0pOmIuZ2xvYmFsRXZhbCgoby50ZXh0fHxvLnRleHRDb250ZW50fHxvLmlubmVySFRNTHx8XCJcIikucmVwbGFjZShTdCxcIlwiKSkpO2w9aT1udWxsfXJldHVybiB0aGlzfX0pO2Z1bmN0aW9uIEx0KGUsdCl7cmV0dXJuIGUuZ2V0RWxlbWVudHNCeVRhZ05hbWUodClbMF18fGUuYXBwZW5kQ2hpbGQoZS5vd25lckRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodCkpfWZ1bmN0aW9uIEh0KGUpe3ZhciB0PWUuZ2V0QXR0cmlidXRlTm9kZShcInR5cGVcIik7cmV0dXJuIGUudHlwZT0odCYmdC5zcGVjaWZpZWQpK1wiL1wiK2UudHlwZSxlfWZ1bmN0aW9uIHF0KGUpe3ZhciB0PUV0LmV4ZWMoZS50eXBlKTtyZXR1cm4gdD9lLnR5cGU9dFsxXTplLnJlbW92ZUF0dHJpYnV0ZShcInR5cGVcIiksZX1mdW5jdGlvbiBNdChlLHQpe3ZhciBuLHI9MDtmb3IoO251bGwhPShuPWVbcl0pO3IrKyliLl9kYXRhKG4sXCJnbG9iYWxFdmFsXCIsIXR8fGIuX2RhdGEodFtyXSxcImdsb2JhbEV2YWxcIikpfWZ1bmN0aW9uIF90KGUsdCl7aWYoMT09PXQubm9kZVR5cGUmJmIuaGFzRGF0YShlKSl7dmFyIG4scixpLG89Yi5fZGF0YShlKSxhPWIuX2RhdGEodCxvKSxzPW8uZXZlbnRzO2lmKHMpe2RlbGV0ZSBhLmhhbmRsZSxhLmV2ZW50cz17fTtmb3IobiBpbiBzKWZvcihyPTAsaT1zW25dLmxlbmd0aDtpPnI7cisrKWIuZXZlbnQuYWRkKHQsbixzW25dW3JdKX1hLmRhdGEmJihhLmRhdGE9Yi5leHRlbmQoe30sYS5kYXRhKSl9fWZ1bmN0aW9uIEZ0KGUsdCl7dmFyIG4scixpO2lmKDE9PT10Lm5vZGVUeXBlKXtpZihuPXQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSwhYi5zdXBwb3J0Lm5vQ2xvbmVFdmVudCYmdFtiLmV4cGFuZG9dKXtpPWIuX2RhdGEodCk7Zm9yKHIgaW4gaS5ldmVudHMpYi5yZW1vdmVFdmVudCh0LHIsaS5oYW5kbGUpO3QucmVtb3ZlQXR0cmlidXRlKGIuZXhwYW5kbyl9XCJzY3JpcHRcIj09PW4mJnQudGV4dCE9PWUudGV4dD8oSHQodCkudGV4dD1lLnRleHQscXQodCkpOlwib2JqZWN0XCI9PT1uPyh0LnBhcmVudE5vZGUmJih0Lm91dGVySFRNTD1lLm91dGVySFRNTCksYi5zdXBwb3J0Lmh0bWw1Q2xvbmUmJmUuaW5uZXJIVE1MJiYhYi50cmltKHQuaW5uZXJIVE1MKSYmKHQuaW5uZXJIVE1MPWUuaW5uZXJIVE1MKSk6XCJpbnB1dFwiPT09biYmTnQudGVzdChlLnR5cGUpPyh0LmRlZmF1bHRDaGVja2VkPXQuY2hlY2tlZD1lLmNoZWNrZWQsdC52YWx1ZSE9PWUudmFsdWUmJih0LnZhbHVlPWUudmFsdWUpKTpcIm9wdGlvblwiPT09bj90LmRlZmF1bHRTZWxlY3RlZD10LnNlbGVjdGVkPWUuZGVmYXVsdFNlbGVjdGVkOihcImlucHV0XCI9PT1ufHxcInRleHRhcmVhXCI9PT1uKSYmKHQuZGVmYXVsdFZhbHVlPWUuZGVmYXVsdFZhbHVlKX19Yi5lYWNoKHthcHBlbmRUbzpcImFwcGVuZFwiLHByZXBlbmRUbzpcInByZXBlbmRcIixpbnNlcnRCZWZvcmU6XCJiZWZvcmVcIixpbnNlcnRBZnRlcjpcImFmdGVyXCIscmVwbGFjZUFsbDpcInJlcGxhY2VXaXRoXCJ9LGZ1bmN0aW9uKGUsdCl7Yi5mbltlXT1mdW5jdGlvbihlKXt2YXIgbixyPTAsaT1bXSxvPWIoZSksYT1vLmxlbmd0aC0xO2Zvcig7YT49cjtyKyspbj1yPT09YT90aGlzOnRoaXMuY2xvbmUoITApLGIob1tyXSlbdF0obiksZC5hcHBseShpLG4uZ2V0KCkpO3JldHVybiB0aGlzLnB1c2hTdGFjayhpKX19KTtmdW5jdGlvbiBPdChlLG4pe3ZhciByLG8sYT0wLHM9dHlwZW9mIGUuZ2V0RWxlbWVudHNCeVRhZ05hbWUhPT1pP2UuZ2V0RWxlbWVudHNCeVRhZ05hbWUobnx8XCIqXCIpOnR5cGVvZiBlLnF1ZXJ5U2VsZWN0b3JBbGwhPT1pP2UucXVlcnlTZWxlY3RvckFsbChufHxcIipcIik6dDtpZighcylmb3Iocz1bXSxyPWUuY2hpbGROb2Rlc3x8ZTtudWxsIT0obz1yW2FdKTthKyspIW58fGIubm9kZU5hbWUobyxuKT9zLnB1c2gobyk6Yi5tZXJnZShzLE90KG8sbikpO3JldHVybiBuPT09dHx8biYmYi5ub2RlTmFtZShlLG4pP2IubWVyZ2UoW2VdLHMpOnN9ZnVuY3Rpb24gQnQoZSl7TnQudGVzdChlLnR5cGUpJiYoZS5kZWZhdWx0Q2hlY2tlZD1lLmNoZWNrZWQpfWIuZXh0ZW5kKHtjbG9uZTpmdW5jdGlvbihlLHQsbil7dmFyIHIsaSxvLGEscyx1PWIuY29udGFpbnMoZS5vd25lckRvY3VtZW50LGUpO2lmKGIuc3VwcG9ydC5odG1sNUNsb25lfHxiLmlzWE1MRG9jKGUpfHwhbXQudGVzdChcIjxcIitlLm5vZGVOYW1lK1wiPlwiKT9vPWUuY2xvbmVOb2RlKCEwKTooRHQuaW5uZXJIVE1MPWUub3V0ZXJIVE1MLER0LnJlbW92ZUNoaWxkKG89RHQuZmlyc3RDaGlsZCkpLCEoYi5zdXBwb3J0Lm5vQ2xvbmVFdmVudCYmYi5zdXBwb3J0Lm5vQ2xvbmVDaGVja2VkfHwxIT09ZS5ub2RlVHlwZSYmMTEhPT1lLm5vZGVUeXBlfHxiLmlzWE1MRG9jKGUpKSlmb3Iocj1PdChvKSxzPU90KGUpLGE9MDtudWxsIT0oaT1zW2FdKTsrK2EpclthXSYmRnQoaSxyW2FdKTtpZih0KWlmKG4pZm9yKHM9c3x8T3QoZSkscj1yfHxPdChvKSxhPTA7bnVsbCE9KGk9c1thXSk7YSsrKV90KGksclthXSk7ZWxzZSBfdChlLG8pO3JldHVybiByPU90KG8sXCJzY3JpcHRcIiksci5sZW5ndGg+MCYmTXQociwhdSYmT3QoZSxcInNjcmlwdFwiKSkscj1zPWk9bnVsbCxvfSxidWlsZEZyYWdtZW50OmZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpLG8sYSxzLHUsbCxjLHA9ZS5sZW5ndGgsZj1kdCh0KSxkPVtdLGg9MDtmb3IoO3A+aDtoKyspaWYobz1lW2hdLG98fDA9PT1vKWlmKFwib2JqZWN0XCI9PT1iLnR5cGUobykpYi5tZXJnZShkLG8ubm9kZVR5cGU/W29dOm8pO2Vsc2UgaWYod3QudGVzdChvKSl7cz1zfHxmLmFwcGVuZENoaWxkKHQuY3JlYXRlRWxlbWVudChcImRpdlwiKSksdT0oYnQuZXhlYyhvKXx8W1wiXCIsXCJcIl0pWzFdLnRvTG93ZXJDYXNlKCksYz1BdFt1XXx8QXQuX2RlZmF1bHQscy5pbm5lckhUTUw9Y1sxXStvLnJlcGxhY2UodnQsXCI8JDE+PC8kMj5cIikrY1syXSxpPWNbMF07d2hpbGUoaS0tKXM9cy5sYXN0Q2hpbGQ7aWYoIWIuc3VwcG9ydC5sZWFkaW5nV2hpdGVzcGFjZSYmeXQudGVzdChvKSYmZC5wdXNoKHQuY3JlYXRlVGV4dE5vZGUoeXQuZXhlYyhvKVswXSkpLCFiLnN1cHBvcnQudGJvZHkpe289XCJ0YWJsZVwiIT09dXx8eHQudGVzdChvKT9cIjx0YWJsZT5cIiE9PWNbMV18fHh0LnRlc3Qobyk/MDpzOnMuZmlyc3RDaGlsZCxpPW8mJm8uY2hpbGROb2Rlcy5sZW5ndGg7d2hpbGUoaS0tKWIubm9kZU5hbWUobD1vLmNoaWxkTm9kZXNbaV0sXCJ0Ym9keVwiKSYmIWwuY2hpbGROb2Rlcy5sZW5ndGgmJm8ucmVtb3ZlQ2hpbGQobClcbn1iLm1lcmdlKGQscy5jaGlsZE5vZGVzKSxzLnRleHRDb250ZW50PVwiXCI7d2hpbGUocy5maXJzdENoaWxkKXMucmVtb3ZlQ2hpbGQocy5maXJzdENoaWxkKTtzPWYubGFzdENoaWxkfWVsc2UgZC5wdXNoKHQuY3JlYXRlVGV4dE5vZGUobykpO3MmJmYucmVtb3ZlQ2hpbGQocyksYi5zdXBwb3J0LmFwcGVuZENoZWNrZWR8fGIuZ3JlcChPdChkLFwiaW5wdXRcIiksQnQpLGg9MDt3aGlsZShvPWRbaCsrXSlpZigoIXJ8fC0xPT09Yi5pbkFycmF5KG8scikpJiYoYT1iLmNvbnRhaW5zKG8ub3duZXJEb2N1bWVudCxvKSxzPU90KGYuYXBwZW5kQ2hpbGQobyksXCJzY3JpcHRcIiksYSYmTXQocyksbikpe2k9MDt3aGlsZShvPXNbaSsrXSlrdC50ZXN0KG8udHlwZXx8XCJcIikmJm4ucHVzaChvKX1yZXR1cm4gcz1udWxsLGZ9LGNsZWFuRGF0YTpmdW5jdGlvbihlLHQpe3ZhciBuLHIsbyxhLHM9MCx1PWIuZXhwYW5kbyxsPWIuY2FjaGUscD1iLnN1cHBvcnQuZGVsZXRlRXhwYW5kbyxmPWIuZXZlbnQuc3BlY2lhbDtmb3IoO251bGwhPShuPWVbc10pO3MrKylpZigodHx8Yi5hY2NlcHREYXRhKG4pKSYmKG89blt1XSxhPW8mJmxbb10pKXtpZihhLmV2ZW50cylmb3IociBpbiBhLmV2ZW50cylmW3JdP2IuZXZlbnQucmVtb3ZlKG4scik6Yi5yZW1vdmVFdmVudChuLHIsYS5oYW5kbGUpO2xbb10mJihkZWxldGUgbFtvXSxwP2RlbGV0ZSBuW3VdOnR5cGVvZiBuLnJlbW92ZUF0dHJpYnV0ZSE9PWk/bi5yZW1vdmVBdHRyaWJ1dGUodSk6blt1XT1udWxsLGMucHVzaChvKSl9fX0pO3ZhciBQdCxSdCxXdCwkdD0vYWxwaGFcXChbXildKlxcKS9pLEl0PS9vcGFjaXR5XFxzKj1cXHMqKFteKV0qKS8senQ9L14odG9wfHJpZ2h0fGJvdHRvbXxsZWZ0KSQvLFh0PS9eKG5vbmV8dGFibGUoPyEtY1tlYV0pLispLyxVdD0vXm1hcmdpbi8sVnQ9UmVnRXhwKFwiXihcIit4K1wiKSguKikkXCIsXCJpXCIpLFl0PVJlZ0V4cChcIl4oXCIreCtcIikoPyFweClbYS16JV0rJFwiLFwiaVwiKSxKdD1SZWdFeHAoXCJeKFsrLV0pPShcIit4K1wiKVwiLFwiaVwiKSxHdD17Qk9EWTpcImJsb2NrXCJ9LFF0PXtwb3NpdGlvbjpcImFic29sdXRlXCIsdmlzaWJpbGl0eTpcImhpZGRlblwiLGRpc3BsYXk6XCJibG9ja1wifSxLdD17bGV0dGVyU3BhY2luZzowLGZvbnRXZWlnaHQ6NDAwfSxadD1bXCJUb3BcIixcIlJpZ2h0XCIsXCJCb3R0b21cIixcIkxlZnRcIl0sZW49W1wiV2Via2l0XCIsXCJPXCIsXCJNb3pcIixcIm1zXCJdO2Z1bmN0aW9uIHRuKGUsdCl7aWYodCBpbiBlKXJldHVybiB0O3ZhciBuPXQuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkrdC5zbGljZSgxKSxyPXQsaT1lbi5sZW5ndGg7d2hpbGUoaS0tKWlmKHQ9ZW5baV0rbix0IGluIGUpcmV0dXJuIHQ7cmV0dXJuIHJ9ZnVuY3Rpb24gbm4oZSx0KXtyZXR1cm4gZT10fHxlLFwibm9uZVwiPT09Yi5jc3MoZSxcImRpc3BsYXlcIil8fCFiLmNvbnRhaW5zKGUub3duZXJEb2N1bWVudCxlKX1mdW5jdGlvbiBybihlLHQpe3ZhciBuLHIsaSxvPVtdLGE9MCxzPWUubGVuZ3RoO2Zvcig7cz5hO2ErKylyPWVbYV0sci5zdHlsZSYmKG9bYV09Yi5fZGF0YShyLFwib2xkZGlzcGxheVwiKSxuPXIuc3R5bGUuZGlzcGxheSx0PyhvW2FdfHxcIm5vbmVcIiE9PW58fChyLnN0eWxlLmRpc3BsYXk9XCJcIiksXCJcIj09PXIuc3R5bGUuZGlzcGxheSYmbm4ocikmJihvW2FdPWIuX2RhdGEocixcIm9sZGRpc3BsYXlcIix1bihyLm5vZGVOYW1lKSkpKTpvW2FdfHwoaT1ubihyKSwobiYmXCJub25lXCIhPT1ufHwhaSkmJmIuX2RhdGEocixcIm9sZGRpc3BsYXlcIixpP246Yi5jc3MocixcImRpc3BsYXlcIikpKSk7Zm9yKGE9MDtzPmE7YSsrKXI9ZVthXSxyLnN0eWxlJiYodCYmXCJub25lXCIhPT1yLnN0eWxlLmRpc3BsYXkmJlwiXCIhPT1yLnN0eWxlLmRpc3BsYXl8fChyLnN0eWxlLmRpc3BsYXk9dD9vW2FdfHxcIlwiOlwibm9uZVwiKSk7cmV0dXJuIGV9Yi5mbi5leHRlbmQoe2NzczpmdW5jdGlvbihlLG4pe3JldHVybiBiLmFjY2Vzcyh0aGlzLGZ1bmN0aW9uKGUsbixyKXt2YXIgaSxvLGE9e30scz0wO2lmKGIuaXNBcnJheShuKSl7Zm9yKG89UnQoZSksaT1uLmxlbmd0aDtpPnM7cysrKWFbbltzXV09Yi5jc3MoZSxuW3NdLCExLG8pO3JldHVybiBhfXJldHVybiByIT09dD9iLnN0eWxlKGUsbixyKTpiLmNzcyhlLG4pfSxlLG4sYXJndW1lbnRzLmxlbmd0aD4xKX0sc2hvdzpmdW5jdGlvbigpe3JldHVybiBybih0aGlzLCEwKX0saGlkZTpmdW5jdGlvbigpe3JldHVybiBybih0aGlzKX0sdG9nZ2xlOmZ1bmN0aW9uKGUpe3ZhciB0PVwiYm9vbGVhblwiPT10eXBlb2YgZTtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7KHQ/ZTpubih0aGlzKSk/Yih0aGlzKS5zaG93KCk6Yih0aGlzKS5oaWRlKCl9KX19KSxiLmV4dGVuZCh7Y3NzSG9va3M6e29wYWNpdHk6e2dldDpmdW5jdGlvbihlLHQpe2lmKHQpe3ZhciBuPVd0KGUsXCJvcGFjaXR5XCIpO3JldHVyblwiXCI9PT1uP1wiMVwiOm59fX19LGNzc051bWJlcjp7Y29sdW1uQ291bnQ6ITAsZmlsbE9wYWNpdHk6ITAsZm9udFdlaWdodDohMCxsaW5lSGVpZ2h0OiEwLG9wYWNpdHk6ITAsb3JwaGFuczohMCx3aWRvd3M6ITAsekluZGV4OiEwLHpvb206ITB9LGNzc1Byb3BzOntcImZsb2F0XCI6Yi5zdXBwb3J0LmNzc0Zsb2F0P1wiY3NzRmxvYXRcIjpcInN0eWxlRmxvYXRcIn0sc3R5bGU6ZnVuY3Rpb24oZSxuLHIsaSl7aWYoZSYmMyE9PWUubm9kZVR5cGUmJjghPT1lLm5vZGVUeXBlJiZlLnN0eWxlKXt2YXIgbyxhLHMsdT1iLmNhbWVsQ2FzZShuKSxsPWUuc3R5bGU7aWYobj1iLmNzc1Byb3BzW3VdfHwoYi5jc3NQcm9wc1t1XT10bihsLHUpKSxzPWIuY3NzSG9va3Nbbl18fGIuY3NzSG9va3NbdV0scj09PXQpcmV0dXJuIHMmJlwiZ2V0XCJpbiBzJiYobz1zLmdldChlLCExLGkpKSE9PXQ/bzpsW25dO2lmKGE9dHlwZW9mIHIsXCJzdHJpbmdcIj09PWEmJihvPUp0LmV4ZWMocikpJiYocj0ob1sxXSsxKSpvWzJdK3BhcnNlRmxvYXQoYi5jc3MoZSxuKSksYT1cIm51bWJlclwiKSwhKG51bGw9PXJ8fFwibnVtYmVyXCI9PT1hJiZpc05hTihyKXx8KFwibnVtYmVyXCIhPT1hfHxiLmNzc051bWJlclt1XXx8KHIrPVwicHhcIiksYi5zdXBwb3J0LmNsZWFyQ2xvbmVTdHlsZXx8XCJcIiE9PXJ8fDAhPT1uLmluZGV4T2YoXCJiYWNrZ3JvdW5kXCIpfHwobFtuXT1cImluaGVyaXRcIikscyYmXCJzZXRcImluIHMmJihyPXMuc2V0KGUscixpKSk9PT10KSkpdHJ5e2xbbl09cn1jYXRjaChjKXt9fX0sY3NzOmZ1bmN0aW9uKGUsbixyLGkpe3ZhciBvLGEscyx1PWIuY2FtZWxDYXNlKG4pO3JldHVybiBuPWIuY3NzUHJvcHNbdV18fChiLmNzc1Byb3BzW3VdPXRuKGUuc3R5bGUsdSkpLHM9Yi5jc3NIb29rc1tuXXx8Yi5jc3NIb29rc1t1XSxzJiZcImdldFwiaW4gcyYmKGE9cy5nZXQoZSwhMCxyKSksYT09PXQmJihhPVd0KGUsbixpKSksXCJub3JtYWxcIj09PWEmJm4gaW4gS3QmJihhPUt0W25dKSxcIlwiPT09cnx8cj8obz1wYXJzZUZsb2F0KGEpLHI9PT0hMHx8Yi5pc051bWVyaWMobyk/b3x8MDphKTphfSxzd2FwOmZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpLG8sYT17fTtmb3IobyBpbiB0KWFbb109ZS5zdHlsZVtvXSxlLnN0eWxlW29dPXRbb107aT1uLmFwcGx5KGUscnx8W10pO2ZvcihvIGluIHQpZS5zdHlsZVtvXT1hW29dO3JldHVybiBpfX0pLGUuZ2V0Q29tcHV0ZWRTdHlsZT8oUnQ9ZnVuY3Rpb24odCl7cmV0dXJuIGUuZ2V0Q29tcHV0ZWRTdHlsZSh0LG51bGwpfSxXdD1mdW5jdGlvbihlLG4scil7dmFyIGksbyxhLHM9cnx8UnQoZSksdT1zP3MuZ2V0UHJvcGVydHlWYWx1ZShuKXx8c1tuXTp0LGw9ZS5zdHlsZTtyZXR1cm4gcyYmKFwiXCIhPT11fHxiLmNvbnRhaW5zKGUub3duZXJEb2N1bWVudCxlKXx8KHU9Yi5zdHlsZShlLG4pKSxZdC50ZXN0KHUpJiZVdC50ZXN0KG4pJiYoaT1sLndpZHRoLG89bC5taW5XaWR0aCxhPWwubWF4V2lkdGgsbC5taW5XaWR0aD1sLm1heFdpZHRoPWwud2lkdGg9dSx1PXMud2lkdGgsbC53aWR0aD1pLGwubWluV2lkdGg9byxsLm1heFdpZHRoPWEpKSx1fSk6by5kb2N1bWVudEVsZW1lbnQuY3VycmVudFN0eWxlJiYoUnQ9ZnVuY3Rpb24oZSl7cmV0dXJuIGUuY3VycmVudFN0eWxlfSxXdD1mdW5jdGlvbihlLG4scil7dmFyIGksbyxhLHM9cnx8UnQoZSksdT1zP3Nbbl06dCxsPWUuc3R5bGU7cmV0dXJuIG51bGw9PXUmJmwmJmxbbl0mJih1PWxbbl0pLFl0LnRlc3QodSkmJiF6dC50ZXN0KG4pJiYoaT1sLmxlZnQsbz1lLnJ1bnRpbWVTdHlsZSxhPW8mJm8ubGVmdCxhJiYoby5sZWZ0PWUuY3VycmVudFN0eWxlLmxlZnQpLGwubGVmdD1cImZvbnRTaXplXCI9PT1uP1wiMWVtXCI6dSx1PWwucGl4ZWxMZWZ0K1wicHhcIixsLmxlZnQ9aSxhJiYoby5sZWZ0PWEpKSxcIlwiPT09dT9cImF1dG9cIjp1fSk7ZnVuY3Rpb24gb24oZSx0LG4pe3ZhciByPVZ0LmV4ZWModCk7cmV0dXJuIHI/TWF0aC5tYXgoMCxyWzFdLShufHwwKSkrKHJbMl18fFwicHhcIik6dH1mdW5jdGlvbiBhbihlLHQsbixyLGkpe3ZhciBvPW49PT0ocj9cImJvcmRlclwiOlwiY29udGVudFwiKT80Olwid2lkdGhcIj09PXQ/MTowLGE9MDtmb3IoOzQ+bztvKz0yKVwibWFyZ2luXCI9PT1uJiYoYSs9Yi5jc3MoZSxuK1p0W29dLCEwLGkpKSxyPyhcImNvbnRlbnRcIj09PW4mJihhLT1iLmNzcyhlLFwicGFkZGluZ1wiK1p0W29dLCEwLGkpKSxcIm1hcmdpblwiIT09biYmKGEtPWIuY3NzKGUsXCJib3JkZXJcIitadFtvXStcIldpZHRoXCIsITAsaSkpKTooYSs9Yi5jc3MoZSxcInBhZGRpbmdcIitadFtvXSwhMCxpKSxcInBhZGRpbmdcIiE9PW4mJihhKz1iLmNzcyhlLFwiYm9yZGVyXCIrWnRbb10rXCJXaWR0aFwiLCEwLGkpKSk7cmV0dXJuIGF9ZnVuY3Rpb24gc24oZSx0LG4pe3ZhciByPSEwLGk9XCJ3aWR0aFwiPT09dD9lLm9mZnNldFdpZHRoOmUub2Zmc2V0SGVpZ2h0LG89UnQoZSksYT1iLnN1cHBvcnQuYm94U2l6aW5nJiZcImJvcmRlci1ib3hcIj09PWIuY3NzKGUsXCJib3hTaXppbmdcIiwhMSxvKTtpZigwPj1pfHxudWxsPT1pKXtpZihpPVd0KGUsdCxvKSwoMD5pfHxudWxsPT1pKSYmKGk9ZS5zdHlsZVt0XSksWXQudGVzdChpKSlyZXR1cm4gaTtyPWEmJihiLnN1cHBvcnQuYm94U2l6aW5nUmVsaWFibGV8fGk9PT1lLnN0eWxlW3RdKSxpPXBhcnNlRmxvYXQoaSl8fDB9cmV0dXJuIGkrYW4oZSx0LG58fChhP1wiYm9yZGVyXCI6XCJjb250ZW50XCIpLHIsbykrXCJweFwifWZ1bmN0aW9uIHVuKGUpe3ZhciB0PW8sbj1HdFtlXTtyZXR1cm4gbnx8KG49bG4oZSx0KSxcIm5vbmVcIiE9PW4mJm58fChQdD0oUHR8fGIoXCI8aWZyYW1lIGZyYW1lYm9yZGVyPScwJyB3aWR0aD0nMCcgaGVpZ2h0PScwJy8+XCIpLmNzcyhcImNzc1RleHRcIixcImRpc3BsYXk6YmxvY2sgIWltcG9ydGFudFwiKSkuYXBwZW5kVG8odC5kb2N1bWVudEVsZW1lbnQpLHQ9KFB0WzBdLmNvbnRlbnRXaW5kb3d8fFB0WzBdLmNvbnRlbnREb2N1bWVudCkuZG9jdW1lbnQsdC53cml0ZShcIjwhZG9jdHlwZSBodG1sPjxodG1sPjxib2R5PlwiKSx0LmNsb3NlKCksbj1sbihlLHQpLFB0LmRldGFjaCgpKSxHdFtlXT1uKSxufWZ1bmN0aW9uIGxuKGUsdCl7dmFyIG49Yih0LmNyZWF0ZUVsZW1lbnQoZSkpLmFwcGVuZFRvKHQuYm9keSkscj1iLmNzcyhuWzBdLFwiZGlzcGxheVwiKTtyZXR1cm4gbi5yZW1vdmUoKSxyfWIuZWFjaChbXCJoZWlnaHRcIixcIndpZHRoXCJdLGZ1bmN0aW9uKGUsbil7Yi5jc3NIb29rc1tuXT17Z2V0OmZ1bmN0aW9uKGUscixpKXtyZXR1cm4gcj8wPT09ZS5vZmZzZXRXaWR0aCYmWHQudGVzdChiLmNzcyhlLFwiZGlzcGxheVwiKSk/Yi5zd2FwKGUsUXQsZnVuY3Rpb24oKXtyZXR1cm4gc24oZSxuLGkpfSk6c24oZSxuLGkpOnR9LHNldDpmdW5jdGlvbihlLHQscil7dmFyIGk9ciYmUnQoZSk7cmV0dXJuIG9uKGUsdCxyP2FuKGUsbixyLGIuc3VwcG9ydC5ib3hTaXppbmcmJlwiYm9yZGVyLWJveFwiPT09Yi5jc3MoZSxcImJveFNpemluZ1wiLCExLGkpLGkpOjApfX19KSxiLnN1cHBvcnQub3BhY2l0eXx8KGIuY3NzSG9va3Mub3BhY2l0eT17Z2V0OmZ1bmN0aW9uKGUsdCl7cmV0dXJuIEl0LnRlc3QoKHQmJmUuY3VycmVudFN0eWxlP2UuY3VycmVudFN0eWxlLmZpbHRlcjplLnN0eWxlLmZpbHRlcil8fFwiXCIpPy4wMSpwYXJzZUZsb2F0KFJlZ0V4cC4kMSkrXCJcIjp0P1wiMVwiOlwiXCJ9LHNldDpmdW5jdGlvbihlLHQpe3ZhciBuPWUuc3R5bGUscj1lLmN1cnJlbnRTdHlsZSxpPWIuaXNOdW1lcmljKHQpP1wiYWxwaGEob3BhY2l0eT1cIisxMDAqdCtcIilcIjpcIlwiLG89ciYmci5maWx0ZXJ8fG4uZmlsdGVyfHxcIlwiO24uem9vbT0xLCh0Pj0xfHxcIlwiPT09dCkmJlwiXCI9PT1iLnRyaW0oby5yZXBsYWNlKCR0LFwiXCIpKSYmbi5yZW1vdmVBdHRyaWJ1dGUmJihuLnJlbW92ZUF0dHJpYnV0ZShcImZpbHRlclwiKSxcIlwiPT09dHx8ciYmIXIuZmlsdGVyKXx8KG4uZmlsdGVyPSR0LnRlc3Qobyk/by5yZXBsYWNlKCR0LGkpOm8rXCIgXCIraSl9fSksYihmdW5jdGlvbigpe2Iuc3VwcG9ydC5yZWxpYWJsZU1hcmdpblJpZ2h0fHwoYi5jc3NIb29rcy5tYXJnaW5SaWdodD17Z2V0OmZ1bmN0aW9uKGUsbil7cmV0dXJuIG4/Yi5zd2FwKGUse2Rpc3BsYXk6XCJpbmxpbmUtYmxvY2tcIn0sV3QsW2UsXCJtYXJnaW5SaWdodFwiXSk6dH19KSwhYi5zdXBwb3J0LnBpeGVsUG9zaXRpb24mJmIuZm4ucG9zaXRpb24mJmIuZWFjaChbXCJ0b3BcIixcImxlZnRcIl0sZnVuY3Rpb24oZSxuKXtiLmNzc0hvb2tzW25dPXtnZXQ6ZnVuY3Rpb24oZSxyKXtyZXR1cm4gcj8ocj1XdChlLG4pLFl0LnRlc3Qocik/YihlKS5wb3NpdGlvbigpW25dK1wicHhcIjpyKTp0fX19KX0pLGIuZXhwciYmYi5leHByLmZpbHRlcnMmJihiLmV4cHIuZmlsdGVycy5oaWRkZW49ZnVuY3Rpb24oZSl7cmV0dXJuIDA+PWUub2Zmc2V0V2lkdGgmJjA+PWUub2Zmc2V0SGVpZ2h0fHwhYi5zdXBwb3J0LnJlbGlhYmxlSGlkZGVuT2Zmc2V0cyYmXCJub25lXCI9PT0oZS5zdHlsZSYmZS5zdHlsZS5kaXNwbGF5fHxiLmNzcyhlLFwiZGlzcGxheVwiKSl9LGIuZXhwci5maWx0ZXJzLnZpc2libGU9ZnVuY3Rpb24oZSl7cmV0dXJuIWIuZXhwci5maWx0ZXJzLmhpZGRlbihlKX0pLGIuZWFjaCh7bWFyZ2luOlwiXCIscGFkZGluZzpcIlwiLGJvcmRlcjpcIldpZHRoXCJ9LGZ1bmN0aW9uKGUsdCl7Yi5jc3NIb29rc1tlK3RdPXtleHBhbmQ6ZnVuY3Rpb24obil7dmFyIHI9MCxpPXt9LG89XCJzdHJpbmdcIj09dHlwZW9mIG4/bi5zcGxpdChcIiBcIik6W25dO2Zvcig7ND5yO3IrKylpW2UrWnRbcl0rdF09b1tyXXx8b1tyLTJdfHxvWzBdO3JldHVybiBpfX0sVXQudGVzdChlKXx8KGIuY3NzSG9va3NbZSt0XS5zZXQ9b24pfSk7dmFyIGNuPS8lMjAvZyxwbj0vXFxbXFxdJC8sZm49L1xccj9cXG4vZyxkbj0vXig/OnN1Ym1pdHxidXR0b258aW1hZ2V8cmVzZXR8ZmlsZSkkL2ksaG49L14oPzppbnB1dHxzZWxlY3R8dGV4dGFyZWF8a2V5Z2VuKS9pO2IuZm4uZXh0ZW5kKHtzZXJpYWxpemU6ZnVuY3Rpb24oKXtyZXR1cm4gYi5wYXJhbSh0aGlzLnNlcmlhbGl6ZUFycmF5KCkpfSxzZXJpYWxpemVBcnJheTpmdW5jdGlvbigpe3JldHVybiB0aGlzLm1hcChmdW5jdGlvbigpe3ZhciBlPWIucHJvcCh0aGlzLFwiZWxlbWVudHNcIik7cmV0dXJuIGU/Yi5tYWtlQXJyYXkoZSk6dGhpc30pLmZpbHRlcihmdW5jdGlvbigpe3ZhciBlPXRoaXMudHlwZTtyZXR1cm4gdGhpcy5uYW1lJiYhYih0aGlzKS5pcyhcIjpkaXNhYmxlZFwiKSYmaG4udGVzdCh0aGlzLm5vZGVOYW1lKSYmIWRuLnRlc3QoZSkmJih0aGlzLmNoZWNrZWR8fCFOdC50ZXN0KGUpKX0pLm1hcChmdW5jdGlvbihlLHQpe3ZhciBuPWIodGhpcykudmFsKCk7cmV0dXJuIG51bGw9PW4/bnVsbDpiLmlzQXJyYXkobik/Yi5tYXAobixmdW5jdGlvbihlKXtyZXR1cm57bmFtZTp0Lm5hbWUsdmFsdWU6ZS5yZXBsYWNlKGZuLFwiXFxyXFxuXCIpfX0pOntuYW1lOnQubmFtZSx2YWx1ZTpuLnJlcGxhY2UoZm4sXCJcXHJcXG5cIil9fSkuZ2V0KCl9fSksYi5wYXJhbT1mdW5jdGlvbihlLG4pe3ZhciByLGk9W10sbz1mdW5jdGlvbihlLHQpe3Q9Yi5pc0Z1bmN0aW9uKHQpP3QoKTpudWxsPT10P1wiXCI6dCxpW2kubGVuZ3RoXT1lbmNvZGVVUklDb21wb25lbnQoZSkrXCI9XCIrZW5jb2RlVVJJQ29tcG9uZW50KHQpfTtpZihuPT09dCYmKG49Yi5hamF4U2V0dGluZ3MmJmIuYWpheFNldHRpbmdzLnRyYWRpdGlvbmFsKSxiLmlzQXJyYXkoZSl8fGUuanF1ZXJ5JiYhYi5pc1BsYWluT2JqZWN0KGUpKWIuZWFjaChlLGZ1bmN0aW9uKCl7byh0aGlzLm5hbWUsdGhpcy52YWx1ZSl9KTtlbHNlIGZvcihyIGluIGUpZ24ocixlW3JdLG4sbyk7cmV0dXJuIGkuam9pbihcIiZcIikucmVwbGFjZShjbixcIitcIil9O2Z1bmN0aW9uIGduKGUsdCxuLHIpe3ZhciBpO2lmKGIuaXNBcnJheSh0KSliLmVhY2godCxmdW5jdGlvbih0LGkpe258fHBuLnRlc3QoZSk/cihlLGkpOmduKGUrXCJbXCIrKFwib2JqZWN0XCI9PXR5cGVvZiBpP3Q6XCJcIikrXCJdXCIsaSxuLHIpfSk7ZWxzZSBpZihufHxcIm9iamVjdFwiIT09Yi50eXBlKHQpKXIoZSx0KTtlbHNlIGZvcihpIGluIHQpZ24oZStcIltcIitpK1wiXVwiLHRbaV0sbixyKX1iLmVhY2goXCJibHVyIGZvY3VzIGZvY3VzaW4gZm9jdXNvdXQgbG9hZCByZXNpemUgc2Nyb2xsIHVubG9hZCBjbGljayBkYmxjbGljayBtb3VzZWRvd24gbW91c2V1cCBtb3VzZW1vdmUgbW91c2VvdmVyIG1vdXNlb3V0IG1vdXNlZW50ZXIgbW91c2VsZWF2ZSBjaGFuZ2Ugc2VsZWN0IHN1Ym1pdCBrZXlkb3duIGtleXByZXNzIGtleXVwIGVycm9yIGNvbnRleHRtZW51XCIuc3BsaXQoXCIgXCIpLGZ1bmN0aW9uKGUsdCl7Yi5mblt0XT1mdW5jdGlvbihlLG4pe3JldHVybiBhcmd1bWVudHMubGVuZ3RoPjA/dGhpcy5vbih0LG51bGwsZSxuKTp0aGlzLnRyaWdnZXIodCl9fSksYi5mbi5ob3Zlcj1mdW5jdGlvbihlLHQpe3JldHVybiB0aGlzLm1vdXNlZW50ZXIoZSkubW91c2VsZWF2ZSh0fHxlKX07dmFyIG1uLHluLHZuPWIubm93KCksYm49L1xcPy8seG49LyMuKiQvLHduPS8oWz8mXSlfPVteJl0qLyxUbj0vXiguKj8pOlsgXFx0XSooW15cXHJcXG5dKilcXHI/JC9nbSxObj0vXig/OmFib3V0fGFwcHxhcHAtc3RvcmFnZXwuKy1leHRlbnNpb258ZmlsZXxyZXN8d2lkZ2V0KTokLyxDbj0vXig/OkdFVHxIRUFEKSQvLGtuPS9eXFwvXFwvLyxFbj0vXihbXFx3ListXSs6KSg/OlxcL1xcLyhbXlxcLz8jOl0qKSg/OjooXFxkKyl8KXwpLyxTbj1iLmZuLmxvYWQsQW49e30sam49e30sRG49XCIqL1wiLmNvbmNhdChcIipcIik7dHJ5e3luPWEuaHJlZn1jYXRjaChMbil7eW49by5jcmVhdGVFbGVtZW50KFwiYVwiKSx5bi5ocmVmPVwiXCIseW49eW4uaHJlZn1tbj1Fbi5leGVjKHluLnRvTG93ZXJDYXNlKCkpfHxbXTtmdW5jdGlvbiBIbihlKXtyZXR1cm4gZnVuY3Rpb24odCxuKXtcInN0cmluZ1wiIT10eXBlb2YgdCYmKG49dCx0PVwiKlwiKTt2YXIgcixpPTAsbz10LnRvTG93ZXJDYXNlKCkubWF0Y2godyl8fFtdO2lmKGIuaXNGdW5jdGlvbihuKSl3aGlsZShyPW9baSsrXSlcIitcIj09PXJbMF0/KHI9ci5zbGljZSgxKXx8XCIqXCIsKGVbcl09ZVtyXXx8W10pLnVuc2hpZnQobikpOihlW3JdPWVbcl18fFtdKS5wdXNoKG4pfX1mdW5jdGlvbiBxbihlLG4scixpKXt2YXIgbz17fSxhPWU9PT1qbjtmdW5jdGlvbiBzKHUpe3ZhciBsO3JldHVybiBvW3VdPSEwLGIuZWFjaChlW3VdfHxbXSxmdW5jdGlvbihlLHUpe3ZhciBjPXUobixyLGkpO3JldHVyblwic3RyaW5nXCIhPXR5cGVvZiBjfHxhfHxvW2NdP2E/IShsPWMpOnQ6KG4uZGF0YVR5cGVzLnVuc2hpZnQoYykscyhjKSwhMSl9KSxsfXJldHVybiBzKG4uZGF0YVR5cGVzWzBdKXx8IW9bXCIqXCJdJiZzKFwiKlwiKX1mdW5jdGlvbiBNbihlLG4pe3ZhciByLGksbz1iLmFqYXhTZXR0aW5ncy5mbGF0T3B0aW9uc3x8e307Zm9yKGkgaW4gbiluW2ldIT09dCYmKChvW2ldP2U6cnx8KHI9e30pKVtpXT1uW2ldKTtyZXR1cm4gciYmYi5leHRlbmQoITAsZSxyKSxlfWIuZm4ubG9hZD1mdW5jdGlvbihlLG4scil7aWYoXCJzdHJpbmdcIiE9dHlwZW9mIGUmJlNuKXJldHVybiBTbi5hcHBseSh0aGlzLGFyZ3VtZW50cyk7dmFyIGksbyxhLHM9dGhpcyx1PWUuaW5kZXhPZihcIiBcIik7cmV0dXJuIHU+PTAmJihpPWUuc2xpY2UodSxlLmxlbmd0aCksZT1lLnNsaWNlKDAsdSkpLGIuaXNGdW5jdGlvbihuKT8ocj1uLG49dCk6biYmXCJvYmplY3RcIj09dHlwZW9mIG4mJihhPVwiUE9TVFwiKSxzLmxlbmd0aD4wJiZiLmFqYXgoe3VybDplLHR5cGU6YSxkYXRhVHlwZTpcImh0bWxcIixkYXRhOm59KS5kb25lKGZ1bmN0aW9uKGUpe289YXJndW1lbnRzLHMuaHRtbChpP2IoXCI8ZGl2PlwiKS5hcHBlbmQoYi5wYXJzZUhUTUwoZSkpLmZpbmQoaSk6ZSl9KS5jb21wbGV0ZShyJiZmdW5jdGlvbihlLHQpe3MuZWFjaChyLG98fFtlLnJlc3BvbnNlVGV4dCx0LGVdKX0pLHRoaXN9LGIuZWFjaChbXCJhamF4U3RhcnRcIixcImFqYXhTdG9wXCIsXCJhamF4Q29tcGxldGVcIixcImFqYXhFcnJvclwiLFwiYWpheFN1Y2Nlc3NcIixcImFqYXhTZW5kXCJdLGZ1bmN0aW9uKGUsdCl7Yi5mblt0XT1mdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5vbih0LGUpfX0pLGIuZWFjaChbXCJnZXRcIixcInBvc3RcIl0sZnVuY3Rpb24oZSxuKXtiW25dPWZ1bmN0aW9uKGUscixpLG8pe3JldHVybiBiLmlzRnVuY3Rpb24ocikmJihvPW98fGksaT1yLHI9dCksYi5hamF4KHt1cmw6ZSx0eXBlOm4sZGF0YVR5cGU6byxkYXRhOnIsc3VjY2VzczppfSl9fSksYi5leHRlbmQoe2FjdGl2ZTowLGxhc3RNb2RpZmllZDp7fSxldGFnOnt9LGFqYXhTZXR0aW5nczp7dXJsOnluLHR5cGU6XCJHRVRcIixpc0xvY2FsOk5uLnRlc3QobW5bMV0pLGdsb2JhbDohMCxwcm9jZXNzRGF0YTohMCxhc3luYzohMCxjb250ZW50VHlwZTpcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOFwiLGFjY2VwdHM6e1wiKlwiOkRuLHRleHQ6XCJ0ZXh0L3BsYWluXCIsaHRtbDpcInRleHQvaHRtbFwiLHhtbDpcImFwcGxpY2F0aW9uL3htbCwgdGV4dC94bWxcIixqc29uOlwiYXBwbGljYXRpb24vanNvbiwgdGV4dC9qYXZhc2NyaXB0XCJ9LGNvbnRlbnRzOnt4bWw6L3htbC8saHRtbDovaHRtbC8sanNvbjovanNvbi99LHJlc3BvbnNlRmllbGRzOnt4bWw6XCJyZXNwb25zZVhNTFwiLHRleHQ6XCJyZXNwb25zZVRleHRcIn0sY29udmVydGVyczp7XCIqIHRleHRcIjplLlN0cmluZyxcInRleHQgaHRtbFwiOiEwLFwidGV4dCBqc29uXCI6Yi5wYXJzZUpTT04sXCJ0ZXh0IHhtbFwiOmIucGFyc2VYTUx9LGZsYXRPcHRpb25zOnt1cmw6ITAsY29udGV4dDohMH19LGFqYXhTZXR1cDpmdW5jdGlvbihlLHQpe3JldHVybiB0P01uKE1uKGUsYi5hamF4U2V0dGluZ3MpLHQpOk1uKGIuYWpheFNldHRpbmdzLGUpfSxhamF4UHJlZmlsdGVyOkhuKEFuKSxhamF4VHJhbnNwb3J0OkhuKGpuKSxhamF4OmZ1bmN0aW9uKGUsbil7XCJvYmplY3RcIj09dHlwZW9mIGUmJihuPWUsZT10KSxuPW58fHt9O3ZhciByLGksbyxhLHMsdSxsLGMscD1iLmFqYXhTZXR1cCh7fSxuKSxmPXAuY29udGV4dHx8cCxkPXAuY29udGV4dCYmKGYubm9kZVR5cGV8fGYuanF1ZXJ5KT9iKGYpOmIuZXZlbnQsaD1iLkRlZmVycmVkKCksZz1iLkNhbGxiYWNrcyhcIm9uY2UgbWVtb3J5XCIpLG09cC5zdGF0dXNDb2RlfHx7fSx5PXt9LHY9e30seD0wLFQ9XCJjYW5jZWxlZFwiLE49e3JlYWR5U3RhdGU6MCxnZXRSZXNwb25zZUhlYWRlcjpmdW5jdGlvbihlKXt2YXIgdDtpZigyPT09eCl7aWYoIWMpe2M9e307d2hpbGUodD1Ubi5leGVjKGEpKWNbdFsxXS50b0xvd2VyQ2FzZSgpXT10WzJdfXQ9Y1tlLnRvTG93ZXJDYXNlKCldfXJldHVybiBudWxsPT10P251bGw6dH0sZ2V0QWxsUmVzcG9uc2VIZWFkZXJzOmZ1bmN0aW9uKCl7cmV0dXJuIDI9PT14P2E6bnVsbH0sc2V0UmVxdWVzdEhlYWRlcjpmdW5jdGlvbihlLHQpe3ZhciBuPWUudG9Mb3dlckNhc2UoKTtyZXR1cm4geHx8KGU9dltuXT12W25dfHxlLHlbZV09dCksdGhpc30sb3ZlcnJpZGVNaW1lVHlwZTpmdW5jdGlvbihlKXtyZXR1cm4geHx8KHAubWltZVR5cGU9ZSksdGhpc30sc3RhdHVzQ29kZTpmdW5jdGlvbihlKXt2YXIgdDtpZihlKWlmKDI+eClmb3IodCBpbiBlKW1bdF09W21bdF0sZVt0XV07ZWxzZSBOLmFsd2F5cyhlW04uc3RhdHVzXSk7cmV0dXJuIHRoaXN9LGFib3J0OmZ1bmN0aW9uKGUpe3ZhciB0PWV8fFQ7cmV0dXJuIGwmJmwuYWJvcnQodCksaygwLHQpLHRoaXN9fTtpZihoLnByb21pc2UoTikuY29tcGxldGU9Zy5hZGQsTi5zdWNjZXNzPU4uZG9uZSxOLmVycm9yPU4uZmFpbCxwLnVybD0oKGV8fHAudXJsfHx5bikrXCJcIikucmVwbGFjZSh4bixcIlwiKS5yZXBsYWNlKGtuLG1uWzFdK1wiLy9cIikscC50eXBlPW4ubWV0aG9kfHxuLnR5cGV8fHAubWV0aG9kfHxwLnR5cGUscC5kYXRhVHlwZXM9Yi50cmltKHAuZGF0YVR5cGV8fFwiKlwiKS50b0xvd2VyQ2FzZSgpLm1hdGNoKHcpfHxbXCJcIl0sbnVsbD09cC5jcm9zc0RvbWFpbiYmKHI9RW4uZXhlYyhwLnVybC50b0xvd2VyQ2FzZSgpKSxwLmNyb3NzRG9tYWluPSEoIXJ8fHJbMV09PT1tblsxXSYmclsyXT09PW1uWzJdJiYoclszXXx8KFwiaHR0cDpcIj09PXJbMV0/ODA6NDQzKSk9PShtblszXXx8KFwiaHR0cDpcIj09PW1uWzFdPzgwOjQ0MykpKSkscC5kYXRhJiZwLnByb2Nlc3NEYXRhJiZcInN0cmluZ1wiIT10eXBlb2YgcC5kYXRhJiYocC5kYXRhPWIucGFyYW0ocC5kYXRhLHAudHJhZGl0aW9uYWwpKSxxbihBbixwLG4sTiksMj09PXgpcmV0dXJuIE47dT1wLmdsb2JhbCx1JiYwPT09Yi5hY3RpdmUrKyYmYi5ldmVudC50cmlnZ2VyKFwiYWpheFN0YXJ0XCIpLHAudHlwZT1wLnR5cGUudG9VcHBlckNhc2UoKSxwLmhhc0NvbnRlbnQ9IUNuLnRlc3QocC50eXBlKSxvPXAudXJsLHAuaGFzQ29udGVudHx8KHAuZGF0YSYmKG89cC51cmwrPShibi50ZXN0KG8pP1wiJlwiOlwiP1wiKStwLmRhdGEsZGVsZXRlIHAuZGF0YSkscC5jYWNoZT09PSExJiYocC51cmw9d24udGVzdChvKT9vLnJlcGxhY2Uod24sXCIkMV89XCIrdm4rKyk6bysoYm4udGVzdChvKT9cIiZcIjpcIj9cIikrXCJfPVwiK3ZuKyspKSxwLmlmTW9kaWZpZWQmJihiLmxhc3RNb2RpZmllZFtvXSYmTi5zZXRSZXF1ZXN0SGVhZGVyKFwiSWYtTW9kaWZpZWQtU2luY2VcIixiLmxhc3RNb2RpZmllZFtvXSksYi5ldGFnW29dJiZOLnNldFJlcXVlc3RIZWFkZXIoXCJJZi1Ob25lLU1hdGNoXCIsYi5ldGFnW29dKSksKHAuZGF0YSYmcC5oYXNDb250ZW50JiZwLmNvbnRlbnRUeXBlIT09ITF8fG4uY29udGVudFR5cGUpJiZOLnNldFJlcXVlc3RIZWFkZXIoXCJDb250ZW50LVR5cGVcIixwLmNvbnRlbnRUeXBlKSxOLnNldFJlcXVlc3RIZWFkZXIoXCJBY2NlcHRcIixwLmRhdGFUeXBlc1swXSYmcC5hY2NlcHRzW3AuZGF0YVR5cGVzWzBdXT9wLmFjY2VwdHNbcC5kYXRhVHlwZXNbMF1dKyhcIipcIiE9PXAuZGF0YVR5cGVzWzBdP1wiLCBcIitEbitcIjsgcT0wLjAxXCI6XCJcIik6cC5hY2NlcHRzW1wiKlwiXSk7Zm9yKGkgaW4gcC5oZWFkZXJzKU4uc2V0UmVxdWVzdEhlYWRlcihpLHAuaGVhZGVyc1tpXSk7aWYocC5iZWZvcmVTZW5kJiYocC5iZWZvcmVTZW5kLmNhbGwoZixOLHApPT09ITF8fDI9PT14KSlyZXR1cm4gTi5hYm9ydCgpO1Q9XCJhYm9ydFwiO2ZvcihpIGlue3N1Y2Nlc3M6MSxlcnJvcjoxLGNvbXBsZXRlOjF9KU5baV0ocFtpXSk7aWYobD1xbihqbixwLG4sTikpe04ucmVhZHlTdGF0ZT0xLHUmJmQudHJpZ2dlcihcImFqYXhTZW5kXCIsW04scF0pLHAuYXN5bmMmJnAudGltZW91dD4wJiYocz1zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7Ti5hYm9ydChcInRpbWVvdXRcIil9LHAudGltZW91dCkpO3RyeXt4PTEsbC5zZW5kKHksayl9Y2F0Y2goQyl7aWYoISgyPngpKXRocm93IEM7aygtMSxDKX19ZWxzZSBrKC0xLFwiTm8gVHJhbnNwb3J0XCIpO2Z1bmN0aW9uIGsoZSxuLHIsaSl7dmFyIGMseSx2LHcsVCxDPW47MiE9PXgmJih4PTIscyYmY2xlYXJUaW1lb3V0KHMpLGw9dCxhPWl8fFwiXCIsTi5yZWFkeVN0YXRlPWU+MD80OjAsciYmKHc9X24ocCxOLHIpKSxlPj0yMDAmJjMwMD5lfHwzMDQ9PT1lPyhwLmlmTW9kaWZpZWQmJihUPU4uZ2V0UmVzcG9uc2VIZWFkZXIoXCJMYXN0LU1vZGlmaWVkXCIpLFQmJihiLmxhc3RNb2RpZmllZFtvXT1UKSxUPU4uZ2V0UmVzcG9uc2VIZWFkZXIoXCJldGFnXCIpLFQmJihiLmV0YWdbb109VCkpLDIwND09PWU/KGM9ITAsQz1cIm5vY29udGVudFwiKTozMDQ9PT1lPyhjPSEwLEM9XCJub3Rtb2RpZmllZFwiKTooYz1GbihwLHcpLEM9Yy5zdGF0ZSx5PWMuZGF0YSx2PWMuZXJyb3IsYz0hdikpOih2PUMsKGV8fCFDKSYmKEM9XCJlcnJvclwiLDA+ZSYmKGU9MCkpKSxOLnN0YXR1cz1lLE4uc3RhdHVzVGV4dD0obnx8QykrXCJcIixjP2gucmVzb2x2ZVdpdGgoZixbeSxDLE5dKTpoLnJlamVjdFdpdGgoZixbTixDLHZdKSxOLnN0YXR1c0NvZGUobSksbT10LHUmJmQudHJpZ2dlcihjP1wiYWpheFN1Y2Nlc3NcIjpcImFqYXhFcnJvclwiLFtOLHAsYz95OnZdKSxnLmZpcmVXaXRoKGYsW04sQ10pLHUmJihkLnRyaWdnZXIoXCJhamF4Q29tcGxldGVcIixbTixwXSksLS1iLmFjdGl2ZXx8Yi5ldmVudC50cmlnZ2VyKFwiYWpheFN0b3BcIikpKX1yZXR1cm4gTn0sZ2V0U2NyaXB0OmZ1bmN0aW9uKGUsbil7cmV0dXJuIGIuZ2V0KGUsdCxuLFwic2NyaXB0XCIpfSxnZXRKU09OOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gYi5nZXQoZSx0LG4sXCJqc29uXCIpfX0pO2Z1bmN0aW9uIF9uKGUsbixyKXt2YXIgaSxvLGEscyx1PWUuY29udGVudHMsbD1lLmRhdGFUeXBlcyxjPWUucmVzcG9uc2VGaWVsZHM7Zm9yKHMgaW4gYylzIGluIHImJihuW2Nbc11dPXJbc10pO3doaWxlKFwiKlwiPT09bFswXSlsLnNoaWZ0KCksbz09PXQmJihvPWUubWltZVR5cGV8fG4uZ2V0UmVzcG9uc2VIZWFkZXIoXCJDb250ZW50LVR5cGVcIikpO2lmKG8pZm9yKHMgaW4gdSlpZih1W3NdJiZ1W3NdLnRlc3Qobykpe2wudW5zaGlmdChzKTticmVha31pZihsWzBdaW4gcilhPWxbMF07ZWxzZXtmb3IocyBpbiByKXtpZighbFswXXx8ZS5jb252ZXJ0ZXJzW3MrXCIgXCIrbFswXV0pe2E9czticmVha31pfHwoaT1zKX1hPWF8fGl9cmV0dXJuIGE/KGEhPT1sWzBdJiZsLnVuc2hpZnQoYSksclthXSk6dH1mdW5jdGlvbiBGbihlLHQpe3ZhciBuLHIsaSxvLGE9e30scz0wLHU9ZS5kYXRhVHlwZXMuc2xpY2UoKSxsPXVbMF07aWYoZS5kYXRhRmlsdGVyJiYodD1lLmRhdGFGaWx0ZXIodCxlLmRhdGFUeXBlKSksdVsxXSlmb3IoaSBpbiBlLmNvbnZlcnRlcnMpYVtpLnRvTG93ZXJDYXNlKCldPWUuY29udmVydGVyc1tpXTtmb3IoO3I9dVsrK3NdOylpZihcIipcIiE9PXIpe2lmKFwiKlwiIT09bCYmbCE9PXIpe2lmKGk9YVtsK1wiIFwiK3JdfHxhW1wiKiBcIityXSwhaSlmb3IobiBpbiBhKWlmKG89bi5zcGxpdChcIiBcIiksb1sxXT09PXImJihpPWFbbCtcIiBcIitvWzBdXXx8YVtcIiogXCIrb1swXV0pKXtpPT09ITA/aT1hW25dOmFbbl0hPT0hMCYmKHI9b1swXSx1LnNwbGljZShzLS0sMCxyKSk7YnJlYWt9aWYoaSE9PSEwKWlmKGkmJmVbXCJ0aHJvd3NcIl0pdD1pKHQpO2Vsc2UgdHJ5e3Q9aSh0KX1jYXRjaChjKXtyZXR1cm57c3RhdGU6XCJwYXJzZXJlcnJvclwiLGVycm9yOmk/YzpcIk5vIGNvbnZlcnNpb24gZnJvbSBcIitsK1wiIHRvIFwiK3J9fX1sPXJ9cmV0dXJue3N0YXRlOlwic3VjY2Vzc1wiLGRhdGE6dH19Yi5hamF4U2V0dXAoe2FjY2VwdHM6e3NjcmlwdDpcInRleHQvamF2YXNjcmlwdCwgYXBwbGljYXRpb24vamF2YXNjcmlwdCwgYXBwbGljYXRpb24vZWNtYXNjcmlwdCwgYXBwbGljYXRpb24veC1lY21hc2NyaXB0XCJ9LGNvbnRlbnRzOntzY3JpcHQ6Lyg/OmphdmF8ZWNtYSlzY3JpcHQvfSxjb252ZXJ0ZXJzOntcInRleHQgc2NyaXB0XCI6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuZ2xvYmFsRXZhbChlKSxlfX19KSxiLmFqYXhQcmVmaWx0ZXIoXCJzY3JpcHRcIixmdW5jdGlvbihlKXtlLmNhY2hlPT09dCYmKGUuY2FjaGU9ITEpLGUuY3Jvc3NEb21haW4mJihlLnR5cGU9XCJHRVRcIixlLmdsb2JhbD0hMSl9KSxiLmFqYXhUcmFuc3BvcnQoXCJzY3JpcHRcIixmdW5jdGlvbihlKXtpZihlLmNyb3NzRG9tYWluKXt2YXIgbixyPW8uaGVhZHx8YihcImhlYWRcIilbMF18fG8uZG9jdW1lbnRFbGVtZW50O3JldHVybntzZW5kOmZ1bmN0aW9uKHQsaSl7bj1vLmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIiksbi5hc3luYz0hMCxlLnNjcmlwdENoYXJzZXQmJihuLmNoYXJzZXQ9ZS5zY3JpcHRDaGFyc2V0KSxuLnNyYz1lLnVybCxuLm9ubG9hZD1uLm9ucmVhZHlzdGF0ZWNoYW5nZT1mdW5jdGlvbihlLHQpeyh0fHwhbi5yZWFkeVN0YXRlfHwvbG9hZGVkfGNvbXBsZXRlLy50ZXN0KG4ucmVhZHlTdGF0ZSkpJiYobi5vbmxvYWQ9bi5vbnJlYWR5c3RhdGVjaGFuZ2U9bnVsbCxuLnBhcmVudE5vZGUmJm4ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChuKSxuPW51bGwsdHx8aSgyMDAsXCJzdWNjZXNzXCIpKX0sci5pbnNlcnRCZWZvcmUobixyLmZpcnN0Q2hpbGQpfSxhYm9ydDpmdW5jdGlvbigpe24mJm4ub25sb2FkKHQsITApfX19fSk7dmFyIE9uPVtdLEJuPS8oPSlcXD8oPz0mfCQpfFxcP1xcPy87Yi5hamF4U2V0dXAoe2pzb25wOlwiY2FsbGJhY2tcIixqc29ucENhbGxiYWNrOmZ1bmN0aW9uKCl7dmFyIGU9T24ucG9wKCl8fGIuZXhwYW5kbytcIl9cIit2bisrO3JldHVybiB0aGlzW2VdPSEwLGV9fSksYi5hamF4UHJlZmlsdGVyKFwianNvbiBqc29ucFwiLGZ1bmN0aW9uKG4scixpKXt2YXIgbyxhLHMsdT1uLmpzb25wIT09ITEmJihCbi50ZXN0KG4udXJsKT9cInVybFwiOlwic3RyaW5nXCI9PXR5cGVvZiBuLmRhdGEmJiEobi5jb250ZW50VHlwZXx8XCJcIikuaW5kZXhPZihcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiKSYmQm4udGVzdChuLmRhdGEpJiZcImRhdGFcIik7cmV0dXJuIHV8fFwianNvbnBcIj09PW4uZGF0YVR5cGVzWzBdPyhvPW4uanNvbnBDYWxsYmFjaz1iLmlzRnVuY3Rpb24obi5qc29ucENhbGxiYWNrKT9uLmpzb25wQ2FsbGJhY2soKTpuLmpzb25wQ2FsbGJhY2ssdT9uW3VdPW5bdV0ucmVwbGFjZShCbixcIiQxXCIrbyk6bi5qc29ucCE9PSExJiYobi51cmwrPShibi50ZXN0KG4udXJsKT9cIiZcIjpcIj9cIikrbi5qc29ucCtcIj1cIitvKSxuLmNvbnZlcnRlcnNbXCJzY3JpcHQganNvblwiXT1mdW5jdGlvbigpe3JldHVybiBzfHxiLmVycm9yKG8rXCIgd2FzIG5vdCBjYWxsZWRcIiksc1swXX0sbi5kYXRhVHlwZXNbMF09XCJqc29uXCIsYT1lW29dLGVbb109ZnVuY3Rpb24oKXtzPWFyZ3VtZW50c30saS5hbHdheXMoZnVuY3Rpb24oKXtlW29dPWEsbltvXSYmKG4uanNvbnBDYWxsYmFjaz1yLmpzb25wQ2FsbGJhY2ssT24ucHVzaChvKSkscyYmYi5pc0Z1bmN0aW9uKGEpJiZhKHNbMF0pLHM9YT10fSksXCJzY3JpcHRcIik6dH0pO3ZhciBQbixSbixXbj0wLCRuPWUuQWN0aXZlWE9iamVjdCYmZnVuY3Rpb24oKXt2YXIgZTtmb3IoZSBpbiBQbilQbltlXSh0LCEwKX07ZnVuY3Rpb24gSW4oKXt0cnl7cmV0dXJuIG5ldyBlLlhNTEh0dHBSZXF1ZXN0fWNhdGNoKHQpe319ZnVuY3Rpb24gem4oKXt0cnl7cmV0dXJuIG5ldyBlLkFjdGl2ZVhPYmplY3QoXCJNaWNyb3NvZnQuWE1MSFRUUFwiKX1jYXRjaCh0KXt9fWIuYWpheFNldHRpbmdzLnhocj1lLkFjdGl2ZVhPYmplY3Q/ZnVuY3Rpb24oKXtyZXR1cm4hdGhpcy5pc0xvY2FsJiZJbigpfHx6bigpfTpJbixSbj1iLmFqYXhTZXR0aW5ncy54aHIoKSxiLnN1cHBvcnQuY29ycz0hIVJuJiZcIndpdGhDcmVkZW50aWFsc1wiaW4gUm4sUm49Yi5zdXBwb3J0LmFqYXg9ISFSbixSbiYmYi5hamF4VHJhbnNwb3J0KGZ1bmN0aW9uKG4pe2lmKCFuLmNyb3NzRG9tYWlufHxiLnN1cHBvcnQuY29ycyl7dmFyIHI7cmV0dXJue3NlbmQ6ZnVuY3Rpb24oaSxvKXt2YXIgYSxzLHU9bi54aHIoKTtpZihuLnVzZXJuYW1lP3Uub3BlbihuLnR5cGUsbi51cmwsbi5hc3luYyxuLnVzZXJuYW1lLG4ucGFzc3dvcmQpOnUub3BlbihuLnR5cGUsbi51cmwsbi5hc3luYyksbi54aHJGaWVsZHMpZm9yKHMgaW4gbi54aHJGaWVsZHMpdVtzXT1uLnhockZpZWxkc1tzXTtuLm1pbWVUeXBlJiZ1Lm92ZXJyaWRlTWltZVR5cGUmJnUub3ZlcnJpZGVNaW1lVHlwZShuLm1pbWVUeXBlKSxuLmNyb3NzRG9tYWlufHxpW1wiWC1SZXF1ZXN0ZWQtV2l0aFwiXXx8KGlbXCJYLVJlcXVlc3RlZC1XaXRoXCJdPVwiWE1MSHR0cFJlcXVlc3RcIik7dHJ5e2ZvcihzIGluIGkpdS5zZXRSZXF1ZXN0SGVhZGVyKHMsaVtzXSl9Y2F0Y2gobCl7fXUuc2VuZChuLmhhc0NvbnRlbnQmJm4uZGF0YXx8bnVsbCkscj1mdW5jdGlvbihlLGkpe3ZhciBzLGwsYyxwO3RyeXtpZihyJiYoaXx8ND09PXUucmVhZHlTdGF0ZSkpaWYocj10LGEmJih1Lm9ucmVhZHlzdGF0ZWNoYW5nZT1iLm5vb3AsJG4mJmRlbGV0ZSBQblthXSksaSk0IT09dS5yZWFkeVN0YXRlJiZ1LmFib3J0KCk7ZWxzZXtwPXt9LHM9dS5zdGF0dXMsbD11LmdldEFsbFJlc3BvbnNlSGVhZGVycygpLFwic3RyaW5nXCI9PXR5cGVvZiB1LnJlc3BvbnNlVGV4dCYmKHAudGV4dD11LnJlc3BvbnNlVGV4dCk7dHJ5e2M9dS5zdGF0dXNUZXh0fWNhdGNoKGYpe2M9XCJcIn1zfHwhbi5pc0xvY2FsfHxuLmNyb3NzRG9tYWluPzEyMjM9PT1zJiYocz0yMDQpOnM9cC50ZXh0PzIwMDo0MDR9fWNhdGNoKGQpe2l8fG8oLTEsZCl9cCYmbyhzLGMscCxsKX0sbi5hc3luYz80PT09dS5yZWFkeVN0YXRlP3NldFRpbWVvdXQocik6KGE9KytXbiwkbiYmKFBufHwoUG49e30sYihlKS51bmxvYWQoJG4pKSxQblthXT1yKSx1Lm9ucmVhZHlzdGF0ZWNoYW5nZT1yKTpyKCl9LGFib3J0OmZ1bmN0aW9uKCl7ciYmcih0LCEwKX19fX0pO3ZhciBYbixVbixWbj0vXig/OnRvZ2dsZXxzaG93fGhpZGUpJC8sWW49UmVnRXhwKFwiXig/OihbKy1dKT18KShcIit4K1wiKShbYS16JV0qKSRcIixcImlcIiksSm49L3F1ZXVlSG9va3MkLyxHbj1bbnJdLFFuPXtcIipcIjpbZnVuY3Rpb24oZSx0KXt2YXIgbixyLGk9dGhpcy5jcmVhdGVUd2VlbihlLHQpLG89WW4uZXhlYyh0KSxhPWkuY3VyKCkscz0rYXx8MCx1PTEsbD0yMDtpZihvKXtpZihuPStvWzJdLHI9b1szXXx8KGIuY3NzTnVtYmVyW2VdP1wiXCI6XCJweFwiKSxcInB4XCIhPT1yJiZzKXtzPWIuY3NzKGkuZWxlbSxlLCEwKXx8bnx8MTtkbyB1PXV8fFwiLjVcIixzLz11LGIuc3R5bGUoaS5lbGVtLGUscytyKTt3aGlsZSh1IT09KHU9aS5jdXIoKS9hKSYmMSE9PXUmJi0tbCl9aS51bml0PXIsaS5zdGFydD1zLGkuZW5kPW9bMV0/cysob1sxXSsxKSpuOm59cmV0dXJuIGl9XX07ZnVuY3Rpb24gS24oKXtyZXR1cm4gc2V0VGltZW91dChmdW5jdGlvbigpe1huPXR9KSxYbj1iLm5vdygpfWZ1bmN0aW9uIFpuKGUsdCl7Yi5lYWNoKHQsZnVuY3Rpb24odCxuKXt2YXIgcj0oUW5bdF18fFtdKS5jb25jYXQoUW5bXCIqXCJdKSxpPTAsbz1yLmxlbmd0aDtmb3IoO28+aTtpKyspaWYocltpXS5jYWxsKGUsdCxuKSlyZXR1cm59KX1mdW5jdGlvbiBlcihlLHQsbil7dmFyIHIsaSxvPTAsYT1Hbi5sZW5ndGgscz1iLkRlZmVycmVkKCkuYWx3YXlzKGZ1bmN0aW9uKCl7ZGVsZXRlIHUuZWxlbX0pLHU9ZnVuY3Rpb24oKXtpZihpKXJldHVybiExO3ZhciB0PVhufHxLbigpLG49TWF0aC5tYXgoMCxsLnN0YXJ0VGltZStsLmR1cmF0aW9uLXQpLHI9bi9sLmR1cmF0aW9ufHwwLG89MS1yLGE9MCx1PWwudHdlZW5zLmxlbmd0aDtmb3IoO3U+YTthKyspbC50d2VlbnNbYV0ucnVuKG8pO3JldHVybiBzLm5vdGlmeVdpdGgoZSxbbCxvLG5dKSwxPm8mJnU/bjoocy5yZXNvbHZlV2l0aChlLFtsXSksITEpfSxsPXMucHJvbWlzZSh7ZWxlbTplLHByb3BzOmIuZXh0ZW5kKHt9LHQpLG9wdHM6Yi5leHRlbmQoITAse3NwZWNpYWxFYXNpbmc6e319LG4pLG9yaWdpbmFsUHJvcGVydGllczp0LG9yaWdpbmFsT3B0aW9uczpuLHN0YXJ0VGltZTpYbnx8S24oKSxkdXJhdGlvbjpuLmR1cmF0aW9uLHR3ZWVuczpbXSxjcmVhdGVUd2VlbjpmdW5jdGlvbih0LG4pe3ZhciByPWIuVHdlZW4oZSxsLm9wdHMsdCxuLGwub3B0cy5zcGVjaWFsRWFzaW5nW3RdfHxsLm9wdHMuZWFzaW5nKTtyZXR1cm4gbC50d2VlbnMucHVzaChyKSxyfSxzdG9wOmZ1bmN0aW9uKHQpe3ZhciBuPTAscj10P2wudHdlZW5zLmxlbmd0aDowO2lmKGkpcmV0dXJuIHRoaXM7Zm9yKGk9ITA7cj5uO24rKylsLnR3ZWVuc1tuXS5ydW4oMSk7cmV0dXJuIHQ/cy5yZXNvbHZlV2l0aChlLFtsLHRdKTpzLnJlamVjdFdpdGgoZSxbbCx0XSksdGhpc319KSxjPWwucHJvcHM7Zm9yKHRyKGMsbC5vcHRzLnNwZWNpYWxFYXNpbmcpO2E+bztvKyspaWYocj1HbltvXS5jYWxsKGwsZSxjLGwub3B0cykpcmV0dXJuIHI7cmV0dXJuIFpuKGwsYyksYi5pc0Z1bmN0aW9uKGwub3B0cy5zdGFydCkmJmwub3B0cy5zdGFydC5jYWxsKGUsbCksYi5meC50aW1lcihiLmV4dGVuZCh1LHtlbGVtOmUsYW5pbTpsLHF1ZXVlOmwub3B0cy5xdWV1ZX0pKSxsLnByb2dyZXNzKGwub3B0cy5wcm9ncmVzcykuZG9uZShsLm9wdHMuZG9uZSxsLm9wdHMuY29tcGxldGUpLmZhaWwobC5vcHRzLmZhaWwpLmFsd2F5cyhsLm9wdHMuYWx3YXlzKX1mdW5jdGlvbiB0cihlLHQpe3ZhciBuLHIsaSxvLGE7Zm9yKGkgaW4gZSlpZihyPWIuY2FtZWxDYXNlKGkpLG89dFtyXSxuPWVbaV0sYi5pc0FycmF5KG4pJiYobz1uWzFdLG49ZVtpXT1uWzBdKSxpIT09ciYmKGVbcl09bixkZWxldGUgZVtpXSksYT1iLmNzc0hvb2tzW3JdLGEmJlwiZXhwYW5kXCJpbiBhKXtuPWEuZXhwYW5kKG4pLGRlbGV0ZSBlW3JdO2ZvcihpIGluIG4paSBpbiBlfHwoZVtpXT1uW2ldLHRbaV09byl9ZWxzZSB0W3JdPW99Yi5BbmltYXRpb249Yi5leHRlbmQoZXIse3R3ZWVuZXI6ZnVuY3Rpb24oZSx0KXtiLmlzRnVuY3Rpb24oZSk/KHQ9ZSxlPVtcIipcIl0pOmU9ZS5zcGxpdChcIiBcIik7dmFyIG4scj0wLGk9ZS5sZW5ndGg7Zm9yKDtpPnI7cisrKW49ZVtyXSxRbltuXT1RbltuXXx8W10sUW5bbl0udW5zaGlmdCh0KX0scHJlZmlsdGVyOmZ1bmN0aW9uKGUsdCl7dD9Hbi51bnNoaWZ0KGUpOkduLnB1c2goZSl9fSk7ZnVuY3Rpb24gbnIoZSx0LG4pe3ZhciByLGksbyxhLHMsdSxsLGMscCxmPXRoaXMsZD1lLnN0eWxlLGg9e30sZz1bXSxtPWUubm9kZVR5cGUmJm5uKGUpO24ucXVldWV8fChjPWIuX3F1ZXVlSG9va3MoZSxcImZ4XCIpLG51bGw9PWMudW5xdWV1ZWQmJihjLnVucXVldWVkPTAscD1jLmVtcHR5LmZpcmUsYy5lbXB0eS5maXJlPWZ1bmN0aW9uKCl7Yy51bnF1ZXVlZHx8cCgpfSksYy51bnF1ZXVlZCsrLGYuYWx3YXlzKGZ1bmN0aW9uKCl7Zi5hbHdheXMoZnVuY3Rpb24oKXtjLnVucXVldWVkLS0sYi5xdWV1ZShlLFwiZnhcIikubGVuZ3RofHxjLmVtcHR5LmZpcmUoKX0pfSkpLDE9PT1lLm5vZGVUeXBlJiYoXCJoZWlnaHRcImluIHR8fFwid2lkdGhcImluIHQpJiYobi5vdmVyZmxvdz1bZC5vdmVyZmxvdyxkLm92ZXJmbG93WCxkLm92ZXJmbG93WV0sXCJpbmxpbmVcIj09PWIuY3NzKGUsXCJkaXNwbGF5XCIpJiZcIm5vbmVcIj09PWIuY3NzKGUsXCJmbG9hdFwiKSYmKGIuc3VwcG9ydC5pbmxpbmVCbG9ja05lZWRzTGF5b3V0JiZcImlubGluZVwiIT09dW4oZS5ub2RlTmFtZSk/ZC56b29tPTE6ZC5kaXNwbGF5PVwiaW5saW5lLWJsb2NrXCIpKSxuLm92ZXJmbG93JiYoZC5vdmVyZmxvdz1cImhpZGRlblwiLGIuc3VwcG9ydC5zaHJpbmtXcmFwQmxvY2tzfHxmLmFsd2F5cyhmdW5jdGlvbigpe2Qub3ZlcmZsb3c9bi5vdmVyZmxvd1swXSxkLm92ZXJmbG93WD1uLm92ZXJmbG93WzFdLGQub3ZlcmZsb3dZPW4ub3ZlcmZsb3dbMl19KSk7Zm9yKGkgaW4gdClpZihhPXRbaV0sVm4uZXhlYyhhKSl7aWYoZGVsZXRlIHRbaV0sdT11fHxcInRvZ2dsZVwiPT09YSxhPT09KG0/XCJoaWRlXCI6XCJzaG93XCIpKWNvbnRpbnVlO2cucHVzaChpKX1pZihvPWcubGVuZ3RoKXtzPWIuX2RhdGEoZSxcImZ4c2hvd1wiKXx8Yi5fZGF0YShlLFwiZnhzaG93XCIse30pLFwiaGlkZGVuXCJpbiBzJiYobT1zLmhpZGRlbiksdSYmKHMuaGlkZGVuPSFtKSxtP2IoZSkuc2hvdygpOmYuZG9uZShmdW5jdGlvbigpe2IoZSkuaGlkZSgpfSksZi5kb25lKGZ1bmN0aW9uKCl7dmFyIHQ7Yi5fcmVtb3ZlRGF0YShlLFwiZnhzaG93XCIpO2Zvcih0IGluIGgpYi5zdHlsZShlLHQsaFt0XSl9KTtmb3IoaT0wO28+aTtpKyspcj1nW2ldLGw9Zi5jcmVhdGVUd2VlbihyLG0/c1tyXTowKSxoW3JdPXNbcl18fGIuc3R5bGUoZSxyKSxyIGluIHN8fChzW3JdPWwuc3RhcnQsbSYmKGwuZW5kPWwuc3RhcnQsbC5zdGFydD1cIndpZHRoXCI9PT1yfHxcImhlaWdodFwiPT09cj8xOjApKX19ZnVuY3Rpb24gcnIoZSx0LG4scixpKXtyZXR1cm4gbmV3IHJyLnByb3RvdHlwZS5pbml0KGUsdCxuLHIsaSl9Yi5Ud2Vlbj1ycixyci5wcm90b3R5cGU9e2NvbnN0cnVjdG9yOnJyLGluaXQ6ZnVuY3Rpb24oZSx0LG4scixpLG8pe3RoaXMuZWxlbT1lLHRoaXMucHJvcD1uLHRoaXMuZWFzaW5nPWl8fFwic3dpbmdcIix0aGlzLm9wdGlvbnM9dCx0aGlzLnN0YXJ0PXRoaXMubm93PXRoaXMuY3VyKCksdGhpcy5lbmQ9cix0aGlzLnVuaXQ9b3x8KGIuY3NzTnVtYmVyW25dP1wiXCI6XCJweFwiKX0sY3VyOmZ1bmN0aW9uKCl7dmFyIGU9cnIucHJvcEhvb2tzW3RoaXMucHJvcF07cmV0dXJuIGUmJmUuZ2V0P2UuZ2V0KHRoaXMpOnJyLnByb3BIb29rcy5fZGVmYXVsdC5nZXQodGhpcyl9LHJ1bjpmdW5jdGlvbihlKXt2YXIgdCxuPXJyLnByb3BIb29rc1t0aGlzLnByb3BdO3JldHVybiB0aGlzLnBvcz10PXRoaXMub3B0aW9ucy5kdXJhdGlvbj9iLmVhc2luZ1t0aGlzLmVhc2luZ10oZSx0aGlzLm9wdGlvbnMuZHVyYXRpb24qZSwwLDEsdGhpcy5vcHRpb25zLmR1cmF0aW9uKTplLHRoaXMubm93PSh0aGlzLmVuZC10aGlzLnN0YXJ0KSp0K3RoaXMuc3RhcnQsdGhpcy5vcHRpb25zLnN0ZXAmJnRoaXMub3B0aW9ucy5zdGVwLmNhbGwodGhpcy5lbGVtLHRoaXMubm93LHRoaXMpLG4mJm4uc2V0P24uc2V0KHRoaXMpOnJyLnByb3BIb29rcy5fZGVmYXVsdC5zZXQodGhpcyksdGhpc319LHJyLnByb3RvdHlwZS5pbml0LnByb3RvdHlwZT1yci5wcm90b3R5cGUscnIucHJvcEhvb2tzPXtfZGVmYXVsdDp7Z2V0OmZ1bmN0aW9uKGUpe3ZhciB0O3JldHVybiBudWxsPT1lLmVsZW1bZS5wcm9wXXx8ZS5lbGVtLnN0eWxlJiZudWxsIT1lLmVsZW0uc3R5bGVbZS5wcm9wXT8odD1iLmNzcyhlLmVsZW0sZS5wcm9wLFwiXCIpLHQmJlwiYXV0b1wiIT09dD90OjApOmUuZWxlbVtlLnByb3BdfSxzZXQ6ZnVuY3Rpb24oZSl7Yi5meC5zdGVwW2UucHJvcF0/Yi5meC5zdGVwW2UucHJvcF0oZSk6ZS5lbGVtLnN0eWxlJiYobnVsbCE9ZS5lbGVtLnN0eWxlW2IuY3NzUHJvcHNbZS5wcm9wXV18fGIuY3NzSG9va3NbZS5wcm9wXSk/Yi5zdHlsZShlLmVsZW0sZS5wcm9wLGUubm93K2UudW5pdCk6ZS5lbGVtW2UucHJvcF09ZS5ub3d9fX0scnIucHJvcEhvb2tzLnNjcm9sbFRvcD1yci5wcm9wSG9va3Muc2Nyb2xsTGVmdD17c2V0OmZ1bmN0aW9uKGUpe2UuZWxlbS5ub2RlVHlwZSYmZS5lbGVtLnBhcmVudE5vZGUmJihlLmVsZW1bZS5wcm9wXT1lLm5vdyl9fSxiLmVhY2goW1widG9nZ2xlXCIsXCJzaG93XCIsXCJoaWRlXCJdLGZ1bmN0aW9uKGUsdCl7dmFyIG49Yi5mblt0XTtiLmZuW3RdPWZ1bmN0aW9uKGUscixpKXtyZXR1cm4gbnVsbD09ZXx8XCJib29sZWFuXCI9PXR5cGVvZiBlP24uYXBwbHkodGhpcyxhcmd1bWVudHMpOnRoaXMuYW5pbWF0ZShpcih0LCEwKSxlLHIsaSl9fSksYi5mbi5leHRlbmQoe2ZhZGVUbzpmdW5jdGlvbihlLHQsbixyKXtyZXR1cm4gdGhpcy5maWx0ZXIobm4pLmNzcyhcIm9wYWNpdHlcIiwwKS5zaG93KCkuZW5kKCkuYW5pbWF0ZSh7b3BhY2l0eTp0fSxlLG4scil9LGFuaW1hdGU6ZnVuY3Rpb24oZSx0LG4scil7dmFyIGk9Yi5pc0VtcHR5T2JqZWN0KGUpLG89Yi5zcGVlZCh0LG4sciksYT1mdW5jdGlvbigpe3ZhciB0PWVyKHRoaXMsYi5leHRlbmQoe30sZSksbyk7YS5maW5pc2g9ZnVuY3Rpb24oKXt0LnN0b3AoITApfSwoaXx8Yi5fZGF0YSh0aGlzLFwiZmluaXNoXCIpKSYmdC5zdG9wKCEwKX07cmV0dXJuIGEuZmluaXNoPWEsaXx8by5xdWV1ZT09PSExP3RoaXMuZWFjaChhKTp0aGlzLnF1ZXVlKG8ucXVldWUsYSl9LHN0b3A6ZnVuY3Rpb24oZSxuLHIpe3ZhciBpPWZ1bmN0aW9uKGUpe3ZhciB0PWUuc3RvcDtkZWxldGUgZS5zdG9wLHQocil9O3JldHVyblwic3RyaW5nXCIhPXR5cGVvZiBlJiYocj1uLG49ZSxlPXQpLG4mJmUhPT0hMSYmdGhpcy5xdWV1ZShlfHxcImZ4XCIsW10pLHRoaXMuZWFjaChmdW5jdGlvbigpe3ZhciB0PSEwLG49bnVsbCE9ZSYmZStcInF1ZXVlSG9va3NcIixvPWIudGltZXJzLGE9Yi5fZGF0YSh0aGlzKTtpZihuKWFbbl0mJmFbbl0uc3RvcCYmaShhW25dKTtlbHNlIGZvcihuIGluIGEpYVtuXSYmYVtuXS5zdG9wJiZKbi50ZXN0KG4pJiZpKGFbbl0pO2ZvcihuPW8ubGVuZ3RoO24tLTspb1tuXS5lbGVtIT09dGhpc3x8bnVsbCE9ZSYmb1tuXS5xdWV1ZSE9PWV8fChvW25dLmFuaW0uc3RvcChyKSx0PSExLG8uc3BsaWNlKG4sMSkpOyh0fHwhcikmJmIuZGVxdWV1ZSh0aGlzLGUpfSl9LGZpbmlzaDpmdW5jdGlvbihlKXtyZXR1cm4gZSE9PSExJiYoZT1lfHxcImZ4XCIpLHRoaXMuZWFjaChmdW5jdGlvbigpe3ZhciB0LG49Yi5fZGF0YSh0aGlzKSxyPW5bZStcInF1ZXVlXCJdLGk9bltlK1wicXVldWVIb29rc1wiXSxvPWIudGltZXJzLGE9cj9yLmxlbmd0aDowO2ZvcihuLmZpbmlzaD0hMCxiLnF1ZXVlKHRoaXMsZSxbXSksaSYmaS5jdXImJmkuY3VyLmZpbmlzaCYmaS5jdXIuZmluaXNoLmNhbGwodGhpcyksdD1vLmxlbmd0aDt0LS07KW9bdF0uZWxlbT09PXRoaXMmJm9bdF0ucXVldWU9PT1lJiYob1t0XS5hbmltLnN0b3AoITApLG8uc3BsaWNlKHQsMSkpO2Zvcih0PTA7YT50O3QrKylyW3RdJiZyW3RdLmZpbmlzaCYmclt0XS5maW5pc2guY2FsbCh0aGlzKTtkZWxldGUgbi5maW5pc2h9KX19KTtmdW5jdGlvbiBpcihlLHQpe3ZhciBuLHI9e2hlaWdodDplfSxpPTA7Zm9yKHQ9dD8xOjA7ND5pO2krPTItdCluPVp0W2ldLHJbXCJtYXJnaW5cIituXT1yW1wicGFkZGluZ1wiK25dPWU7cmV0dXJuIHQmJihyLm9wYWNpdHk9ci53aWR0aD1lKSxyfWIuZWFjaCh7c2xpZGVEb3duOmlyKFwic2hvd1wiKSxzbGlkZVVwOmlyKFwiaGlkZVwiKSxzbGlkZVRvZ2dsZTppcihcInRvZ2dsZVwiKSxmYWRlSW46e29wYWNpdHk6XCJzaG93XCJ9LGZhZGVPdXQ6e29wYWNpdHk6XCJoaWRlXCJ9LGZhZGVUb2dnbGU6e29wYWNpdHk6XCJ0b2dnbGVcIn19LGZ1bmN0aW9uKGUsdCl7Yi5mbltlXT1mdW5jdGlvbihlLG4scil7cmV0dXJuIHRoaXMuYW5pbWF0ZSh0LGUsbixyKX19KSxiLnNwZWVkPWZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1lJiZcIm9iamVjdFwiPT10eXBlb2YgZT9iLmV4dGVuZCh7fSxlKTp7Y29tcGxldGU6bnx8IW4mJnR8fGIuaXNGdW5jdGlvbihlKSYmZSxkdXJhdGlvbjplLGVhc2luZzpuJiZ0fHx0JiYhYi5pc0Z1bmN0aW9uKHQpJiZ0fTtyZXR1cm4gci5kdXJhdGlvbj1iLmZ4Lm9mZj8wOlwibnVtYmVyXCI9PXR5cGVvZiByLmR1cmF0aW9uP3IuZHVyYXRpb246ci5kdXJhdGlvbiBpbiBiLmZ4LnNwZWVkcz9iLmZ4LnNwZWVkc1tyLmR1cmF0aW9uXTpiLmZ4LnNwZWVkcy5fZGVmYXVsdCwobnVsbD09ci5xdWV1ZXx8ci5xdWV1ZT09PSEwKSYmKHIucXVldWU9XCJmeFwiKSxyLm9sZD1yLmNvbXBsZXRlLHIuY29tcGxldGU9ZnVuY3Rpb24oKXtiLmlzRnVuY3Rpb24oci5vbGQpJiZyLm9sZC5jYWxsKHRoaXMpLHIucXVldWUmJmIuZGVxdWV1ZSh0aGlzLHIucXVldWUpfSxyfSxiLmVhc2luZz17bGluZWFyOmZ1bmN0aW9uKGUpe3JldHVybiBlfSxzd2luZzpmdW5jdGlvbihlKXtyZXR1cm4uNS1NYXRoLmNvcyhlKk1hdGguUEkpLzJ9fSxiLnRpbWVycz1bXSxiLmZ4PXJyLnByb3RvdHlwZS5pbml0LGIuZngudGljaz1mdW5jdGlvbigpe3ZhciBlLG49Yi50aW1lcnMscj0wO2ZvcihYbj1iLm5vdygpO24ubGVuZ3RoPnI7cisrKWU9bltyXSxlKCl8fG5bcl0hPT1lfHxuLnNwbGljZShyLS0sMSk7bi5sZW5ndGh8fGIuZnguc3RvcCgpLFhuPXR9LGIuZngudGltZXI9ZnVuY3Rpb24oZSl7ZSgpJiZiLnRpbWVycy5wdXNoKGUpJiZiLmZ4LnN0YXJ0KCl9LGIuZnguaW50ZXJ2YWw9MTMsYi5meC5zdGFydD1mdW5jdGlvbigpe1VufHwoVW49c2V0SW50ZXJ2YWwoYi5meC50aWNrLGIuZnguaW50ZXJ2YWwpKX0sYi5meC5zdG9wPWZ1bmN0aW9uKCl7Y2xlYXJJbnRlcnZhbChVbiksVW49bnVsbH0sYi5meC5zcGVlZHM9e3Nsb3c6NjAwLGZhc3Q6MjAwLF9kZWZhdWx0OjQwMH0sYi5meC5zdGVwPXt9LGIuZXhwciYmYi5leHByLmZpbHRlcnMmJihiLmV4cHIuZmlsdGVycy5hbmltYXRlZD1mdW5jdGlvbihlKXtyZXR1cm4gYi5ncmVwKGIudGltZXJzLGZ1bmN0aW9uKHQpe3JldHVybiBlPT09dC5lbGVtfSkubGVuZ3RofSksYi5mbi5vZmZzZXQ9ZnVuY3Rpb24oZSl7aWYoYXJndW1lbnRzLmxlbmd0aClyZXR1cm4gZT09PXQ/dGhpczp0aGlzLmVhY2goZnVuY3Rpb24odCl7Yi5vZmZzZXQuc2V0T2Zmc2V0KHRoaXMsZSx0KX0pO3ZhciBuLHIsbz17dG9wOjAsbGVmdDowfSxhPXRoaXNbMF0scz1hJiZhLm93bmVyRG9jdW1lbnQ7aWYocylyZXR1cm4gbj1zLmRvY3VtZW50RWxlbWVudCxiLmNvbnRhaW5zKG4sYSk/KHR5cGVvZiBhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCE9PWkmJihvPWEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkpLHI9b3Iocykse3RvcDpvLnRvcCsoci5wYWdlWU9mZnNldHx8bi5zY3JvbGxUb3ApLShuLmNsaWVudFRvcHx8MCksbGVmdDpvLmxlZnQrKHIucGFnZVhPZmZzZXR8fG4uc2Nyb2xsTGVmdCktKG4uY2xpZW50TGVmdHx8MCl9KTpvfSxiLm9mZnNldD17c2V0T2Zmc2V0OmZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1iLmNzcyhlLFwicG9zaXRpb25cIik7XCJzdGF0aWNcIj09PXImJihlLnN0eWxlLnBvc2l0aW9uPVwicmVsYXRpdmVcIik7dmFyIGk9YihlKSxvPWkub2Zmc2V0KCksYT1iLmNzcyhlLFwidG9wXCIpLHM9Yi5jc3MoZSxcImxlZnRcIiksdT0oXCJhYnNvbHV0ZVwiPT09cnx8XCJmaXhlZFwiPT09cikmJmIuaW5BcnJheShcImF1dG9cIixbYSxzXSk+LTEsbD17fSxjPXt9LHAsZjt1PyhjPWkucG9zaXRpb24oKSxwPWMudG9wLGY9Yy5sZWZ0KToocD1wYXJzZUZsb2F0KGEpfHwwLGY9cGFyc2VGbG9hdChzKXx8MCksYi5pc0Z1bmN0aW9uKHQpJiYodD10LmNhbGwoZSxuLG8pKSxudWxsIT10LnRvcCYmKGwudG9wPXQudG9wLW8udG9wK3ApLG51bGwhPXQubGVmdCYmKGwubGVmdD10LmxlZnQtby5sZWZ0K2YpLFwidXNpbmdcImluIHQ/dC51c2luZy5jYWxsKGUsbCk6aS5jc3MobCl9fSxiLmZuLmV4dGVuZCh7cG9zaXRpb246ZnVuY3Rpb24oKXtpZih0aGlzWzBdKXt2YXIgZSx0LG49e3RvcDowLGxlZnQ6MH0scj10aGlzWzBdO3JldHVyblwiZml4ZWRcIj09PWIuY3NzKHIsXCJwb3NpdGlvblwiKT90PXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk6KGU9dGhpcy5vZmZzZXRQYXJlbnQoKSx0PXRoaXMub2Zmc2V0KCksYi5ub2RlTmFtZShlWzBdLFwiaHRtbFwiKXx8KG49ZS5vZmZzZXQoKSksbi50b3ArPWIuY3NzKGVbMF0sXCJib3JkZXJUb3BXaWR0aFwiLCEwKSxuLmxlZnQrPWIuY3NzKGVbMF0sXCJib3JkZXJMZWZ0V2lkdGhcIiwhMCkpLHt0b3A6dC50b3Atbi50b3AtYi5jc3MocixcIm1hcmdpblRvcFwiLCEwKSxsZWZ0OnQubGVmdC1uLmxlZnQtYi5jc3MocixcIm1hcmdpbkxlZnRcIiwhMCl9fX0sb2Zmc2V0UGFyZW50OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKCl7dmFyIGU9dGhpcy5vZmZzZXRQYXJlbnR8fG8uZG9jdW1lbnRFbGVtZW50O3doaWxlKGUmJiFiLm5vZGVOYW1lKGUsXCJodG1sXCIpJiZcInN0YXRpY1wiPT09Yi5jc3MoZSxcInBvc2l0aW9uXCIpKWU9ZS5vZmZzZXRQYXJlbnQ7cmV0dXJuIGV8fG8uZG9jdW1lbnRFbGVtZW50fSl9fSksYi5lYWNoKHtzY3JvbGxMZWZ0OlwicGFnZVhPZmZzZXRcIixzY3JvbGxUb3A6XCJwYWdlWU9mZnNldFwifSxmdW5jdGlvbihlLG4pe3ZhciByPS9ZLy50ZXN0KG4pO2IuZm5bZV09ZnVuY3Rpb24oaSl7cmV0dXJuIGIuYWNjZXNzKHRoaXMsZnVuY3Rpb24oZSxpLG8pe3ZhciBhPW9yKGUpO3JldHVybiBvPT09dD9hP24gaW4gYT9hW25dOmEuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50W2ldOmVbaV06KGE/YS5zY3JvbGxUbyhyP2IoYSkuc2Nyb2xsTGVmdCgpOm8scj9vOmIoYSkuc2Nyb2xsVG9wKCkpOmVbaV09byx0KX0sZSxpLGFyZ3VtZW50cy5sZW5ndGgsbnVsbCl9fSk7ZnVuY3Rpb24gb3IoZSl7cmV0dXJuIGIuaXNXaW5kb3coZSk/ZTo5PT09ZS5ub2RlVHlwZT9lLmRlZmF1bHRWaWV3fHxlLnBhcmVudFdpbmRvdzohMX1iLmVhY2goe0hlaWdodDpcImhlaWdodFwiLFdpZHRoOlwid2lkdGhcIn0sZnVuY3Rpb24oZSxuKXtiLmVhY2goe3BhZGRpbmc6XCJpbm5lclwiK2UsY29udGVudDpuLFwiXCI6XCJvdXRlclwiK2V9LGZ1bmN0aW9uKHIsaSl7Yi5mbltpXT1mdW5jdGlvbihpLG8pe3ZhciBhPWFyZ3VtZW50cy5sZW5ndGgmJihyfHxcImJvb2xlYW5cIiE9dHlwZW9mIGkpLHM9cnx8KGk9PT0hMHx8bz09PSEwP1wibWFyZ2luXCI6XCJib3JkZXJcIik7cmV0dXJuIGIuYWNjZXNzKHRoaXMsZnVuY3Rpb24obixyLGkpe3ZhciBvO3JldHVybiBiLmlzV2luZG93KG4pP24uZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50W1wiY2xpZW50XCIrZV06OT09PW4ubm9kZVR5cGU/KG89bi5kb2N1bWVudEVsZW1lbnQsTWF0aC5tYXgobi5ib2R5W1wic2Nyb2xsXCIrZV0sb1tcInNjcm9sbFwiK2VdLG4uYm9keVtcIm9mZnNldFwiK2VdLG9bXCJvZmZzZXRcIitlXSxvW1wiY2xpZW50XCIrZV0pKTppPT09dD9iLmNzcyhuLHIscyk6Yi5zdHlsZShuLHIsaSxzKX0sbixhP2k6dCxhLG51bGwpfX0pfSksZS5qUXVlcnk9ZS4kPWIsXCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kJiZkZWZpbmUuYW1kLmpRdWVyeSYmZGVmaW5lKFwianF1ZXJ5XCIsW10sZnVuY3Rpb24oKXtyZXR1cm4gYn0pfSkod2luZG93KTsiLCIvKmdsb2JhbCBkZWZpbmU6ZmFsc2UgKi9cbi8qKlxuICogQ29weXJpZ2h0IDIwMTMgQ3JhaWcgQ2FtcGJlbGxcbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqXG4gKiBNb3VzZXRyYXAgaXMgYSBzaW1wbGUga2V5Ym9hcmQgc2hvcnRjdXQgbGlicmFyeSBmb3IgSmF2YXNjcmlwdCB3aXRoXG4gKiBubyBleHRlcm5hbCBkZXBlbmRlbmNpZXNcbiAqXG4gKiBAdmVyc2lvbiAxLjQuNlxuICogQHVybCBjcmFpZy5pcy9raWxsaW5nL21pY2VcbiAqL1xuKGZ1bmN0aW9uKHdpbmRvdywgZG9jdW1lbnQsIHVuZGVmaW5lZCkge1xuXG4gICAgLyoqXG4gICAgICogbWFwcGluZyBvZiBzcGVjaWFsIGtleWNvZGVzIHRvIHRoZWlyIGNvcnJlc3BvbmRpbmcga2V5c1xuICAgICAqXG4gICAgICogZXZlcnl0aGluZyBpbiB0aGlzIGRpY3Rpb25hcnkgY2Fubm90IHVzZSBrZXlwcmVzcyBldmVudHNcbiAgICAgKiBzbyBpdCBoYXMgdG8gYmUgaGVyZSB0byBtYXAgdG8gdGhlIGNvcnJlY3Qga2V5Y29kZXMgZm9yXG4gICAgICoga2V5dXAva2V5ZG93biBldmVudHNcbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgdmFyIF9NQVAgPSB7XG4gICAgICAgICAgICA4OiAnYmFja3NwYWNlJyxcbiAgICAgICAgICAgIDk6ICd0YWInLFxuICAgICAgICAgICAgMTM6ICdlbnRlcicsXG4gICAgICAgICAgICAxNjogJ3NoaWZ0JyxcbiAgICAgICAgICAgIDE3OiAnY3RybCcsXG4gICAgICAgICAgICAxODogJ2FsdCcsXG4gICAgICAgICAgICAyMDogJ2NhcHNsb2NrJyxcbiAgICAgICAgICAgIDI3OiAnZXNjJyxcbiAgICAgICAgICAgIDMyOiAnc3BhY2UnLFxuICAgICAgICAgICAgMzM6ICdwYWdldXAnLFxuICAgICAgICAgICAgMzQ6ICdwYWdlZG93bicsXG4gICAgICAgICAgICAzNTogJ2VuZCcsXG4gICAgICAgICAgICAzNjogJ2hvbWUnLFxuICAgICAgICAgICAgMzc6ICdsZWZ0JyxcbiAgICAgICAgICAgIDM4OiAndXAnLFxuICAgICAgICAgICAgMzk6ICdyaWdodCcsXG4gICAgICAgICAgICA0MDogJ2Rvd24nLFxuICAgICAgICAgICAgNDU6ICdpbnMnLFxuICAgICAgICAgICAgNDY6ICdkZWwnLFxuICAgICAgICAgICAgOTE6ICdtZXRhJyxcbiAgICAgICAgICAgIDkzOiAnbWV0YScsXG4gICAgICAgICAgICAyMjQ6ICdtZXRhJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBtYXBwaW5nIGZvciBzcGVjaWFsIGNoYXJhY3RlcnMgc28gdGhleSBjYW4gc3VwcG9ydFxuICAgICAgICAgKlxuICAgICAgICAgKiB0aGlzIGRpY3Rpb25hcnkgaXMgb25seSB1c2VkIGluY2FzZSB5b3Ugd2FudCB0byBiaW5kIGFcbiAgICAgICAgICoga2V5dXAgb3Iga2V5ZG93biBldmVudCB0byBvbmUgb2YgdGhlc2Uga2V5c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX0tFWUNPREVfTUFQID0ge1xuICAgICAgICAgICAgMTA2OiAnKicsXG4gICAgICAgICAgICAxMDc6ICcrJyxcbiAgICAgICAgICAgIDEwOTogJy0nLFxuICAgICAgICAgICAgMTEwOiAnLicsXG4gICAgICAgICAgICAxMTEgOiAnLycsXG4gICAgICAgICAgICAxODY6ICc7JyxcbiAgICAgICAgICAgIDE4NzogJz0nLFxuICAgICAgICAgICAgMTg4OiAnLCcsXG4gICAgICAgICAgICAxODk6ICctJyxcbiAgICAgICAgICAgIDE5MDogJy4nLFxuICAgICAgICAgICAgMTkxOiAnLycsXG4gICAgICAgICAgICAxOTI6ICdgJyxcbiAgICAgICAgICAgIDIxOTogJ1snLFxuICAgICAgICAgICAgMjIwOiAnXFxcXCcsXG4gICAgICAgICAgICAyMjE6ICddJyxcbiAgICAgICAgICAgIDIyMjogJ1xcJydcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdGhpcyBpcyBhIG1hcHBpbmcgb2Yga2V5cyB0aGF0IHJlcXVpcmUgc2hpZnQgb24gYSBVUyBrZXlwYWRcbiAgICAgICAgICogYmFjayB0byB0aGUgbm9uIHNoaWZ0IGVxdWl2ZWxlbnRzXG4gICAgICAgICAqXG4gICAgICAgICAqIHRoaXMgaXMgc28geW91IGNhbiB1c2Uga2V5dXAgZXZlbnRzIHdpdGggdGhlc2Uga2V5c1xuICAgICAgICAgKlxuICAgICAgICAgKiBub3RlIHRoYXQgdGhpcyB3aWxsIG9ubHkgd29yayByZWxpYWJseSBvbiBVUyBrZXlib2FyZHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIF9TSElGVF9NQVAgPSB7XG4gICAgICAgICAgICAnfic6ICdgJyxcbiAgICAgICAgICAgICchJzogJzEnLFxuICAgICAgICAgICAgJ0AnOiAnMicsXG4gICAgICAgICAgICAnIyc6ICczJyxcbiAgICAgICAgICAgICckJzogJzQnLFxuICAgICAgICAgICAgJyUnOiAnNScsXG4gICAgICAgICAgICAnXic6ICc2JyxcbiAgICAgICAgICAgICcmJzogJzcnLFxuICAgICAgICAgICAgJyonOiAnOCcsXG4gICAgICAgICAgICAnKCc6ICc5JyxcbiAgICAgICAgICAgICcpJzogJzAnLFxuICAgICAgICAgICAgJ18nOiAnLScsXG4gICAgICAgICAgICAnKyc6ICc9JyxcbiAgICAgICAgICAgICc6JzogJzsnLFxuICAgICAgICAgICAgJ1xcXCInOiAnXFwnJyxcbiAgICAgICAgICAgICc8JzogJywnLFxuICAgICAgICAgICAgJz4nOiAnLicsXG4gICAgICAgICAgICAnPyc6ICcvJyxcbiAgICAgICAgICAgICd8JzogJ1xcXFwnXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRoaXMgaXMgYSBsaXN0IG9mIHNwZWNpYWwgc3RyaW5ncyB5b3UgY2FuIHVzZSB0byBtYXBcbiAgICAgICAgICogdG8gbW9kaWZpZXIga2V5cyB3aGVuIHlvdSBzcGVjaWZ5IHlvdXIga2V5Ym9hcmQgc2hvcnRjdXRzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBfU1BFQ0lBTF9BTElBU0VTID0ge1xuICAgICAgICAgICAgJ29wdGlvbic6ICdhbHQnLFxuICAgICAgICAgICAgJ2NvbW1hbmQnOiAnbWV0YScsXG4gICAgICAgICAgICAncmV0dXJuJzogJ2VudGVyJyxcbiAgICAgICAgICAgICdlc2NhcGUnOiAnZXNjJyxcbiAgICAgICAgICAgICdtb2QnOiAvTWFjfGlQb2R8aVBob25lfGlQYWQvLnRlc3QobmF2aWdhdG9yLnBsYXRmb3JtKSA/ICdtZXRhJyA6ICdjdHJsJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB2YXJpYWJsZSB0byBzdG9yZSB0aGUgZmxpcHBlZCB2ZXJzaW9uIG9mIF9NQVAgZnJvbSBhYm92ZVxuICAgICAgICAgKiBuZWVkZWQgdG8gY2hlY2sgaWYgd2Ugc2hvdWxkIHVzZSBrZXlwcmVzcyBvciBub3Qgd2hlbiBubyBhY3Rpb25cbiAgICAgICAgICogaXMgc3BlY2lmaWVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R8dW5kZWZpbmVkfVxuICAgICAgICAgKi9cbiAgICAgICAgX1JFVkVSU0VfTUFQLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBhIGxpc3Qgb2YgYWxsIHRoZSBjYWxsYmFja3Mgc2V0dXAgdmlhIE1vdXNldHJhcC5iaW5kKClcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIF9jYWxsYmFja3MgPSB7fSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZGlyZWN0IG1hcCBvZiBzdHJpbmcgY29tYmluYXRpb25zIHRvIGNhbGxiYWNrcyB1c2VkIGZvciB0cmlnZ2VyKClcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIF9kaXJlY3RNYXAgPSB7fSxcblxuICAgICAgICAvKipcbiAgICAgICAgICoga2VlcHMgdHJhY2sgb2Ygd2hhdCBsZXZlbCBlYWNoIHNlcXVlbmNlIGlzIGF0IHNpbmNlIG11bHRpcGxlXG4gICAgICAgICAqIHNlcXVlbmNlcyBjYW4gc3RhcnQgb3V0IHdpdGggdGhlIHNhbWUgc2VxdWVuY2VcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIF9zZXF1ZW5jZUxldmVscyA9IHt9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB2YXJpYWJsZSB0byBzdG9yZSB0aGUgc2V0VGltZW91dCBjYWxsXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudWxsfG51bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIF9yZXNldFRpbWVyLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB0ZW1wb3Jhcnkgc3RhdGUgd2hlcmUgd2Ugd2lsbCBpZ25vcmUgdGhlIG5leHQga2V5dXBcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW58c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgX2lnbm9yZU5leHRLZXl1cCA9IGZhbHNlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB0ZW1wb3Jhcnkgc3RhdGUgd2hlcmUgd2Ugd2lsbCBpZ25vcmUgdGhlIG5leHQga2V5cHJlc3NcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBfaWdub3JlTmV4dEtleXByZXNzID0gZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGFyZSB3ZSBjdXJyZW50bHkgaW5zaWRlIG9mIGEgc2VxdWVuY2U/XG4gICAgICAgICAqIHR5cGUgb2YgYWN0aW9uIChcImtleXVwXCIgb3IgXCJrZXlkb3duXCIgb3IgXCJrZXlwcmVzc1wiKSBvciBmYWxzZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbnxzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBfbmV4dEV4cGVjdGVkQWN0aW9uID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBsb29wIHRocm91Z2ggdGhlIGYga2V5cywgZjEgdG8gZjE5IGFuZCBhZGQgdGhlbSB0byB0aGUgbWFwXG4gICAgICogcHJvZ3JhbWF0aWNhbGx5XG4gICAgICovXG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCAyMDsgKytpKSB7XG4gICAgICAgIF9NQVBbMTExICsgaV0gPSAnZicgKyBpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGxvb3AgdGhyb3VnaCB0byBtYXAgbnVtYmVycyBvbiB0aGUgbnVtZXJpYyBrZXlwYWRcbiAgICAgKi9cbiAgICBmb3IgKGkgPSAwOyBpIDw9IDk7ICsraSkge1xuICAgICAgICBfTUFQW2kgKyA5Nl0gPSBpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNyb3NzIGJyb3dzZXIgYWRkIGV2ZW50IG1ldGhvZFxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbGVtZW50fEhUTUxEb2N1bWVudH0gb2JqZWN0XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHR5cGVcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfYWRkRXZlbnQob2JqZWN0LCB0eXBlLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAob2JqZWN0LmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgICAgIG9iamVjdC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrLCBmYWxzZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBvYmplY3QuYXR0YWNoRXZlbnQoJ29uJyArIHR5cGUsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB0YWtlcyB0aGUgZXZlbnQgYW5kIHJldHVybnMgdGhlIGtleSBjaGFyYWN0ZXJcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2NoYXJhY3RlckZyb21FdmVudChlKSB7XG5cbiAgICAgICAgLy8gZm9yIGtleXByZXNzIGV2ZW50cyB3ZSBzaG91bGQgcmV0dXJuIHRoZSBjaGFyYWN0ZXIgYXMgaXNcbiAgICAgICAgaWYgKGUudHlwZSA9PSAna2V5cHJlc3MnKSB7XG4gICAgICAgICAgICB2YXIgY2hhcmFjdGVyID0gU3RyaW5nLmZyb21DaGFyQ29kZShlLndoaWNoKTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIHNoaWZ0IGtleSBpcyBub3QgcHJlc3NlZCB0aGVuIGl0IGlzIHNhZmUgdG8gYXNzdW1lXG4gICAgICAgICAgICAvLyB0aGF0IHdlIHdhbnQgdGhlIGNoYXJhY3RlciB0byBiZSBsb3dlcmNhc2UuICB0aGlzIG1lYW5zIGlmXG4gICAgICAgICAgICAvLyB5b3UgYWNjaWRlbnRhbGx5IGhhdmUgY2FwcyBsb2NrIG9uIHRoZW4geW91ciBrZXkgYmluZGluZ3NcbiAgICAgICAgICAgIC8vIHdpbGwgY29udGludWUgdG8gd29ya1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIHRoZSBvbmx5IHNpZGUgZWZmZWN0IHRoYXQgbWlnaHQgbm90IGJlIGRlc2lyZWQgaXMgaWYgeW91XG4gICAgICAgICAgICAvLyBiaW5kIHNvbWV0aGluZyBsaWtlICdBJyBjYXVzZSB5b3Ugd2FudCB0byB0cmlnZ2VyIGFuXG4gICAgICAgICAgICAvLyBldmVudCB3aGVuIGNhcGl0YWwgQSBpcyBwcmVzc2VkIGNhcHMgbG9jayB3aWxsIG5vIGxvbmdlclxuICAgICAgICAgICAgLy8gdHJpZ2dlciB0aGUgZXZlbnQuICBzaGlmdCthIHdpbGwgdGhvdWdoLlxuICAgICAgICAgICAgaWYgKCFlLnNoaWZ0S2V5KSB7XG4gICAgICAgICAgICAgICAgY2hhcmFjdGVyID0gY2hhcmFjdGVyLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBjaGFyYWN0ZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBmb3Igbm9uIGtleXByZXNzIGV2ZW50cyB0aGUgc3BlY2lhbCBtYXBzIGFyZSBuZWVkZWRcbiAgICAgICAgaWYgKF9NQVBbZS53aGljaF0pIHtcbiAgICAgICAgICAgIHJldHVybiBfTUFQW2Uud2hpY2hdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF9LRVlDT0RFX01BUFtlLndoaWNoXSkge1xuICAgICAgICAgICAgcmV0dXJuIF9LRVlDT0RFX01BUFtlLndoaWNoXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIGl0IGlzIG5vdCBpbiB0aGUgc3BlY2lhbCBtYXBcblxuICAgICAgICAvLyB3aXRoIGtleWRvd24gYW5kIGtleXVwIGV2ZW50cyB0aGUgY2hhcmFjdGVyIHNlZW1zIHRvIGFsd2F5c1xuICAgICAgICAvLyBjb21lIGluIGFzIGFuIHVwcGVyY2FzZSBjaGFyYWN0ZXIgd2hldGhlciB5b3UgYXJlIHByZXNzaW5nIHNoaWZ0XG4gICAgICAgIC8vIG9yIG5vdC4gIHdlIHNob3VsZCBtYWtlIHN1cmUgaXQgaXMgYWx3YXlzIGxvd2VyY2FzZSBmb3IgY29tcGFyaXNvbnNcbiAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoZS53aGljaCkudG9Mb3dlckNhc2UoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjaGVja3MgaWYgdHdvIGFycmF5cyBhcmUgZXF1YWxcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vZGlmaWVyczFcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBtb2RpZmllcnMyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAgICovXG4gICAgZnVuY3Rpb24gX21vZGlmaWVyc01hdGNoKG1vZGlmaWVyczEsIG1vZGlmaWVyczIpIHtcbiAgICAgICAgcmV0dXJuIG1vZGlmaWVyczEuc29ydCgpLmpvaW4oJywnKSA9PT0gbW9kaWZpZXJzMi5zb3J0KCkuam9pbignLCcpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJlc2V0cyBhbGwgc2VxdWVuY2UgY291bnRlcnMgZXhjZXB0IGZvciB0aGUgb25lcyBwYXNzZWQgaW5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkb05vdFJlc2V0XG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9yZXNldFNlcXVlbmNlcyhkb05vdFJlc2V0KSB7XG4gICAgICAgIGRvTm90UmVzZXQgPSBkb05vdFJlc2V0IHx8IHt9O1xuXG4gICAgICAgIHZhciBhY3RpdmVTZXF1ZW5jZXMgPSBmYWxzZSxcbiAgICAgICAgICAgIGtleTtcblxuICAgICAgICBmb3IgKGtleSBpbiBfc2VxdWVuY2VMZXZlbHMpIHtcbiAgICAgICAgICAgIGlmIChkb05vdFJlc2V0W2tleV0pIHtcbiAgICAgICAgICAgICAgICBhY3RpdmVTZXF1ZW5jZXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgX3NlcXVlbmNlTGV2ZWxzW2tleV0gPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFhY3RpdmVTZXF1ZW5jZXMpIHtcbiAgICAgICAgICAgIF9uZXh0RXhwZWN0ZWRBY3Rpb24gPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGZpbmRzIGFsbCBjYWxsYmFja3MgdGhhdCBtYXRjaCBiYXNlZCBvbiB0aGUga2V5Y29kZSwgbW9kaWZpZXJzLFxuICAgICAqIGFuZCBhY3Rpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaGFyYWN0ZXJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBtb2RpZmllcnNcbiAgICAgKiBAcGFyYW0ge0V2ZW50fE9iamVjdH0gZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gc2VxdWVuY2VOYW1lIC0gbmFtZSBvZiB0aGUgc2VxdWVuY2Ugd2UgYXJlIGxvb2tpbmcgZm9yXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBjb21iaW5hdGlvblxuICAgICAqIEBwYXJhbSB7bnVtYmVyPX0gbGV2ZWxcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2dldE1hdGNoZXMoY2hhcmFjdGVyLCBtb2RpZmllcnMsIGUsIHNlcXVlbmNlTmFtZSwgY29tYmluYXRpb24sIGxldmVsKSB7XG4gICAgICAgIHZhciBpLFxuICAgICAgICAgICAgY2FsbGJhY2ssXG4gICAgICAgICAgICBtYXRjaGVzID0gW10sXG4gICAgICAgICAgICBhY3Rpb24gPSBlLnR5cGU7XG5cbiAgICAgICAgLy8gaWYgdGhlcmUgYXJlIG5vIGV2ZW50cyByZWxhdGVkIHRvIHRoaXMga2V5Y29kZVxuICAgICAgICBpZiAoIV9jYWxsYmFja3NbY2hhcmFjdGVyXSkge1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgYSBtb2RpZmllciBrZXkgaXMgY29taW5nIHVwIG9uIGl0cyBvd24gd2Ugc2hvdWxkIGFsbG93IGl0XG4gICAgICAgIGlmIChhY3Rpb24gPT0gJ2tleXVwJyAmJiBfaXNNb2RpZmllcihjaGFyYWN0ZXIpKSB7XG4gICAgICAgICAgICBtb2RpZmllcnMgPSBbY2hhcmFjdGVyXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBhbGwgY2FsbGJhY2tzIGZvciB0aGUga2V5IHRoYXQgd2FzIHByZXNzZWRcbiAgICAgICAgLy8gYW5kIHNlZSBpZiBhbnkgb2YgdGhlbSBtYXRjaFxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgX2NhbGxiYWNrc1tjaGFyYWN0ZXJdLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IF9jYWxsYmFja3NbY2hhcmFjdGVyXVtpXTtcblxuICAgICAgICAgICAgLy8gaWYgYSBzZXF1ZW5jZSBuYW1lIGlzIG5vdCBzcGVjaWZpZWQsIGJ1dCB0aGlzIGlzIGEgc2VxdWVuY2UgYXRcbiAgICAgICAgICAgIC8vIHRoZSB3cm9uZyBsZXZlbCB0aGVuIG1vdmUgb250byB0aGUgbmV4dCBtYXRjaFxuICAgICAgICAgICAgaWYgKCFzZXF1ZW5jZU5hbWUgJiYgY2FsbGJhY2suc2VxICYmIF9zZXF1ZW5jZUxldmVsc1tjYWxsYmFjay5zZXFdICE9IGNhbGxiYWNrLmxldmVsKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBhY3Rpb24gd2UgYXJlIGxvb2tpbmcgZm9yIGRvZXNuJ3QgbWF0Y2ggdGhlIGFjdGlvbiB3ZSBnb3RcbiAgICAgICAgICAgIC8vIHRoZW4gd2Ugc2hvdWxkIGtlZXAgZ29pbmdcbiAgICAgICAgICAgIGlmIChhY3Rpb24gIT0gY2FsbGJhY2suYWN0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgYSBrZXlwcmVzcyBldmVudCBhbmQgdGhlIG1ldGEga2V5IGFuZCBjb250cm9sIGtleVxuICAgICAgICAgICAgLy8gYXJlIG5vdCBwcmVzc2VkIHRoYXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIG9ubHkgbG9vayBhdCB0aGVcbiAgICAgICAgICAgIC8vIGNoYXJhY3Rlciwgb3RoZXJ3aXNlIGNoZWNrIHRoZSBtb2RpZmllcnMgYXMgd2VsbFxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIGNocm9tZSB3aWxsIG5vdCBmaXJlIGEga2V5cHJlc3MgaWYgbWV0YSBvciBjb250cm9sIGlzIGRvd25cbiAgICAgICAgICAgIC8vIHNhZmFyaSB3aWxsIGZpcmUgYSBrZXlwcmVzcyBpZiBtZXRhIG9yIG1ldGErc2hpZnQgaXMgZG93blxuICAgICAgICAgICAgLy8gZmlyZWZveCB3aWxsIGZpcmUgYSBrZXlwcmVzcyBpZiBtZXRhIG9yIGNvbnRyb2wgaXMgZG93blxuICAgICAgICAgICAgaWYgKChhY3Rpb24gPT0gJ2tleXByZXNzJyAmJiAhZS5tZXRhS2V5ICYmICFlLmN0cmxLZXkpIHx8IF9tb2RpZmllcnNNYXRjaChtb2RpZmllcnMsIGNhbGxiYWNrLm1vZGlmaWVycykpIHtcblxuICAgICAgICAgICAgICAgIC8vIHdoZW4geW91IGJpbmQgYSBjb21iaW5hdGlvbiBvciBzZXF1ZW5jZSBhIHNlY29uZCB0aW1lIGl0XG4gICAgICAgICAgICAgICAgLy8gc2hvdWxkIG92ZXJ3cml0ZSB0aGUgZmlyc3Qgb25lLiAgaWYgYSBzZXF1ZW5jZU5hbWUgb3JcbiAgICAgICAgICAgICAgICAvLyBjb21iaW5hdGlvbiBpcyBzcGVjaWZpZWQgaW4gdGhpcyBjYWxsIGl0IGRvZXMganVzdCB0aGF0XG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAvLyBAdG9kbyBtYWtlIGRlbGV0aW5nIGl0cyBvd24gbWV0aG9kP1xuICAgICAgICAgICAgICAgIHZhciBkZWxldGVDb21ibyA9ICFzZXF1ZW5jZU5hbWUgJiYgY2FsbGJhY2suY29tYm8gPT0gY29tYmluYXRpb247XG4gICAgICAgICAgICAgICAgdmFyIGRlbGV0ZVNlcXVlbmNlID0gc2VxdWVuY2VOYW1lICYmIGNhbGxiYWNrLnNlcSA9PSBzZXF1ZW5jZU5hbWUgJiYgY2FsbGJhY2subGV2ZWwgPT0gbGV2ZWw7XG4gICAgICAgICAgICAgICAgaWYgKGRlbGV0ZUNvbWJvIHx8IGRlbGV0ZVNlcXVlbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIF9jYWxsYmFja3NbY2hhcmFjdGVyXS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWF0Y2hlcy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtYXRjaGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHRha2VzIGEga2V5IGV2ZW50IGFuZCBmaWd1cmVzIG91dCB3aGF0IHRoZSBtb2RpZmllcnMgYXJlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9ldmVudE1vZGlmaWVycyhlKSB7XG4gICAgICAgIHZhciBtb2RpZmllcnMgPSBbXTtcblxuICAgICAgICBpZiAoZS5zaGlmdEtleSkge1xuICAgICAgICAgICAgbW9kaWZpZXJzLnB1c2goJ3NoaWZ0Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZS5hbHRLZXkpIHtcbiAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKCdhbHQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlLmN0cmxLZXkpIHtcbiAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKCdjdHJsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZS5tZXRhS2V5KSB7XG4gICAgICAgICAgICBtb2RpZmllcnMucHVzaCgnbWV0YScpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1vZGlmaWVycztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBwcmV2ZW50cyBkZWZhdWx0IGZvciB0aGlzIGV2ZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9wcmV2ZW50RGVmYXVsdChlKSB7XG4gICAgICAgIGlmIChlLnByZXZlbnREZWZhdWx0KSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBlLnJldHVyblZhbHVlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogc3RvcHMgcHJvcG9nYXRpb24gZm9yIHRoaXMgZXZlbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3N0b3BQcm9wYWdhdGlvbihlKSB7XG4gICAgICAgIGlmIChlLnN0b3BQcm9wYWdhdGlvbikge1xuICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGUuY2FuY2VsQnViYmxlID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBhY3R1YWxseSBjYWxscyB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIGlmIHlvdXIgY2FsbGJhY2sgZnVuY3Rpb24gcmV0dXJucyBmYWxzZSB0aGlzIHdpbGwgdXNlIHRoZSBqcXVlcnlcbiAgICAgKiBjb252ZW50aW9uIC0gcHJldmVudCBkZWZhdWx0IGFuZCBzdG9wIHByb3BvZ2F0aW9uIG9uIHRoZSBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9maXJlQ2FsbGJhY2soY2FsbGJhY2ssIGUsIGNvbWJvLCBzZXF1ZW5jZSkge1xuXG4gICAgICAgIC8vIGlmIHRoaXMgZXZlbnQgc2hvdWxkIG5vdCBoYXBwZW4gc3RvcCBoZXJlXG4gICAgICAgIGlmIChNb3VzZXRyYXAuc3RvcENhbGxiYWNrKGUsIGUudGFyZ2V0IHx8IGUuc3JjRWxlbWVudCwgY29tYm8sIHNlcXVlbmNlKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNhbGxiYWNrKGUsIGNvbWJvKSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIF9wcmV2ZW50RGVmYXVsdChlKTtcbiAgICAgICAgICAgIF9zdG9wUHJvcGFnYXRpb24oZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBoYW5kbGVzIGEgY2hhcmFjdGVyIGtleSBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNoYXJhY3RlclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vZGlmaWVyc1xuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2hhbmRsZUtleShjaGFyYWN0ZXIsIG1vZGlmaWVycywgZSkge1xuICAgICAgICB2YXIgY2FsbGJhY2tzID0gX2dldE1hdGNoZXMoY2hhcmFjdGVyLCBtb2RpZmllcnMsIGUpLFxuICAgICAgICAgICAgaSxcbiAgICAgICAgICAgIGRvTm90UmVzZXQgPSB7fSxcbiAgICAgICAgICAgIG1heExldmVsID0gMCxcbiAgICAgICAgICAgIHByb2Nlc3NlZFNlcXVlbmNlQ2FsbGJhY2sgPSBmYWxzZTtcblxuICAgICAgICAvLyBDYWxjdWxhdGUgdGhlIG1heExldmVsIGZvciBzZXF1ZW5jZXMgc28gd2UgY2FuIG9ubHkgZXhlY3V0ZSB0aGUgbG9uZ2VzdCBjYWxsYmFjayBzZXF1ZW5jZVxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2tzW2ldLnNlcSkge1xuICAgICAgICAgICAgICAgIG1heExldmVsID0gTWF0aC5tYXgobWF4TGV2ZWwsIGNhbGxiYWNrc1tpXS5sZXZlbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb29wIHRocm91Z2ggbWF0Y2hpbmcgY2FsbGJhY2tzIGZvciB0aGlzIGtleSBldmVudFxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2FsbGJhY2tzLmxlbmd0aDsgKytpKSB7XG5cbiAgICAgICAgICAgIC8vIGZpcmUgZm9yIGFsbCBzZXF1ZW5jZSBjYWxsYmFja3NcbiAgICAgICAgICAgIC8vIHRoaXMgaXMgYmVjYXVzZSBpZiBmb3IgZXhhbXBsZSB5b3UgaGF2ZSBtdWx0aXBsZSBzZXF1ZW5jZXNcbiAgICAgICAgICAgIC8vIGJvdW5kIHN1Y2ggYXMgXCJnIGlcIiBhbmQgXCJnIHRcIiB0aGV5IGJvdGggbmVlZCB0byBmaXJlIHRoZVxuICAgICAgICAgICAgLy8gY2FsbGJhY2sgZm9yIG1hdGNoaW5nIGcgY2F1c2Ugb3RoZXJ3aXNlIHlvdSBjYW4gb25seSBldmVyXG4gICAgICAgICAgICAvLyBtYXRjaCB0aGUgZmlyc3Qgb25lXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2tzW2ldLnNlcSkge1xuXG4gICAgICAgICAgICAgICAgLy8gb25seSBmaXJlIGNhbGxiYWNrcyBmb3IgdGhlIG1heExldmVsIHRvIHByZXZlbnRcbiAgICAgICAgICAgICAgICAvLyBzdWJzZXF1ZW5jZXMgZnJvbSBhbHNvIGZpcmluZ1xuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gZm9yIGV4YW1wbGUgJ2Egb3B0aW9uIGInIHNob3VsZCBub3QgY2F1c2UgJ29wdGlvbiBiJyB0byBmaXJlXG4gICAgICAgICAgICAgICAgLy8gZXZlbiB0aG91Z2ggJ29wdGlvbiBiJyBpcyBwYXJ0IG9mIHRoZSBvdGhlciBzZXF1ZW5jZVxuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gYW55IHNlcXVlbmNlcyB0aGF0IGRvIG5vdCBtYXRjaCBoZXJlIHdpbGwgYmUgZGlzY2FyZGVkXG4gICAgICAgICAgICAgICAgLy8gYmVsb3cgYnkgdGhlIF9yZXNldFNlcXVlbmNlcyBjYWxsXG4gICAgICAgICAgICAgICAgaWYgKGNhbGxiYWNrc1tpXS5sZXZlbCAhPSBtYXhMZXZlbCkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwcm9jZXNzZWRTZXF1ZW5jZUNhbGxiYWNrID0gdHJ1ZTtcblxuICAgICAgICAgICAgICAgIC8vIGtlZXAgYSBsaXN0IG9mIHdoaWNoIHNlcXVlbmNlcyB3ZXJlIG1hdGNoZXMgZm9yIGxhdGVyXG4gICAgICAgICAgICAgICAgZG9Ob3RSZXNldFtjYWxsYmFja3NbaV0uc2VxXSA9IDE7XG4gICAgICAgICAgICAgICAgX2ZpcmVDYWxsYmFjayhjYWxsYmFja3NbaV0uY2FsbGJhY2ssIGUsIGNhbGxiYWNrc1tpXS5jb21ibywgY2FsbGJhY2tzW2ldLnNlcSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZXJlIHdlcmUgbm8gc2VxdWVuY2UgbWF0Y2hlcyBidXQgd2UgYXJlIHN0aWxsIGhlcmVcbiAgICAgICAgICAgIC8vIHRoYXQgbWVhbnMgdGhpcyBpcyBhIHJlZ3VsYXIgbWF0Y2ggc28gd2Ugc2hvdWxkIGZpcmUgdGhhdFxuICAgICAgICAgICAgaWYgKCFwcm9jZXNzZWRTZXF1ZW5jZUNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgX2ZpcmVDYWxsYmFjayhjYWxsYmFja3NbaV0uY2FsbGJhY2ssIGUsIGNhbGxiYWNrc1tpXS5jb21ibyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB0aGUga2V5IHlvdSBwcmVzc2VkIG1hdGNoZXMgdGhlIHR5cGUgb2Ygc2VxdWVuY2Ugd2l0aG91dFxuICAgICAgICAvLyBiZWluZyBhIG1vZGlmaWVyIChpZSBcImtleXVwXCIgb3IgXCJrZXlwcmVzc1wiKSB0aGVuIHdlIHNob3VsZFxuICAgICAgICAvLyByZXNldCBhbGwgc2VxdWVuY2VzIHRoYXQgd2VyZSBub3QgbWF0Y2hlZCBieSB0aGlzIGV2ZW50XG4gICAgICAgIC8vXG4gICAgICAgIC8vIHRoaXMgaXMgc28sIGZvciBleGFtcGxlLCBpZiB5b3UgaGF2ZSB0aGUgc2VxdWVuY2UgXCJoIGEgdFwiIGFuZCB5b3VcbiAgICAgICAgLy8gdHlwZSBcImggZSBhIHIgdFwiIGl0IGRvZXMgbm90IG1hdGNoLiAgaW4gdGhpcyBjYXNlIHRoZSBcImVcIiB3aWxsXG4gICAgICAgIC8vIGNhdXNlIHRoZSBzZXF1ZW5jZSB0byByZXNldFxuICAgICAgICAvL1xuICAgICAgICAvLyBtb2RpZmllciBrZXlzIGFyZSBpZ25vcmVkIGJlY2F1c2UgeW91IGNhbiBoYXZlIGEgc2VxdWVuY2VcbiAgICAgICAgLy8gdGhhdCBjb250YWlucyBtb2RpZmllcnMgc3VjaCBhcyBcImVudGVyIGN0cmwrc3BhY2VcIiBhbmQgaW4gbW9zdFxuICAgICAgICAvLyBjYXNlcyB0aGUgbW9kaWZpZXIga2V5IHdpbGwgYmUgcHJlc3NlZCBiZWZvcmUgdGhlIG5leHQga2V5XG4gICAgICAgIC8vXG4gICAgICAgIC8vIGFsc28gaWYgeW91IGhhdmUgYSBzZXF1ZW5jZSBzdWNoIGFzIFwiY3RybCtiIGFcIiB0aGVuIHByZXNzaW5nIHRoZVxuICAgICAgICAvLyBcImJcIiBrZXkgd2lsbCB0cmlnZ2VyIGEgXCJrZXlwcmVzc1wiIGFuZCBhIFwia2V5ZG93blwiXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHRoZSBcImtleWRvd25cIiBpcyBleHBlY3RlZCB3aGVuIHRoZXJlIGlzIGEgbW9kaWZpZXIsIGJ1dCB0aGVcbiAgICAgICAgLy8gXCJrZXlwcmVzc1wiIGVuZHMgdXAgbWF0Y2hpbmcgdGhlIF9uZXh0RXhwZWN0ZWRBY3Rpb24gc2luY2UgaXQgb2NjdXJzXG4gICAgICAgIC8vIGFmdGVyIGFuZCB0aGF0IGNhdXNlcyB0aGUgc2VxdWVuY2UgdG8gcmVzZXRcbiAgICAgICAgLy9cbiAgICAgICAgLy8gd2UgaWdub3JlIGtleXByZXNzZXMgaW4gYSBzZXF1ZW5jZSB0aGF0IGRpcmVjdGx5IGZvbGxvdyBhIGtleWRvd25cbiAgICAgICAgLy8gZm9yIHRoZSBzYW1lIGNoYXJhY3RlclxuICAgICAgICB2YXIgaWdub3JlVGhpc0tleXByZXNzID0gZS50eXBlID09ICdrZXlwcmVzcycgJiYgX2lnbm9yZU5leHRLZXlwcmVzcztcbiAgICAgICAgaWYgKGUudHlwZSA9PSBfbmV4dEV4cGVjdGVkQWN0aW9uICYmICFfaXNNb2RpZmllcihjaGFyYWN0ZXIpICYmICFpZ25vcmVUaGlzS2V5cHJlc3MpIHtcbiAgICAgICAgICAgIF9yZXNldFNlcXVlbmNlcyhkb05vdFJlc2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIF9pZ25vcmVOZXh0S2V5cHJlc3MgPSBwcm9jZXNzZWRTZXF1ZW5jZUNhbGxiYWNrICYmIGUudHlwZSA9PSAna2V5ZG93bic7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogaGFuZGxlcyBhIGtleWRvd24gZXZlbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2hhbmRsZUtleUV2ZW50KGUpIHtcblxuICAgICAgICAvLyBub3JtYWxpemUgZS53aGljaCBmb3Iga2V5IGV2ZW50c1xuICAgICAgICAvLyBAc2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNDI4NTYyNy9qYXZhc2NyaXB0LWtleWNvZGUtdnMtY2hhcmNvZGUtdXR0ZXItY29uZnVzaW9uXG4gICAgICAgIGlmICh0eXBlb2YgZS53aGljaCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGUud2hpY2ggPSBlLmtleUNvZGU7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2hhcmFjdGVyID0gX2NoYXJhY3RlckZyb21FdmVudChlKTtcblxuICAgICAgICAvLyBubyBjaGFyYWN0ZXIgZm91bmQgdGhlbiBzdG9wXG4gICAgICAgIGlmICghY2hhcmFjdGVyKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBuZWVkIHRvIHVzZSA9PT0gZm9yIHRoZSBjaGFyYWN0ZXIgY2hlY2sgYmVjYXVzZSB0aGUgY2hhcmFjdGVyIGNhbiBiZSAwXG4gICAgICAgIGlmIChlLnR5cGUgPT0gJ2tleXVwJyAmJiBfaWdub3JlTmV4dEtleXVwID09PSBjaGFyYWN0ZXIpIHtcbiAgICAgICAgICAgIF9pZ25vcmVOZXh0S2V5dXAgPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIE1vdXNldHJhcC5oYW5kbGVLZXkoY2hhcmFjdGVyLCBfZXZlbnRNb2RpZmllcnMoZSksIGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGRldGVybWluZXMgaWYgdGhlIGtleWNvZGUgc3BlY2lmaWVkIGlzIGEgbW9kaWZpZXIga2V5IG9yIG5vdFxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleVxuICAgICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9pc01vZGlmaWVyKGtleSkge1xuICAgICAgICByZXR1cm4ga2V5ID09ICdzaGlmdCcgfHwga2V5ID09ICdjdHJsJyB8fCBrZXkgPT0gJ2FsdCcgfHwga2V5ID09ICdtZXRhJztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjYWxsZWQgdG8gc2V0IGEgMSBzZWNvbmQgdGltZW91dCBvbiB0aGUgc3BlY2lmaWVkIHNlcXVlbmNlXG4gICAgICpcbiAgICAgKiB0aGlzIGlzIHNvIGFmdGVyIGVhY2gga2V5IHByZXNzIGluIHRoZSBzZXF1ZW5jZSB5b3UgaGF2ZSAxIHNlY29uZFxuICAgICAqIHRvIHByZXNzIHRoZSBuZXh0IGtleSBiZWZvcmUgeW91IGhhdmUgdG8gc3RhcnQgb3ZlclxuICAgICAqXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9yZXNldFNlcXVlbmNlVGltZXIoKSB7XG4gICAgICAgIGNsZWFyVGltZW91dChfcmVzZXRUaW1lcik7XG4gICAgICAgIF9yZXNldFRpbWVyID0gc2V0VGltZW91dChfcmVzZXRTZXF1ZW5jZXMsIDEwMDApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJldmVyc2VzIHRoZSBtYXAgbG9va3VwIHNvIHRoYXQgd2UgY2FuIGxvb2sgZm9yIHNwZWNpZmljIGtleXNcbiAgICAgKiB0byBzZWUgd2hhdCBjYW4gYW5kIGNhbid0IHVzZSBrZXlwcmVzc1xuICAgICAqXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9nZXRSZXZlcnNlTWFwKCkge1xuICAgICAgICBpZiAoIV9SRVZFUlNFX01BUCkge1xuICAgICAgICAgICAgX1JFVkVSU0VfTUFQID0ge307XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gX01BUCkge1xuXG4gICAgICAgICAgICAgICAgLy8gcHVsbCBvdXQgdGhlIG51bWVyaWMga2V5cGFkIGZyb20gaGVyZSBjYXVzZSBrZXlwcmVzcyBzaG91bGRcbiAgICAgICAgICAgICAgICAvLyBiZSBhYmxlIHRvIGRldGVjdCB0aGUga2V5cyBmcm9tIHRoZSBjaGFyYWN0ZXJcbiAgICAgICAgICAgICAgICBpZiAoa2V5ID4gOTUgJiYga2V5IDwgMTEyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChfTUFQLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgX1JFVkVSU0VfTUFQW19NQVBba2V5XV0gPSBrZXk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfUkVWRVJTRV9NQVA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcGlja3MgdGhlIGJlc3QgYWN0aW9uIGJhc2VkIG9uIHRoZSBrZXkgY29tYmluYXRpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBjaGFyYWN0ZXIgZm9yIGtleVxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vZGlmaWVyc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gYWN0aW9uIHBhc3NlZCBpblxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9waWNrQmVzdEFjdGlvbihrZXksIG1vZGlmaWVycywgYWN0aW9uKSB7XG5cbiAgICAgICAgLy8gaWYgbm8gYWN0aW9uIHdhcyBwaWNrZWQgaW4gd2Ugc2hvdWxkIHRyeSB0byBwaWNrIHRoZSBvbmVcbiAgICAgICAgLy8gdGhhdCB3ZSB0aGluayB3b3VsZCB3b3JrIGJlc3QgZm9yIHRoaXMga2V5XG4gICAgICAgIGlmICghYWN0aW9uKSB7XG4gICAgICAgICAgICBhY3Rpb24gPSBfZ2V0UmV2ZXJzZU1hcCgpW2tleV0gPyAna2V5ZG93bicgOiAna2V5cHJlc3MnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbW9kaWZpZXIga2V5cyBkb24ndCB3b3JrIGFzIGV4cGVjdGVkIHdpdGgga2V5cHJlc3MsXG4gICAgICAgIC8vIHN3aXRjaCB0byBrZXlkb3duXG4gICAgICAgIGlmIChhY3Rpb24gPT0gJ2tleXByZXNzJyAmJiBtb2RpZmllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBhY3Rpb24gPSAna2V5ZG93bic7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYWN0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGJpbmRzIGEga2V5IHNlcXVlbmNlIHRvIGFuIGV2ZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29tYm8gLSBjb21ibyBzcGVjaWZpZWQgaW4gYmluZCBjYWxsXG4gICAgICogQHBhcmFtIHtBcnJheX0ga2V5c1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb25cbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2JpbmRTZXF1ZW5jZShjb21ibywga2V5cywgY2FsbGJhY2ssIGFjdGlvbikge1xuXG4gICAgICAgIC8vIHN0YXJ0IG9mZiBieSBhZGRpbmcgYSBzZXF1ZW5jZSBsZXZlbCByZWNvcmQgZm9yIHRoaXMgY29tYmluYXRpb25cbiAgICAgICAgLy8gYW5kIHNldHRpbmcgdGhlIGxldmVsIHRvIDBcbiAgICAgICAgX3NlcXVlbmNlTGV2ZWxzW2NvbWJvXSA9IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGNhbGxiYWNrIHRvIGluY3JlYXNlIHRoZSBzZXF1ZW5jZSBsZXZlbCBmb3IgdGhpcyBzZXF1ZW5jZSBhbmQgcmVzZXRcbiAgICAgICAgICogYWxsIG90aGVyIHNlcXVlbmNlcyB0aGF0IHdlcmUgYWN0aXZlXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuZXh0QWN0aW9uXG4gICAgICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9pbmNyZWFzZVNlcXVlbmNlKG5leHRBY3Rpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBfbmV4dEV4cGVjdGVkQWN0aW9uID0gbmV4dEFjdGlvbjtcbiAgICAgICAgICAgICAgICArK19zZXF1ZW5jZUxldmVsc1tjb21ib107XG4gICAgICAgICAgICAgICAgX3Jlc2V0U2VxdWVuY2VUaW1lcigpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB3cmFwcyB0aGUgc3BlY2lmaWVkIGNhbGxiYWNrIGluc2lkZSBvZiBhbm90aGVyIGZ1bmN0aW9uIGluIG9yZGVyXG4gICAgICAgICAqIHRvIHJlc2V0IGFsbCBzZXF1ZW5jZSBjb3VudGVycyBhcyBzb29uIGFzIHRoaXMgc2VxdWVuY2UgaXMgZG9uZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9jYWxsYmFja0FuZFJlc2V0KGUpIHtcbiAgICAgICAgICAgIF9maXJlQ2FsbGJhY2soY2FsbGJhY2ssIGUsIGNvbWJvKTtcblxuICAgICAgICAgICAgLy8gd2Ugc2hvdWxkIGlnbm9yZSB0aGUgbmV4dCBrZXkgdXAgaWYgdGhlIGFjdGlvbiBpcyBrZXkgZG93blxuICAgICAgICAgICAgLy8gb3Iga2V5cHJlc3MuICB0aGlzIGlzIHNvIGlmIHlvdSBmaW5pc2ggYSBzZXF1ZW5jZSBhbmRcbiAgICAgICAgICAgIC8vIHJlbGVhc2UgdGhlIGtleSB0aGUgZmluYWwga2V5IHdpbGwgbm90IHRyaWdnZXIgYSBrZXl1cFxuICAgICAgICAgICAgaWYgKGFjdGlvbiAhPT0gJ2tleXVwJykge1xuICAgICAgICAgICAgICAgIF9pZ25vcmVOZXh0S2V5dXAgPSBfY2hhcmFjdGVyRnJvbUV2ZW50KGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB3ZWlyZCByYWNlIGNvbmRpdGlvbiBpZiBhIHNlcXVlbmNlIGVuZHMgd2l0aCB0aGUga2V5XG4gICAgICAgICAgICAvLyBhbm90aGVyIHNlcXVlbmNlIGJlZ2lucyB3aXRoXG4gICAgICAgICAgICBzZXRUaW1lb3V0KF9yZXNldFNlcXVlbmNlcywgMTApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGtleXMgb25lIGF0IGEgdGltZSBhbmQgYmluZCB0aGUgYXBwcm9wcmlhdGUgY2FsbGJhY2tcbiAgICAgICAgLy8gZnVuY3Rpb24uICBmb3IgYW55IGtleSBsZWFkaW5nIHVwIHRvIHRoZSBmaW5hbCBvbmUgaXQgc2hvdWxkXG4gICAgICAgIC8vIGluY3JlYXNlIHRoZSBzZXF1ZW5jZS4gYWZ0ZXIgdGhlIGZpbmFsLCBpdCBzaG91bGQgcmVzZXQgYWxsIHNlcXVlbmNlc1xuICAgICAgICAvL1xuICAgICAgICAvLyBpZiBhbiBhY3Rpb24gaXMgc3BlY2lmaWVkIGluIHRoZSBvcmlnaW5hbCBiaW5kIGNhbGwgdGhlbiB0aGF0IHdpbGxcbiAgICAgICAgLy8gYmUgdXNlZCB0aHJvdWdob3V0LiAgb3RoZXJ3aXNlIHdlIHdpbGwgcGFzcyB0aGUgYWN0aW9uIHRoYXQgdGhlXG4gICAgICAgIC8vIG5leHQga2V5IGluIHRoZSBzZXF1ZW5jZSBzaG91bGQgbWF0Y2guICB0aGlzIGFsbG93cyBhIHNlcXVlbmNlXG4gICAgICAgIC8vIHRvIG1peCBhbmQgbWF0Y2gga2V5cHJlc3MgYW5kIGtleWRvd24gZXZlbnRzIGRlcGVuZGluZyBvbiB3aGljaFxuICAgICAgICAvLyBvbmVzIGFyZSBiZXR0ZXIgc3VpdGVkIHRvIHRoZSBrZXkgcHJvdmlkZWRcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB2YXIgaXNGaW5hbCA9IGkgKyAxID09PSBrZXlzLmxlbmd0aDtcbiAgICAgICAgICAgIHZhciB3cmFwcGVkQ2FsbGJhY2sgPSBpc0ZpbmFsID8gX2NhbGxiYWNrQW5kUmVzZXQgOiBfaW5jcmVhc2VTZXF1ZW5jZShhY3Rpb24gfHwgX2dldEtleUluZm8oa2V5c1tpICsgMV0pLmFjdGlvbik7XG4gICAgICAgICAgICBfYmluZFNpbmdsZShrZXlzW2ldLCB3cmFwcGVkQ2FsbGJhY2ssIGFjdGlvbiwgY29tYm8sIGkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udmVydHMgZnJvbSBhIHN0cmluZyBrZXkgY29tYmluYXRpb24gdG8gYW4gYXJyYXlcbiAgICAgKlxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gY29tYmluYXRpb24gbGlrZSBcImNvbW1hbmQrc2hpZnQrbFwiXG4gICAgICogQHJldHVybiB7QXJyYXl9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2tleXNGcm9tU3RyaW5nKGNvbWJpbmF0aW9uKSB7XG4gICAgICAgIGlmIChjb21iaW5hdGlvbiA9PT0gJysnKSB7XG4gICAgICAgICAgICByZXR1cm4gWycrJ107XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY29tYmluYXRpb24uc3BsaXQoJysnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGluZm8gZm9yIGEgc3BlY2lmaWMga2V5IGNvbWJpbmF0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IGNvbWJpbmF0aW9uIGtleSBjb21iaW5hdGlvbiAoXCJjb21tYW5kK3NcIiBvciBcImFcIiBvciBcIipcIilcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmc9fSBhY3Rpb25cbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9nZXRLZXlJbmZvKGNvbWJpbmF0aW9uLCBhY3Rpb24pIHtcbiAgICAgICAgdmFyIGtleXMsXG4gICAgICAgICAgICBrZXksXG4gICAgICAgICAgICBpLFxuICAgICAgICAgICAgbW9kaWZpZXJzID0gW107XG5cbiAgICAgICAgLy8gdGFrZSB0aGUga2V5cyBmcm9tIHRoaXMgcGF0dGVybiBhbmQgZmlndXJlIG91dCB3aGF0IHRoZSBhY3R1YWxcbiAgICAgICAgLy8gcGF0dGVybiBpcyBhbGwgYWJvdXRcbiAgICAgICAga2V5cyA9IF9rZXlzRnJvbVN0cmluZyhjb21iaW5hdGlvbik7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGtleSA9IGtleXNbaV07XG5cbiAgICAgICAgICAgIC8vIG5vcm1hbGl6ZSBrZXkgbmFtZXNcbiAgICAgICAgICAgIGlmIChfU1BFQ0lBTF9BTElBU0VTW2tleV0pIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBfU1BFQ0lBTF9BTElBU0VTW2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgbm90IGEga2V5cHJlc3MgZXZlbnQgdGhlbiB3ZSBzaG91bGRcbiAgICAgICAgICAgIC8vIGJlIHNtYXJ0IGFib3V0IHVzaW5nIHNoaWZ0IGtleXNcbiAgICAgICAgICAgIC8vIHRoaXMgd2lsbCBvbmx5IHdvcmsgZm9yIFVTIGtleWJvYXJkcyBob3dldmVyXG4gICAgICAgICAgICBpZiAoYWN0aW9uICYmIGFjdGlvbiAhPSAna2V5cHJlc3MnICYmIF9TSElGVF9NQVBba2V5XSkge1xuICAgICAgICAgICAgICAgIGtleSA9IF9TSElGVF9NQVBba2V5XTtcbiAgICAgICAgICAgICAgICBtb2RpZmllcnMucHVzaCgnc2hpZnQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhpcyBrZXkgaXMgYSBtb2RpZmllciB0aGVuIGFkZCBpdCB0byB0aGUgbGlzdCBvZiBtb2RpZmllcnNcbiAgICAgICAgICAgIGlmIChfaXNNb2RpZmllcihrZXkpKSB7XG4gICAgICAgICAgICAgICAgbW9kaWZpZXJzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlcGVuZGluZyBvbiB3aGF0IHRoZSBrZXkgY29tYmluYXRpb24gaXNcbiAgICAgICAgLy8gd2Ugd2lsbCB0cnkgdG8gcGljayB0aGUgYmVzdCBldmVudCBmb3IgaXRcbiAgICAgICAgYWN0aW9uID0gX3BpY2tCZXN0QWN0aW9uKGtleSwgbW9kaWZpZXJzLCBhY3Rpb24pO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgICAgIG1vZGlmaWVyczogbW9kaWZpZXJzLFxuICAgICAgICAgICAgYWN0aW9uOiBhY3Rpb25cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBiaW5kcyBhIHNpbmdsZSBrZXlib2FyZCBjb21iaW5hdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbWJpbmF0aW9uXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgKiBAcGFyYW0ge3N0cmluZz19IGFjdGlvblxuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gc2VxdWVuY2VOYW1lIC0gbmFtZSBvZiBzZXF1ZW5jZSBpZiBwYXJ0IG9mIHNlcXVlbmNlXG4gICAgICogQHBhcmFtIHtudW1iZXI9fSBsZXZlbCAtIHdoYXQgcGFydCBvZiB0aGUgc2VxdWVuY2UgdGhlIGNvbW1hbmQgaXNcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2JpbmRTaW5nbGUoY29tYmluYXRpb24sIGNhbGxiYWNrLCBhY3Rpb24sIHNlcXVlbmNlTmFtZSwgbGV2ZWwpIHtcblxuICAgICAgICAvLyBzdG9yZSBhIGRpcmVjdCBtYXBwZWQgcmVmZXJlbmNlIGZvciB1c2Ugd2l0aCBNb3VzZXRyYXAudHJpZ2dlclxuICAgICAgICBfZGlyZWN0TWFwW2NvbWJpbmF0aW9uICsgJzonICsgYWN0aW9uXSA9IGNhbGxiYWNrO1xuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSBtdWx0aXBsZSBzcGFjZXMgaW4gYSByb3cgYmVjb21lIGEgc2luZ2xlIHNwYWNlXG4gICAgICAgIGNvbWJpbmF0aW9uID0gY29tYmluYXRpb24ucmVwbGFjZSgvXFxzKy9nLCAnICcpO1xuXG4gICAgICAgIHZhciBzZXF1ZW5jZSA9IGNvbWJpbmF0aW9uLnNwbGl0KCcgJyksXG4gICAgICAgICAgICBpbmZvO1xuXG4gICAgICAgIC8vIGlmIHRoaXMgcGF0dGVybiBpcyBhIHNlcXVlbmNlIG9mIGtleXMgdGhlbiBydW4gdGhyb3VnaCB0aGlzIG1ldGhvZFxuICAgICAgICAvLyB0byByZXByb2Nlc3MgZWFjaCBwYXR0ZXJuIG9uZSBrZXkgYXQgYSB0aW1lXG4gICAgICAgIGlmIChzZXF1ZW5jZS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICBfYmluZFNlcXVlbmNlKGNvbWJpbmF0aW9uLCBzZXF1ZW5jZSwgY2FsbGJhY2ssIGFjdGlvbik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpbmZvID0gX2dldEtleUluZm8oY29tYmluYXRpb24sIGFjdGlvbik7XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIHRvIGluaXRpYWxpemUgYXJyYXkgaWYgdGhpcyBpcyB0aGUgZmlyc3QgdGltZVxuICAgICAgICAvLyBhIGNhbGxiYWNrIGlzIGFkZGVkIGZvciB0aGlzIGtleVxuICAgICAgICBfY2FsbGJhY2tzW2luZm8ua2V5XSA9IF9jYWxsYmFja3NbaW5mby5rZXldIHx8IFtdO1xuXG4gICAgICAgIC8vIHJlbW92ZSBhbiBleGlzdGluZyBtYXRjaCBpZiB0aGVyZSBpcyBvbmVcbiAgICAgICAgX2dldE1hdGNoZXMoaW5mby5rZXksIGluZm8ubW9kaWZpZXJzLCB7dHlwZTogaW5mby5hY3Rpb259LCBzZXF1ZW5jZU5hbWUsIGNvbWJpbmF0aW9uLCBsZXZlbCk7XG5cbiAgICAgICAgLy8gYWRkIHRoaXMgY2FsbCBiYWNrIHRvIHRoZSBhcnJheVxuICAgICAgICAvLyBpZiBpdCBpcyBhIHNlcXVlbmNlIHB1dCBpdCBhdCB0aGUgYmVnaW5uaW5nXG4gICAgICAgIC8vIGlmIG5vdCBwdXQgaXQgYXQgdGhlIGVuZFxuICAgICAgICAvL1xuICAgICAgICAvLyB0aGlzIGlzIGltcG9ydGFudCBiZWNhdXNlIHRoZSB3YXkgdGhlc2UgYXJlIHByb2Nlc3NlZCBleHBlY3RzXG4gICAgICAgIC8vIHRoZSBzZXF1ZW5jZSBvbmVzIHRvIGNvbWUgZmlyc3RcbiAgICAgICAgX2NhbGxiYWNrc1tpbmZvLmtleV1bc2VxdWVuY2VOYW1lID8gJ3Vuc2hpZnQnIDogJ3B1c2gnXSh7XG4gICAgICAgICAgICBjYWxsYmFjazogY2FsbGJhY2ssXG4gICAgICAgICAgICBtb2RpZmllcnM6IGluZm8ubW9kaWZpZXJzLFxuICAgICAgICAgICAgYWN0aW9uOiBpbmZvLmFjdGlvbixcbiAgICAgICAgICAgIHNlcTogc2VxdWVuY2VOYW1lLFxuICAgICAgICAgICAgbGV2ZWw6IGxldmVsLFxuICAgICAgICAgICAgY29tYm86IGNvbWJpbmF0aW9uXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGJpbmRzIG11bHRpcGxlIGNvbWJpbmF0aW9ucyB0byB0aGUgc2FtZSBjYWxsYmFja1xuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gY29tYmluYXRpb25zXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3x1bmRlZmluZWR9IGFjdGlvblxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfYmluZE11bHRpcGxlKGNvbWJpbmF0aW9ucywgY2FsbGJhY2ssIGFjdGlvbikge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvbWJpbmF0aW9ucy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgX2JpbmRTaW5nbGUoY29tYmluYXRpb25zW2ldLCBjYWxsYmFjaywgYWN0aW9uKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHN0YXJ0IVxuICAgIF9hZGRFdmVudChkb2N1bWVudCwgJ2tleXByZXNzJywgX2hhbmRsZUtleUV2ZW50KTtcbiAgICBfYWRkRXZlbnQoZG9jdW1lbnQsICdrZXlkb3duJywgX2hhbmRsZUtleUV2ZW50KTtcbiAgICBfYWRkRXZlbnQoZG9jdW1lbnQsICdrZXl1cCcsIF9oYW5kbGVLZXlFdmVudCk7XG5cbiAgICB2YXIgTW91c2V0cmFwID0ge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBiaW5kcyBhbiBldmVudCB0byBtb3VzZXRyYXBcbiAgICAgICAgICpcbiAgICAgICAgICogY2FuIGJlIGEgc2luZ2xlIGtleSwgYSBjb21iaW5hdGlvbiBvZiBrZXlzIHNlcGFyYXRlZCB3aXRoICssXG4gICAgICAgICAqIGFuIGFycmF5IG9mIGtleXMsIG9yIGEgc2VxdWVuY2Ugb2Yga2V5cyBzZXBhcmF0ZWQgYnkgc3BhY2VzXG4gICAgICAgICAqXG4gICAgICAgICAqIGJlIHN1cmUgdG8gbGlzdCB0aGUgbW9kaWZpZXIga2V5cyBmaXJzdCB0byBtYWtlIHN1cmUgdGhhdCB0aGVcbiAgICAgICAgICogY29ycmVjdCBrZXkgZW5kcyB1cCBnZXR0aW5nIGJvdW5kICh0aGUgbGFzdCBrZXkgaW4gdGhlIHBhdHRlcm4pXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfEFycmF5fSBrZXlzXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gYWN0aW9uIC0gJ2tleXByZXNzJywgJ2tleWRvd24nLCBvciAna2V5dXAnXG4gICAgICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgICAgICovXG4gICAgICAgIGJpbmQ6IGZ1bmN0aW9uKGtleXMsIGNhbGxiYWNrLCBhY3Rpb24pIHtcbiAgICAgICAgICAgIGtleXMgPSBrZXlzIGluc3RhbmNlb2YgQXJyYXkgPyBrZXlzIDogW2tleXNdO1xuICAgICAgICAgICAgX2JpbmRNdWx0aXBsZShrZXlzLCBjYWxsYmFjaywgYWN0aW9uKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB1bmJpbmRzIGFuIGV2ZW50IHRvIG1vdXNldHJhcFxuICAgICAgICAgKlxuICAgICAgICAgKiB0aGUgdW5iaW5kaW5nIHNldHMgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uIG9mIHRoZSBzcGVjaWZpZWQga2V5IGNvbWJvXG4gICAgICAgICAqIHRvIGFuIGVtcHR5IGZ1bmN0aW9uIGFuZCBkZWxldGVzIHRoZSBjb3JyZXNwb25kaW5nIGtleSBpbiB0aGVcbiAgICAgICAgICogX2RpcmVjdE1hcCBkaWN0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBUT0RPOiBhY3R1YWxseSByZW1vdmUgdGhpcyBmcm9tIHRoZSBfY2FsbGJhY2tzIGRpY3Rpb25hcnkgaW5zdGVhZFxuICAgICAgICAgKiBvZiBiaW5kaW5nIGFuIGVtcHR5IGZ1bmN0aW9uXG4gICAgICAgICAqXG4gICAgICAgICAqIHRoZSBrZXljb21ibythY3Rpb24gaGFzIHRvIGJlIGV4YWN0bHkgdGhlIHNhbWUgYXNcbiAgICAgICAgICogaXQgd2FzIGRlZmluZWQgaW4gdGhlIGJpbmQgbWV0aG9kXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfEFycmF5fSBrZXlzXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBhY3Rpb25cbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgdW5iaW5kOiBmdW5jdGlvbihrZXlzLCBhY3Rpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBNb3VzZXRyYXAuYmluZChrZXlzLCBmdW5jdGlvbigpIHt9LCBhY3Rpb24pO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB0cmlnZ2VycyBhbiBldmVudCB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gYm91bmRcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleXNcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb25cbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgdHJpZ2dlcjogZnVuY3Rpb24oa2V5cywgYWN0aW9uKSB7XG4gICAgICAgICAgICBpZiAoX2RpcmVjdE1hcFtrZXlzICsgJzonICsgYWN0aW9uXSkge1xuICAgICAgICAgICAgICAgIF9kaXJlY3RNYXBba2V5cyArICc6JyArIGFjdGlvbl0oe30sIGtleXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHJlc2V0cyB0aGUgbGlicmFyeSBiYWNrIHRvIGl0cyBpbml0aWFsIHN0YXRlLiAgdGhpcyBpcyB1c2VmdWxcbiAgICAgICAgICogaWYgeW91IHdhbnQgdG8gY2xlYXIgb3V0IHRoZSBjdXJyZW50IGtleWJvYXJkIHNob3J0Y3V0cyBhbmQgYmluZFxuICAgICAgICAgKiBuZXcgb25lcyAtIGZvciBleGFtcGxlIGlmIHlvdSBzd2l0Y2ggdG8gYW5vdGhlciBwYWdlXG4gICAgICAgICAqXG4gICAgICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgICAgICovXG4gICAgICAgIHJlc2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIF9jYWxsYmFja3MgPSB7fTtcbiAgICAgICAgICAgIF9kaXJlY3RNYXAgPSB7fTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgLyoqXG4gICAgICAgICogc2hvdWxkIHdlIHN0b3AgdGhpcyBldmVudCBiZWZvcmUgZmlyaW5nIG9mZiBjYWxsYmFja3NcbiAgICAgICAgKlxuICAgICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgICAgKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnRcbiAgICAgICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgICAgICAqL1xuICAgICAgICBzdG9wQ2FsbGJhY2s6IGZ1bmN0aW9uKGUsIGVsZW1lbnQpIHtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIGVsZW1lbnQgaGFzIHRoZSBjbGFzcyBcIm1vdXNldHJhcFwiIHRoZW4gbm8gbmVlZCB0byBzdG9wXG4gICAgICAgICAgICBpZiAoKCcgJyArIGVsZW1lbnQuY2xhc3NOYW1lICsgJyAnKS5pbmRleE9mKCcgbW91c2V0cmFwICcpID4gLTEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHN0b3AgZm9yIGlucHV0LCBzZWxlY3QsIGFuZCB0ZXh0YXJlYVxuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQudGFnTmFtZSA9PSAnSU5QVVQnIHx8IGVsZW1lbnQudGFnTmFtZSA9PSAnU0VMRUNUJyB8fCBlbGVtZW50LnRhZ05hbWUgPT0gJ1RFWFRBUkVBJyB8fCBlbGVtZW50LmlzQ29udGVudEVkaXRhYmxlO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBleHBvc2VzIF9oYW5kbGVLZXkgcHVibGljbHkgc28gaXQgY2FuIGJlIG92ZXJ3cml0dGVuIGJ5IGV4dGVuc2lvbnNcbiAgICAgICAgICovXG4gICAgICAgIGhhbmRsZUtleTogX2hhbmRsZUtleVxuICAgIH07XG5cbiAgICAvLyBleHBvc2UgbW91c2V0cmFwIHRvIHRoZSBnbG9iYWwgb2JqZWN0XG4gICAgd2luZG93Lk1vdXNldHJhcCA9IE1vdXNldHJhcDtcblxuICAgIC8vIGV4cG9zZSBtb3VzZXRyYXAgYXMgYW4gQU1EIG1vZHVsZVxuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKE1vdXNldHJhcCk7XG4gICAgfVxufSkgKHdpbmRvdywgZG9jdW1lbnQpO1xuIiwiLyohIGFuZ3VsYXJqcy1zbGlkZXIgLSB2NS44LjcgLSBcbiAoYykgUmFmYWwgWmFqYWMgPHJ6YWphY0BnbWFpbC5jb20+LCBWYWxlbnRpbiBIZXJ2aWV1IDx2YWxlbnRpbkBoZXJ2aWV1Lm1lPiwgSnVzc2kgU2Fhcml2aXJ0YSA8anVzYXNpQGdtYWlsLmNvbT4sIEFuZ2VsaW4gU2lyYnUgPGFuZ2VsaW4uc2lyYnVAZ21haWwuY29tPiAtIFxuIGh0dHBzOi8vZ2l0aHViLmNvbS9hbmd1bGFyLXNsaWRlci9hbmd1bGFyanMtc2xpZGVyIC0gXG4gMjAxNi0xMS0wOSAqL1xuLypqc2xpbnQgdW5wYXJhbTogdHJ1ZSAqL1xuLypnbG9iYWwgYW5ndWxhcjogZmFsc2UsIGNvbnNvbGU6IGZhbHNlLCBkZWZpbmUsIG1vZHVsZSAqL1xuKGZ1bmN0aW9uKHJvb3QsIGZhY3RvcnkpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgLy8gQU1ELiBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlLlxuICAgIGRlZmluZShbJ2FuZ3VsYXInXSwgZmFjdG9yeSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgICAvLyBOb2RlLiBEb2VzIG5vdCB3b3JrIHdpdGggc3RyaWN0IENvbW1vbkpTLCBidXRcbiAgICAvLyBvbmx5IENvbW1vbkpTLWxpa2UgZW52aXJvbm1lbnRzIHRoYXQgc3VwcG9ydCBtb2R1bGUuZXhwb3J0cyxcbiAgICAvLyBsaWtlIE5vZGUuXG4gICAgLy8gdG8gc3VwcG9ydCBidW5kbGVyIGxpa2UgYnJvd3NlcmlmeVxuICAgIHZhciBhbmd1bGFyT2JqID0gcmVxdWlyZSgnYW5ndWxhcicpO1xuICAgIGlmICgoIWFuZ3VsYXJPYmogfHwgIWFuZ3VsYXJPYmoubW9kdWxlKSAmJiB0eXBlb2YgYW5ndWxhciAhPSAndW5kZWZpbmVkJykge1xuICAgICAgYW5ndWxhck9iaiA9IGFuZ3VsYXI7XG4gICAgfVxuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShhbmd1bGFyT2JqKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHMgKHJvb3QgaXMgd2luZG93KVxuICAgIGZhY3Rvcnkocm9vdC5hbmd1bGFyKTtcbiAgfVxuXG59KHRoaXMsIGZ1bmN0aW9uKGFuZ3VsYXIpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuICB2YXIgbW9kdWxlID0gYW5ndWxhci5tb2R1bGUoJ3J6TW9kdWxlJywgW10pXG5cbiAgLmZhY3RvcnkoJ1J6U2xpZGVyT3B0aW9ucycsIGZ1bmN0aW9uKCkge1xuICAgIHZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgIGZsb29yOiAwLFxuICAgICAgY2VpbDogbnVsbCwgLy9kZWZhdWx0cyB0byByei1zbGlkZXItbW9kZWxcbiAgICAgIHN0ZXA6IDEsXG4gICAgICBwcmVjaXNpb246IDAsXG4gICAgICBtaW5SYW5nZTogbnVsbCxcbiAgICAgIG1heFJhbmdlOiBudWxsLFxuICAgICAgcHVzaFJhbmdlOiBmYWxzZSxcbiAgICAgIG1pbkxpbWl0OiBudWxsLFxuICAgICAgbWF4TGltaXQ6IG51bGwsXG4gICAgICBpZDogbnVsbCxcbiAgICAgIHRyYW5zbGF0ZTogbnVsbCxcbiAgICAgIGdldExlZ2VuZDogbnVsbCxcbiAgICAgIHN0ZXBzQXJyYXk6IG51bGwsXG4gICAgICBiaW5kSW5kZXhGb3JTdGVwc0FycmF5OiBmYWxzZSxcbiAgICAgIGRyYWdnYWJsZVJhbmdlOiBmYWxzZSxcbiAgICAgIGRyYWdnYWJsZVJhbmdlT25seTogZmFsc2UsXG4gICAgICBzaG93U2VsZWN0aW9uQmFyOiBmYWxzZSxcbiAgICAgIHNob3dTZWxlY3Rpb25CYXJFbmQ6IGZhbHNlLFxuICAgICAgc2hvd1NlbGVjdGlvbkJhckZyb21WYWx1ZTogbnVsbCxcbiAgICAgIGhpZGVQb2ludGVyTGFiZWxzOiBmYWxzZSxcbiAgICAgIGhpZGVMaW1pdExhYmVsczogZmFsc2UsXG4gICAgICBhdXRvSGlkZUxpbWl0TGFiZWxzOiB0cnVlLFxuICAgICAgcmVhZE9ubHk6IGZhbHNlLFxuICAgICAgZGlzYWJsZWQ6IGZhbHNlLFxuICAgICAgaW50ZXJ2YWw6IDM1MCxcbiAgICAgIHNob3dUaWNrczogZmFsc2UsXG4gICAgICBzaG93VGlja3NWYWx1ZXM6IGZhbHNlLFxuICAgICAgdGlja3NBcnJheTogbnVsbCxcbiAgICAgIHRpY2tzVG9vbHRpcDogbnVsbCxcbiAgICAgIHRpY2tzVmFsdWVzVG9vbHRpcDogbnVsbCxcbiAgICAgIHZlcnRpY2FsOiBmYWxzZSxcbiAgICAgIGdldFNlbGVjdGlvbkJhckNvbG9yOiBudWxsLFxuICAgICAgZ2V0VGlja0NvbG9yOiBudWxsLFxuICAgICAgZ2V0UG9pbnRlckNvbG9yOiBudWxsLFxuICAgICAga2V5Ym9hcmRTdXBwb3J0OiB0cnVlLFxuICAgICAgc2NhbGU6IDEsXG4gICAgICBlbmZvcmNlU3RlcDogdHJ1ZSxcbiAgICAgIGVuZm9yY2VSYW5nZTogZmFsc2UsXG4gICAgICBub1N3aXRjaGluZzogZmFsc2UsXG4gICAgICBvbmx5QmluZEhhbmRsZXM6IGZhbHNlLFxuICAgICAgb25TdGFydDogbnVsbCxcbiAgICAgIG9uQ2hhbmdlOiBudWxsLFxuICAgICAgb25FbmQ6IG51bGwsXG4gICAgICByaWdodFRvTGVmdDogZmFsc2UsXG4gICAgICBib3VuZFBvaW50ZXJMYWJlbHM6IHRydWUsXG4gICAgICBtZXJnZVJhbmdlTGFiZWxzSWZTYW1lOiBmYWxzZSxcbiAgICAgIGN1c3RvbVRlbXBsYXRlU2NvcGU6IG51bGwsXG4gICAgICBsb2dTY2FsZTogZmFsc2UsXG4gICAgICBjdXN0b21WYWx1ZVRvUG9zaXRpb246IG51bGwsXG4gICAgICBjdXN0b21Qb3NpdGlvblRvVmFsdWU6IG51bGxcbiAgICB9O1xuICAgIHZhciBnbG9iYWxPcHRpb25zID0ge307XG5cbiAgICB2YXIgZmFjdG9yeSA9IHt9O1xuICAgIC8qKlxuICAgICAqIGBvcHRpb25zKHt9KWAgYWxsb3dzIGdsb2JhbCBjb25maWd1cmF0aW9uIG9mIGFsbCBzbGlkZXJzIGluIHRoZVxuICAgICAqIGFwcGxpY2F0aW9uLlxuICAgICAqXG4gICAgICogICB2YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoICdBcHAnLCBbJ3J6TW9kdWxlJ10sIGZ1bmN0aW9uKCBSelNsaWRlck9wdGlvbnMgKSB7XG4gICAgICogICAgIC8vIHNob3cgdGlja3MgZm9yIGFsbCBzbGlkZXJzXG4gICAgICogICAgIFJ6U2xpZGVyT3B0aW9ucy5vcHRpb25zKCB7IHNob3dUaWNrczogdHJ1ZSB9ICk7XG4gICAgICogICB9KTtcbiAgICAgKi9cbiAgICBmYWN0b3J5Lm9wdGlvbnMgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgYW5ndWxhci5leHRlbmQoZ2xvYmFsT3B0aW9ucywgdmFsdWUpO1xuICAgIH07XG5cbiAgICBmYWN0b3J5LmdldE9wdGlvbnMgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICByZXR1cm4gYW5ndWxhci5leHRlbmQoe30sIGRlZmF1bHRPcHRpb25zLCBnbG9iYWxPcHRpb25zLCBvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGZhY3Rvcnk7XG4gIH0pXG5cbiAgLmZhY3RvcnkoJ3J6VGhyb3R0bGUnLCBbJyR0aW1lb3V0JywgZnVuY3Rpb24oJHRpbWVvdXQpIHtcbiAgICAvKipcbiAgICAgKiByelRocm90dGxlXG4gICAgICpcbiAgICAgKiBUYWtlbiBmcm9tIHVuZGVyc2NvcmUgcHJvamVjdFxuICAgICAqXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY1xuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3YWl0XG4gICAgICogQHBhcmFtIHtUaHJvdHRsZU9wdGlvbnN9IG9wdGlvbnNcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gICAgICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcbiAgICAgICd1c2Ugc3RyaWN0JztcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICB2YXIgZ2V0VGltZSA9IChEYXRlLm5vdyB8fCBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgfSk7XG4gICAgICB2YXIgY29udGV4dCwgYXJncywgcmVzdWx0O1xuICAgICAgdmFyIHRpbWVvdXQgPSBudWxsO1xuICAgICAgdmFyIHByZXZpb3VzID0gMDtcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHByZXZpb3VzID0gZ2V0VGltZSgpO1xuICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5vdyA9IGdldFRpbWUoKTtcbiAgICAgICAgdmFyIHJlbWFpbmluZyA9IHdhaXQgLSAobm93IC0gcHJldmlvdXMpO1xuICAgICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgICAgYXJncyA9IGFyZ3VtZW50cztcbiAgICAgICAgaWYgKHJlbWFpbmluZyA8PSAwKSB7XG4gICAgICAgICAgJHRpbWVvdXQuY2FuY2VsKHRpbWVvdXQpO1xuICAgICAgICAgIHRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgIHByZXZpb3VzID0gbm93O1xuICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkoY29udGV4dCwgYXJncyk7XG4gICAgICAgICAgY29udGV4dCA9IGFyZ3MgPSBudWxsO1xuICAgICAgICB9IGVsc2UgaWYgKCF0aW1lb3V0ICYmIG9wdGlvbnMudHJhaWxpbmcgIT09IGZhbHNlKSB7XG4gICAgICAgICAgdGltZW91dCA9ICR0aW1lb3V0KGxhdGVyLCByZW1haW5pbmcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9O1xuICAgIH1cbiAgfV0pXG5cbiAgLmZhY3RvcnkoJ1J6U2xpZGVyJywgWyckdGltZW91dCcsICckZG9jdW1lbnQnLCAnJHdpbmRvdycsICckY29tcGlsZScsICdSelNsaWRlck9wdGlvbnMnLCAncnpUaHJvdHRsZScsIGZ1bmN0aW9uKCR0aW1lb3V0LCAkZG9jdW1lbnQsICR3aW5kb3csICRjb21waWxlLCBSelNsaWRlck9wdGlvbnMsIHJ6VGhyb3R0bGUpIHtcbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvKipcbiAgICAgKiBTbGlkZXJcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bmdTY29wZX0gc2NvcGUgICAgICAgICAgICBUaGUgQW5ndWxhckpTIHNjb3BlXG4gICAgICogQHBhcmFtIHtFbGVtZW50fSBzbGlkZXJFbGVtIFRoZSBzbGlkZXIgZGlyZWN0aXZlIGVsZW1lbnQgd3JhcHBlZCBpbiBqcUxpdGVcbiAgICAgKiBAY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICB2YXIgU2xpZGVyID0gZnVuY3Rpb24oc2NvcGUsIHNsaWRlckVsZW0pIHtcbiAgICAgIC8qKlxuICAgICAgICogVGhlIHNsaWRlcidzIHNjb3BlXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge25nU2NvcGV9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuc2NvcGUgPSBzY29wZTtcblxuICAgICAgLyoqXG4gICAgICAgKiBUaGUgc2xpZGVyIGlubmVyIGxvdyB2YWx1ZSAobGlua2VkIHRvIHJ6U2xpZGVyTW9kZWwpXG4gICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICB0aGlzLmxvd1ZhbHVlID0gMDtcblxuICAgICAgLyoqXG4gICAgICAgKiBUaGUgc2xpZGVyIGlubmVyIGhpZ2ggdmFsdWUgKGxpbmtlZCB0byByelNsaWRlckhpZ2gpXG4gICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICB0aGlzLmhpZ2hWYWx1ZSA9IDA7XG5cbiAgICAgIC8qKlxuICAgICAgICogU2xpZGVyIGVsZW1lbnQgd3JhcHBlZCBpbiBqcUxpdGVcbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7anFMaXRlfVxuICAgICAgICovXG4gICAgICB0aGlzLnNsaWRlckVsZW0gPSBzbGlkZXJFbGVtO1xuXG4gICAgICAvKipcbiAgICAgICAqIFNsaWRlciB0eXBlXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge2Jvb2xlYW59IFNldCB0byB0cnVlIGZvciByYW5nZSBzbGlkZXJcbiAgICAgICAqL1xuICAgICAgdGhpcy5yYW5nZSA9IHRoaXMuc2NvcGUucnpTbGlkZXJNb2RlbCAhPT0gdW5kZWZpbmVkICYmIHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoICE9PSB1bmRlZmluZWQ7XG5cbiAgICAgIC8qKlxuICAgICAgICogVmFsdWVzIHJlY29yZGVkIHdoZW4gZmlyc3QgZHJhZ2dpbmcgdGhlIGJhclxuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuZHJhZ2dpbmcgPSB7XG4gICAgICAgIGFjdGl2ZTogZmFsc2UsXG4gICAgICAgIHZhbHVlOiAwLFxuICAgICAgICBkaWZmZXJlbmNlOiAwLFxuICAgICAgICBwb3NpdGlvbjogMCxcbiAgICAgICAgbG93TGltaXQ6IDAsXG4gICAgICAgIGhpZ2hMaW1pdDogMFxuICAgICAgfTtcblxuICAgICAgLyoqXG4gICAgICAgKiBwcm9wZXJ0eSB0aGF0IGhhbmRsZSBwb3NpdGlvbiAoZGVmYXVsdHMgdG8gbGVmdCBmb3IgaG9yaXpvbnRhbClcbiAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgKi9cbiAgICAgIHRoaXMucG9zaXRpb25Qcm9wZXJ0eSA9ICdsZWZ0JztcblxuICAgICAgLyoqXG4gICAgICAgKiBwcm9wZXJ0eSB0aGF0IGhhbmRsZSBkaW1lbnNpb24gKGRlZmF1bHRzIHRvIHdpZHRoIGZvciBob3Jpem9udGFsKVxuICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAqL1xuICAgICAgdGhpcy5kaW1lbnNpb25Qcm9wZXJ0eSA9ICd3aWR0aCc7XG5cbiAgICAgIC8qKlxuICAgICAgICogSGFsZiBvZiB0aGUgd2lkdGggb3IgaGVpZ2h0IG9mIHRoZSBzbGlkZXIgaGFuZGxlc1xuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuaGFuZGxlSGFsZkRpbSA9IDA7XG5cbiAgICAgIC8qKlxuICAgICAgICogTWF4aW11bSBwb3NpdGlvbiB0aGUgc2xpZGVyIGhhbmRsZSBjYW4gaGF2ZVxuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHRoaXMubWF4UG9zID0gMDtcblxuICAgICAgLyoqXG4gICAgICAgKiBQcmVjaXNpb25cbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICB0aGlzLnByZWNpc2lvbiA9IDA7XG5cbiAgICAgIC8qKlxuICAgICAgICogU3RlcFxuICAgICAgICpcbiAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHRoaXMuc3RlcCA9IDE7XG5cbiAgICAgIC8qKlxuICAgICAgICogVGhlIG5hbWUgb2YgdGhlIGhhbmRsZSB3ZSBhcmUgY3VycmVudGx5IHRyYWNraW5nXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAqL1xuICAgICAgdGhpcy50cmFja2luZyA9ICcnO1xuXG4gICAgICAvKipcbiAgICAgICAqIE1pbmltdW0gdmFsdWUgKGZsb29yKSBvZiB0aGUgbW9kZWxcbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICB0aGlzLm1pblZhbHVlID0gMDtcblxuICAgICAgLyoqXG4gICAgICAgKiBNYXhpbXVtIHZhbHVlIChjZWlsaW5nKSBvZiB0aGUgbW9kZWxcbiAgICAgICAqXG4gICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICB0aGlzLm1heFZhbHVlID0gMDtcblxuXG4gICAgICAvKipcbiAgICAgICAqIFRoZSBkZWx0YSBiZXR3ZWVuIG1pbiBhbmQgbWF4IHZhbHVlXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgdGhpcy52YWx1ZVJhbmdlID0gMDtcblxuXG4gICAgICAvKipcbiAgICAgICAqIElmIHNob3dUaWNrcy9zaG93VGlja3NWYWx1ZXMgb3B0aW9ucyBhcmUgbnVtYmVyLlxuICAgICAgICogSW4gdGhpcyBjYXNlLCB0aWNrcyB2YWx1ZXMgc2hvdWxkIGJlIGRpc3BsYXllZCBiZWxvdyB0aGUgc2xpZGVyLlxuICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgKi9cbiAgICAgIHRoaXMuaW50ZXJtZWRpYXRlVGlja3MgPSBmYWxzZTtcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQgdG8gdHJ1ZSBpZiBpbml0IG1ldGhvZCBhbHJlYWR5IGV4ZWN1dGVkXG4gICAgICAgKlxuICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgKi9cbiAgICAgIHRoaXMuaW5pdEhhc1J1biA9IGZhbHNlO1xuXG4gICAgICAvKipcbiAgICAgICAqIFVzZWQgdG8gY2FsbCBvblN0YXJ0IG9uIHRoZSBmaXJzdCBrZXlkb3duIGV2ZW50XG4gICAgICAgKlxuICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgKi9cbiAgICAgIHRoaXMuZmlyc3RLZXlEb3duID0gZmFsc2U7XG5cbiAgICAgIC8qKlxuICAgICAgICogSW50ZXJuYWwgZmxhZyB0byBwcmV2ZW50IHdhdGNoZXJzIHRvIGJlIGNhbGxlZCB3aGVuIHRoZSBzbGlkZXJzIHZhbHVlIGFyZSBtb2RpZmllZCBpbnRlcm5hbGx5LlxuICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgKi9cbiAgICAgIHRoaXMuaW50ZXJuYWxDaGFuZ2UgPSBmYWxzZTtcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCBmbGFnIHRvIGtlZXAgdHJhY2sgb2YgdGhlIHZpc2liaWxpdHkgb2YgY29tYm8gbGFiZWxcbiAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICovXG4gICAgICB0aGlzLmNtYkxhYmVsU2hvd24gPSBmYWxzZTtcblxuICAgICAgLyoqXG4gICAgICAgKiBJbnRlcm5hbCB2YXJpYWJsZSB0byBrZWVwIHRyYWNrIG9mIHRoZSBmb2N1cyBlbGVtZW50XG4gICAgICAgKi9cbiAgICAgIHRoaXMuY3VycmVudEZvY3VzRWxlbWVudCA9IG51bGw7XG5cbiAgICAgIC8vIFNsaWRlciBET00gZWxlbWVudHMgd3JhcHBlZCBpbiBqcUxpdGVcbiAgICAgIHRoaXMuZnVsbEJhciA9IG51bGw7IC8vIFRoZSB3aG9sZSBzbGlkZXIgYmFyXG4gICAgICB0aGlzLnNlbEJhciA9IG51bGw7IC8vIEhpZ2hsaWdodCBiZXR3ZWVuIHR3byBoYW5kbGVzXG4gICAgICB0aGlzLm1pbkggPSBudWxsOyAvLyBMZWZ0IHNsaWRlciBoYW5kbGVcbiAgICAgIHRoaXMubWF4SCA9IG51bGw7IC8vIFJpZ2h0IHNsaWRlciBoYW5kbGVcbiAgICAgIHRoaXMuZmxyTGFiID0gbnVsbDsgLy8gRmxvb3IgbGFiZWxcbiAgICAgIHRoaXMuY2VpbExhYiA9IG51bGw7IC8vIENlaWxpbmcgbGFiZWxcbiAgICAgIHRoaXMubWluTGFiID0gbnVsbDsgLy8gTGFiZWwgYWJvdmUgdGhlIGxvdyB2YWx1ZVxuICAgICAgdGhpcy5tYXhMYWIgPSBudWxsOyAvLyBMYWJlbCBhYm92ZSB0aGUgaGlnaCB2YWx1ZVxuICAgICAgdGhpcy5jbWJMYWIgPSBudWxsOyAvLyBDb21iaW5lZCBsYWJlbFxuICAgICAgdGhpcy50aWNrcyA9IG51bGw7IC8vIFRoZSB0aWNrc1xuXG4gICAgICAvLyBJbml0aWFsaXplIHNsaWRlclxuICAgICAgdGhpcy5pbml0KCk7XG4gICAgfTtcblxuICAgIC8vIEFkZCBpbnN0YW5jZSBtZXRob2RzXG4gICAgU2xpZGVyLnByb3RvdHlwZSA9IHtcblxuICAgICAgLyoqXG4gICAgICAgKiBJbml0aWFsaXplIHNsaWRlclxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIGluaXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdGhyTG93LCB0aHJIaWdoLFxuICAgICAgICAgIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIHZhciBjYWxjRGltRm4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBzZWxmLmNhbGNWaWV3RGltZW5zaW9ucygpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuYXBwbHlPcHRpb25zKCk7XG4gICAgICAgIHRoaXMuc3luY0xvd1ZhbHVlKCk7XG4gICAgICAgIGlmICh0aGlzLnJhbmdlKVxuICAgICAgICAgIHRoaXMuc3luY0hpZ2hWYWx1ZSgpO1xuICAgICAgICB0aGlzLmluaXRFbGVtSGFuZGxlcygpO1xuICAgICAgICB0aGlzLm1hbmFnZUVsZW1lbnRzU3R5bGUoKTtcbiAgICAgICAgdGhpcy5zZXREaXNhYmxlZFN0YXRlKCk7XG4gICAgICAgIHRoaXMuY2FsY1ZpZXdEaW1lbnNpb25zKCk7XG4gICAgICAgIHRoaXMuc2V0TWluQW5kTWF4KCk7XG4gICAgICAgIHRoaXMuYWRkQWNjZXNzaWJpbGl0eSgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUNlaWxMYWIoKTtcbiAgICAgICAgdGhpcy51cGRhdGVGbG9vckxhYigpO1xuICAgICAgICB0aGlzLmluaXRIYW5kbGVzKCk7XG4gICAgICAgIHRoaXMubWFuYWdlRXZlbnRzQmluZGluZ3MoKTtcblxuICAgICAgICAvLyBSZWNhbGN1bGF0ZSBzbGlkZXIgdmlldyBkaW1lbnNpb25zXG4gICAgICAgIHRoaXMuc2NvcGUuJG9uKCdyZUNhbGNWaWV3RGltZW5zaW9ucycsIGNhbGNEaW1Gbik7XG5cbiAgICAgICAgLy8gUmVjYWxjdWxhdGUgc3R1ZmYgaWYgdmlldyBwb3J0IGRpbWVuc2lvbnMgaGF2ZSBjaGFuZ2VkXG4gICAgICAgIGFuZ3VsYXIuZWxlbWVudCgkd2luZG93KS5vbigncmVzaXplJywgY2FsY0RpbUZuKTtcblxuICAgICAgICB0aGlzLmluaXRIYXNSdW4gPSB0cnVlO1xuXG4gICAgICAgIC8vIFdhdGNoIGZvciBjaGFuZ2VzIHRvIHRoZSBtb2RlbFxuICAgICAgICB0aHJMb3cgPSByelRocm90dGxlKGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHNlbGYub25Mb3dIYW5kbGVDaGFuZ2UoKTtcbiAgICAgICAgfSwgc2VsZi5vcHRpb25zLmludGVydmFsKTtcblxuICAgICAgICB0aHJIaWdoID0gcnpUaHJvdHRsZShmdW5jdGlvbigpIHtcbiAgICAgICAgICBzZWxmLm9uSGlnaEhhbmRsZUNoYW5nZSgpO1xuICAgICAgICB9LCBzZWxmLm9wdGlvbnMuaW50ZXJ2YWwpO1xuXG4gICAgICAgIHRoaXMuc2NvcGUuJG9uKCdyelNsaWRlckZvcmNlUmVuZGVyJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgc2VsZi5yZXNldExhYmVsc1ZhbHVlKCk7XG4gICAgICAgICAgdGhyTG93KCk7XG4gICAgICAgICAgaWYgKHNlbGYucmFuZ2UpIHtcbiAgICAgICAgICAgIHRockhpZ2goKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2VsZi5yZXNldFNsaWRlcigpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBXYXRjaGVycyAob3JkZXIgaXMgaW1wb3J0YW50IGJlY2F1c2UgaW4gY2FzZSBvZiBzaW11bHRhbmVvdXMgY2hhbmdlLFxuICAgICAgICAvLyB3YXRjaGVycyB3aWxsIGJlIGNhbGxlZCBpbiB0aGUgc2FtZSBvcmRlcilcbiAgICAgICAgdGhpcy5zY29wZS4kd2F0Y2goJ3J6U2xpZGVyT3B0aW9ucygpJywgZnVuY3Rpb24obmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgICAgaWYgKG5ld1ZhbHVlID09PSBvbGRWYWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICBzZWxmLmFwcGx5T3B0aW9ucygpOyAvLyBuZWVkIHRvIGJlIGNhbGxlZCBiZWZvcmUgc3luY2hyb25pemluZyB0aGUgdmFsdWVzXG4gICAgICAgICAgc2VsZi5zeW5jTG93VmFsdWUoKTtcbiAgICAgICAgICBpZiAoc2VsZi5yYW5nZSlcbiAgICAgICAgICAgIHNlbGYuc3luY0hpZ2hWYWx1ZSgpO1xuICAgICAgICAgIHNlbGYucmVzZXRTbGlkZXIoKTtcbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgdGhpcy5zY29wZS4kd2F0Y2goJ3J6U2xpZGVyTW9kZWwnLCBmdW5jdGlvbihuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcbiAgICAgICAgICBpZiAoc2VsZi5pbnRlcm5hbENoYW5nZSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICBpZiAobmV3VmFsdWUgPT09IG9sZFZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIHRockxvdygpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnNjb3BlLiR3YXRjaCgncnpTbGlkZXJIaWdoJywgZnVuY3Rpb24obmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgICAgaWYgKHNlbGYuaW50ZXJuYWxDaGFuZ2UpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgaWYgKG5ld1ZhbHVlID09PSBvbGRWYWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICBpZiAobmV3VmFsdWUgIT0gbnVsbClcbiAgICAgICAgICAgIHRockhpZ2goKTtcbiAgICAgICAgICBpZiAoc2VsZi5yYW5nZSAmJiBuZXdWYWx1ZSA9PSBudWxsIHx8ICFzZWxmLnJhbmdlICYmIG5ld1ZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgIHNlbGYuYXBwbHlPcHRpb25zKCk7XG4gICAgICAgICAgICBzZWxmLnJlc2V0U2xpZGVyKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICBzZWxmLnVuYmluZEV2ZW50cygpO1xuICAgICAgICAgIGFuZ3VsYXIuZWxlbWVudCgkd2luZG93KS5vZmYoJ3Jlc2l6ZScsIGNhbGNEaW1Gbik7XG4gICAgICAgICAgc2VsZi5jdXJyZW50Rm9jdXNFbGVtZW50ID0gbnVsbDtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICBmaW5kU3RlcEluZGV4OiBmdW5jdGlvbihtb2RlbFZhbHVlKSB7XG4gICAgICAgIHZhciBpbmRleCA9IDA7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5vcHRpb25zLnN0ZXBzQXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgc3RlcCA9IHRoaXMub3B0aW9ucy5zdGVwc0FycmF5W2ldO1xuICAgICAgICAgIGlmIChzdGVwID09PSBtb2RlbFZhbHVlKSB7XG4gICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAoYW5ndWxhci5pc0RhdGUoc3RlcCkpIHtcbiAgICAgICAgICAgIGlmIChzdGVwLmdldFRpbWUoKSA9PT0gbW9kZWxWYWx1ZS5nZXRUaW1lKCkpIHtcbiAgICAgICAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSBpZiAoYW5ndWxhci5pc09iamVjdChzdGVwKSkge1xuICAgICAgICAgICAgaWYgKGFuZ3VsYXIuaXNEYXRlKHN0ZXAudmFsdWUpICYmIHN0ZXAudmFsdWUuZ2V0VGltZSgpID09PSBtb2RlbFZhbHVlLmdldFRpbWUoKSB8fCBzdGVwLnZhbHVlID09PSBtb2RlbFZhbHVlKSB7XG4gICAgICAgICAgICAgIGluZGV4ID0gaTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbmRleDtcbiAgICAgIH0sXG5cbiAgICAgIHN5bmNMb3dWYWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc3RlcHNBcnJheSkge1xuICAgICAgICAgIGlmICghdGhpcy5vcHRpb25zLmJpbmRJbmRleEZvclN0ZXBzQXJyYXkpXG4gICAgICAgICAgICB0aGlzLmxvd1ZhbHVlID0gdGhpcy5maW5kU3RlcEluZGV4KHRoaXMuc2NvcGUucnpTbGlkZXJNb2RlbCk7XG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5sb3dWYWx1ZSA9IHRoaXMuc2NvcGUucnpTbGlkZXJNb2RlbFxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aGlzLmxvd1ZhbHVlID0gdGhpcy5zY29wZS5yelNsaWRlck1vZGVsO1xuICAgICAgfSxcblxuICAgICAgc3luY0hpZ2hWYWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc3RlcHNBcnJheSkge1xuICAgICAgICAgIGlmICghdGhpcy5vcHRpb25zLmJpbmRJbmRleEZvclN0ZXBzQXJyYXkpXG4gICAgICAgICAgICB0aGlzLmhpZ2hWYWx1ZSA9IHRoaXMuZmluZFN0ZXBJbmRleCh0aGlzLnNjb3BlLnJ6U2xpZGVySGlnaCk7XG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5oaWdoVmFsdWUgPSB0aGlzLnNjb3BlLnJ6U2xpZGVySGlnaFxuICAgICAgICB9XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aGlzLmhpZ2hWYWx1ZSA9IHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoO1xuICAgICAgfSxcblxuICAgICAgZ2V0U3RlcFZhbHVlOiBmdW5jdGlvbihzbGlkZXJWYWx1ZSkge1xuICAgICAgICB2YXIgc3RlcCA9IHRoaXMub3B0aW9ucy5zdGVwc0FycmF5W3NsaWRlclZhbHVlXTtcbiAgICAgICAgaWYgKGFuZ3VsYXIuaXNEYXRlKHN0ZXApKVxuICAgICAgICAgIHJldHVybiBzdGVwO1xuICAgICAgICBpZiAoYW5ndWxhci5pc09iamVjdChzdGVwKSlcbiAgICAgICAgICByZXR1cm4gc3RlcC52YWx1ZTtcbiAgICAgICAgcmV0dXJuIHN0ZXA7XG4gICAgICB9LFxuXG4gICAgICBhcHBseUxvd1ZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdGVwc0FycmF5KSB7XG4gICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYmluZEluZGV4Rm9yU3RlcHNBcnJheSlcbiAgICAgICAgICAgIHRoaXMuc2NvcGUucnpTbGlkZXJNb2RlbCA9IHRoaXMuZ2V0U3RlcFZhbHVlKHRoaXMubG93VmFsdWUpO1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuc2NvcGUucnpTbGlkZXJNb2RlbCA9IHRoaXMubG93VmFsdWVcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhpcy5zY29wZS5yelNsaWRlck1vZGVsID0gdGhpcy5sb3dWYWx1ZTtcbiAgICAgIH0sXG5cbiAgICAgIGFwcGx5SGlnaFZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdGVwc0FycmF5KSB7XG4gICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYmluZEluZGV4Rm9yU3RlcHNBcnJheSlcbiAgICAgICAgICAgIHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoID0gdGhpcy5nZXRTdGVwVmFsdWUodGhpcy5oaWdoVmFsdWUpO1xuICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoID0gdGhpcy5oaWdoVmFsdWVcbiAgICAgICAgfVxuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhpcy5zY29wZS5yelNsaWRlckhpZ2ggPSB0aGlzLmhpZ2hWYWx1ZTtcbiAgICAgIH0sXG5cbiAgICAgIC8qXG4gICAgICAgKiBSZWZsb3cgdGhlIHNsaWRlciB3aGVuIHRoZSBsb3cgaGFuZGxlIGNoYW5nZXMgKGNhbGxlZCB3aXRoIHRocm90dGxlKVxuICAgICAgICovXG4gICAgICBvbkxvd0hhbmRsZUNoYW5nZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc3luY0xvd1ZhbHVlKCk7XG4gICAgICAgIGlmICh0aGlzLnJhbmdlKVxuICAgICAgICAgIHRoaXMuc3luY0hpZ2hWYWx1ZSgpO1xuICAgICAgICB0aGlzLnNldE1pbkFuZE1heCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUxvd0hhbmRsZSh0aGlzLnZhbHVlVG9Qb3NpdGlvbih0aGlzLmxvd1ZhbHVlKSk7XG4gICAgICAgIHRoaXMudXBkYXRlU2VsZWN0aW9uQmFyKCk7XG4gICAgICAgIHRoaXMudXBkYXRlVGlja3NTY2FsZSgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUFyaWFBdHRyaWJ1dGVzKCk7XG4gICAgICAgIGlmICh0aGlzLnJhbmdlKSB7XG4gICAgICAgICAgdGhpcy51cGRhdGVDbWJMYWJlbCgpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKlxuICAgICAgICogUmVmbG93IHRoZSBzbGlkZXIgd2hlbiB0aGUgaGlnaCBoYW5kbGUgY2hhbmdlcyAoY2FsbGVkIHdpdGggdGhyb3R0bGUpXG4gICAgICAgKi9cbiAgICAgIG9uSGlnaEhhbmRsZUNoYW5nZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc3luY0xvd1ZhbHVlKCk7XG4gICAgICAgIHRoaXMuc3luY0hpZ2hWYWx1ZSgpO1xuICAgICAgICB0aGlzLnNldE1pbkFuZE1heCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUhpZ2hIYW5kbGUodGhpcy52YWx1ZVRvUG9zaXRpb24odGhpcy5oaWdoVmFsdWUpKTtcbiAgICAgICAgdGhpcy51cGRhdGVTZWxlY3Rpb25CYXIoKTtcbiAgICAgICAgdGhpcy51cGRhdGVUaWNrc1NjYWxlKCk7XG4gICAgICAgIHRoaXMudXBkYXRlQ21iTGFiZWwoKTtcbiAgICAgICAgdGhpcy51cGRhdGVBcmlhQXR0cmlidXRlcygpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZWFkIHRoZSB1c2VyIG9wdGlvbnMgYW5kIGFwcGx5IHRoZW0gdG8gdGhlIHNsaWRlciBtb2RlbFxuICAgICAgICovXG4gICAgICBhcHBseU9wdGlvbnM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc2xpZGVyT3B0aW9ucztcbiAgICAgICAgaWYgKHRoaXMuc2NvcGUucnpTbGlkZXJPcHRpb25zKVxuICAgICAgICAgIHNsaWRlck9wdGlvbnMgPSB0aGlzLnNjb3BlLnJ6U2xpZGVyT3B0aW9ucygpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgc2xpZGVyT3B0aW9ucyA9IHt9O1xuXG4gICAgICAgIHRoaXMub3B0aW9ucyA9IFJ6U2xpZGVyT3B0aW9ucy5nZXRPcHRpb25zKHNsaWRlck9wdGlvbnMpO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc3RlcCA8PSAwKVxuICAgICAgICAgIHRoaXMub3B0aW9ucy5zdGVwID0gMTtcblxuICAgICAgICB0aGlzLnJhbmdlID0gdGhpcy5zY29wZS5yelNsaWRlck1vZGVsICE9PSB1bmRlZmluZWQgJiYgdGhpcy5zY29wZS5yelNsaWRlckhpZ2ggIT09IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5vcHRpb25zLmRyYWdnYWJsZVJhbmdlID0gdGhpcy5yYW5nZSAmJiB0aGlzLm9wdGlvbnMuZHJhZ2dhYmxlUmFuZ2U7XG4gICAgICAgIHRoaXMub3B0aW9ucy5kcmFnZ2FibGVSYW5nZU9ubHkgPSB0aGlzLnJhbmdlICYmIHRoaXMub3B0aW9ucy5kcmFnZ2FibGVSYW5nZU9ubHk7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZHJhZ2dhYmxlUmFuZ2VPbmx5KSB7XG4gICAgICAgICAgdGhpcy5vcHRpb25zLmRyYWdnYWJsZVJhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMub3B0aW9ucy5zaG93VGlja3MgPSB0aGlzLm9wdGlvbnMuc2hvd1RpY2tzIHx8IHRoaXMub3B0aW9ucy5zaG93VGlja3NWYWx1ZXMgfHwgISF0aGlzLm9wdGlvbnMudGlja3NBcnJheTtcbiAgICAgICAgdGhpcy5zY29wZS5zaG93VGlja3MgPSB0aGlzLm9wdGlvbnMuc2hvd1RpY2tzOyAvL3Njb3BlIGlzIHVzZWQgaW4gdGhlIHRlbXBsYXRlXG4gICAgICAgIGlmIChhbmd1bGFyLmlzTnVtYmVyKHRoaXMub3B0aW9ucy5zaG93VGlja3MpIHx8IHRoaXMub3B0aW9ucy50aWNrc0FycmF5KVxuICAgICAgICAgIHRoaXMuaW50ZXJtZWRpYXRlVGlja3MgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMub3B0aW9ucy5zaG93U2VsZWN0aW9uQmFyID0gdGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXIgfHwgdGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXJFbmRcbiAgICAgICAgICB8fCB0aGlzLm9wdGlvbnMuc2hvd1NlbGVjdGlvbkJhckZyb21WYWx1ZSAhPT0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnN0ZXBzQXJyYXkpIHtcbiAgICAgICAgICB0aGlzLnBhcnNlU3RlcHNBcnJheSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMudHJhbnNsYXRlKVxuICAgICAgICAgICAgdGhpcy5jdXN0b21UckZuID0gdGhpcy5vcHRpb25zLnRyYW5zbGF0ZTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLmN1c3RvbVRyRm4gPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICB0aGlzLmdldExlZ2VuZCA9IHRoaXMub3B0aW9ucy5nZXRMZWdlbmQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnZlcnRpY2FsKSB7XG4gICAgICAgICAgdGhpcy5wb3NpdGlvblByb3BlcnR5ID0gJ2JvdHRvbSc7XG4gICAgICAgICAgdGhpcy5kaW1lbnNpb25Qcm9wZXJ0eSA9ICdoZWlnaHQnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5jdXN0b21UZW1wbGF0ZVNjb3BlKVxuICAgICAgICAgIHRoaXMuc2NvcGUuY3VzdG9tID0gdGhpcy5vcHRpb25zLmN1c3RvbVRlbXBsYXRlU2NvcGU7XG4gICAgICB9LFxuXG4gICAgICBwYXJzZVN0ZXBzQXJyYXk6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLm9wdGlvbnMuZmxvb3IgPSAwO1xuICAgICAgICB0aGlzLm9wdGlvbnMuY2VpbCA9IHRoaXMub3B0aW9ucy5zdGVwc0FycmF5Lmxlbmd0aCAtIDE7XG4gICAgICAgIHRoaXMub3B0aW9ucy5zdGVwID0gMTtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnRyYW5zbGF0ZSkge1xuICAgICAgICAgIHRoaXMuY3VzdG9tVHJGbiA9IHRoaXMub3B0aW9ucy50cmFuc2xhdGU7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgdGhpcy5jdXN0b21UckZuID0gZnVuY3Rpb24obW9kZWxWYWx1ZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5iaW5kSW5kZXhGb3JTdGVwc0FycmF5KVxuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRTdGVwVmFsdWUobW9kZWxWYWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gbW9kZWxWYWx1ZTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5nZXRMZWdlbmQgPSBmdW5jdGlvbihpbmRleCkge1xuICAgICAgICAgIHZhciBzdGVwID0gdGhpcy5vcHRpb25zLnN0ZXBzQXJyYXlbaW5kZXhdO1xuICAgICAgICAgIGlmIChhbmd1bGFyLmlzT2JqZWN0KHN0ZXApKVxuICAgICAgICAgICAgcmV0dXJuIHN0ZXAubGVnZW5kO1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9O1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZXNldHMgc2xpZGVyXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgcmVzZXRTbGlkZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLm1hbmFnZUVsZW1lbnRzU3R5bGUoKTtcbiAgICAgICAgdGhpcy5hZGRBY2Nlc3NpYmlsaXR5KCk7XG4gICAgICAgIHRoaXMuc2V0TWluQW5kTWF4KCk7XG4gICAgICAgIHRoaXMudXBkYXRlQ2VpbExhYigpO1xuICAgICAgICB0aGlzLnVwZGF0ZUZsb29yTGFiKCk7XG4gICAgICAgIHRoaXMudW5iaW5kRXZlbnRzKCk7XG4gICAgICAgIHRoaXMubWFuYWdlRXZlbnRzQmluZGluZ3MoKTtcbiAgICAgICAgdGhpcy5zZXREaXNhYmxlZFN0YXRlKCk7XG4gICAgICAgIHRoaXMuY2FsY1ZpZXdEaW1lbnNpb25zKCk7XG4gICAgICAgIHRoaXMucmVmb2N1c1BvaW50ZXJJZk5lZWRlZCgpO1xuICAgICAgfSxcblxuICAgICAgcmVmb2N1c1BvaW50ZXJJZk5lZWRlZDogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLmN1cnJlbnRGb2N1c0VsZW1lbnQpIHtcbiAgICAgICAgICB0aGlzLm9uUG9pbnRlckZvY3VzKHRoaXMuY3VycmVudEZvY3VzRWxlbWVudC5wb2ludGVyLCB0aGlzLmN1cnJlbnRGb2N1c0VsZW1lbnQucmVmKTtcbiAgICAgICAgICB0aGlzLmZvY3VzRWxlbWVudCh0aGlzLmN1cnJlbnRGb2N1c0VsZW1lbnQucG9pbnRlcilcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQgdGhlIHNsaWRlciBjaGlsZHJlbiB0byB2YXJpYWJsZXMgZm9yIGVhc3kgYWNjZXNzXG4gICAgICAgKlxuICAgICAgICogUnVuIG9ubHkgb25jZSBkdXJpbmcgaW5pdGlhbGl6YXRpb25cbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICBpbml0RWxlbUhhbmRsZXM6IGZ1bmN0aW9uKCkge1xuICAgICAgICAvLyBBc3NpZ24gYWxsIHNsaWRlciBlbGVtZW50cyB0byBvYmplY3QgcHJvcGVydGllcyBmb3IgZWFzeSBhY2Nlc3NcbiAgICAgICAgYW5ndWxhci5mb3JFYWNoKHRoaXMuc2xpZGVyRWxlbS5jaGlsZHJlbigpLCBmdW5jdGlvbihlbGVtLCBpbmRleCkge1xuICAgICAgICAgIHZhciBqRWxlbSA9IGFuZ3VsYXIuZWxlbWVudChlbGVtKTtcblxuICAgICAgICAgIHN3aXRjaCAoaW5kZXgpIHtcbiAgICAgICAgICAgIGNhc2UgMDpcbiAgICAgICAgICAgICAgdGhpcy5mdWxsQmFyID0gakVsZW07XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICB0aGlzLnNlbEJhciA9IGpFbGVtO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgdGhpcy5taW5IID0gakVsZW07XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgICB0aGlzLm1heEggPSBqRWxlbTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgICAgIHRoaXMuZmxyTGFiID0gakVsZW07XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA1OlxuICAgICAgICAgICAgICB0aGlzLmNlaWxMYWIgPSBqRWxlbTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDY6XG4gICAgICAgICAgICAgIHRoaXMubWluTGFiID0gakVsZW07XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSA3OlxuICAgICAgICAgICAgICB0aGlzLm1heExhYiA9IGpFbGVtO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgODpcbiAgICAgICAgICAgICAgdGhpcy5jbWJMYWIgPSBqRWxlbTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIDk6XG4gICAgICAgICAgICAgIHRoaXMudGlja3MgPSBqRWxlbTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuXG4gICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgIC8vIEluaXRpYWxpemUgcG9zaXRpb24gY2FjaGUgcHJvcGVydGllc1xuICAgICAgICB0aGlzLnNlbEJhci5yenNwID0gMDtcbiAgICAgICAgdGhpcy5taW5ILnJ6c3AgPSAwO1xuICAgICAgICB0aGlzLm1heEgucnpzcCA9IDA7XG4gICAgICAgIHRoaXMuZmxyTGFiLnJ6c3AgPSAwO1xuICAgICAgICB0aGlzLmNlaWxMYWIucnpzcCA9IDA7XG4gICAgICAgIHRoaXMubWluTGFiLnJ6c3AgPSAwO1xuICAgICAgICB0aGlzLm1heExhYi5yenNwID0gMDtcbiAgICAgICAgdGhpcy5jbWJMYWIucnpzcCA9IDA7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFVwZGF0ZSBlYWNoIGVsZW1lbnRzIHN0eWxlIGJhc2VkIG9uIG9wdGlvbnNcbiAgICAgICAqL1xuICAgICAgbWFuYWdlRWxlbWVudHNTdHlsZTogZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgaWYgKCF0aGlzLnJhbmdlKVxuICAgICAgICAgIHRoaXMubWF4SC5jc3MoJ2Rpc3BsYXknLCAnbm9uZScpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhpcy5tYXhILmNzcygnZGlzcGxheScsICcnKTtcblxuXG4gICAgICAgIHRoaXMuYWx3YXlzSGlkZSh0aGlzLmZsckxhYiwgdGhpcy5vcHRpb25zLnNob3dUaWNrc1ZhbHVlcyB8fCB0aGlzLm9wdGlvbnMuaGlkZUxpbWl0TGFiZWxzKTtcbiAgICAgICAgdGhpcy5hbHdheXNIaWRlKHRoaXMuY2VpbExhYiwgdGhpcy5vcHRpb25zLnNob3dUaWNrc1ZhbHVlcyB8fCB0aGlzLm9wdGlvbnMuaGlkZUxpbWl0TGFiZWxzKTtcblxuICAgICAgICB2YXIgaGlkZUxhYmVsc0ZvclRpY2tzID0gdGhpcy5vcHRpb25zLnNob3dUaWNrc1ZhbHVlcyAmJiAhdGhpcy5pbnRlcm1lZGlhdGVUaWNrcztcbiAgICAgICAgdGhpcy5hbHdheXNIaWRlKHRoaXMubWluTGFiLCBoaWRlTGFiZWxzRm9yVGlja3MgfHwgdGhpcy5vcHRpb25zLmhpZGVQb2ludGVyTGFiZWxzKTtcbiAgICAgICAgdGhpcy5hbHdheXNIaWRlKHRoaXMubWF4TGFiLCBoaWRlTGFiZWxzRm9yVGlja3MgfHwgIXRoaXMucmFuZ2UgfHwgdGhpcy5vcHRpb25zLmhpZGVQb2ludGVyTGFiZWxzKTtcbiAgICAgICAgdGhpcy5hbHdheXNIaWRlKHRoaXMuY21iTGFiLCBoaWRlTGFiZWxzRm9yVGlja3MgfHwgIXRoaXMucmFuZ2UgfHwgdGhpcy5vcHRpb25zLmhpZGVQb2ludGVyTGFiZWxzKTtcbiAgICAgICAgdGhpcy5hbHdheXNIaWRlKHRoaXMuc2VsQmFyLCAhdGhpcy5yYW5nZSAmJiAhdGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXIpO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMudmVydGljYWwpXG4gICAgICAgICAgdGhpcy5zbGlkZXJFbGVtLmFkZENsYXNzKCdyei12ZXJ0aWNhbCcpO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZHJhZ2dhYmxlUmFuZ2UpXG4gICAgICAgICAgdGhpcy5zZWxCYXIuYWRkQ2xhc3MoJ3J6LWRyYWdnYWJsZScpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhpcy5zZWxCYXIucmVtb3ZlQ2xhc3MoJ3J6LWRyYWdnYWJsZScpO1xuXG4gICAgICAgIGlmICh0aGlzLmludGVybWVkaWF0ZVRpY2tzICYmIHRoaXMub3B0aW9ucy5zaG93VGlja3NWYWx1ZXMpXG4gICAgICAgICAgdGhpcy50aWNrcy5hZGRDbGFzcygncnotdGlja3MtdmFsdWVzLXVuZGVyJyk7XG4gICAgICB9LFxuXG4gICAgICBhbHdheXNIaWRlOiBmdW5jdGlvbihlbCwgaGlkZSkge1xuICAgICAgICBlbC5yekFsd2F5c0hpZGUgPSBoaWRlO1xuICAgICAgICBpZiAoaGlkZSlcbiAgICAgICAgICB0aGlzLmhpZGVFbChlbCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aGlzLnNob3dFbChlbClcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogTWFuYWdlIHRoZSBldmVudHMgYmluZGluZ3MgYmFzZWQgb24gcmVhZE9ubHkgYW5kIGRpc2FibGVkIG9wdGlvbnNcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICBtYW5hZ2VFdmVudHNCaW5kaW5nczogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZGlzYWJsZWQgfHwgdGhpcy5vcHRpb25zLnJlYWRPbmx5KVxuICAgICAgICAgIHRoaXMudW5iaW5kRXZlbnRzKCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICB0aGlzLmJpbmRFdmVudHMoKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogU2V0IHRoZSBkaXNhYmxlZCBzdGF0ZSBiYXNlZCBvbiByelNsaWRlckRpc2FibGVkXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgc2V0RGlzYWJsZWRTdGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZGlzYWJsZWQpIHtcbiAgICAgICAgICB0aGlzLnNsaWRlckVsZW0uYXR0cignZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnNsaWRlckVsZW0uYXR0cignZGlzYWJsZWQnLCBudWxsKTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZXNldCBsYWJlbCB2YWx1ZXNcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJuIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIHJlc2V0TGFiZWxzVmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLm1pbkxhYi5yenN2ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLm1heExhYi5yenN2ID0gdW5kZWZpbmVkO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBJbml0aWFsaXplIHNsaWRlciBoYW5kbGVzIHBvc2l0aW9ucyBhbmQgbGFiZWxzXG4gICAgICAgKlxuICAgICAgICogUnVuIG9ubHkgb25jZSBkdXJpbmcgaW5pdGlhbGl6YXRpb24gYW5kIGV2ZXJ5IHRpbWUgdmlldyBwb3J0IGNoYW5nZXMgc2l6ZVxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIGluaXRIYW5kbGVzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy51cGRhdGVMb3dIYW5kbGUodGhpcy52YWx1ZVRvUG9zaXRpb24odGhpcy5sb3dWYWx1ZSkpO1xuXG4gICAgICAgIC8qXG4gICAgICAgICB0aGUgb3JkZXIgaGVyZSBpcyBpbXBvcnRhbnQgc2luY2UgdGhlIHNlbGVjdGlvbiBiYXIgc2hvdWxkIGJlXG4gICAgICAgICB1cGRhdGVkIGFmdGVyIHRoZSBoaWdoIGhhbmRsZSBidXQgYmVmb3JlIHRoZSBjb21iaW5lZCBsYWJlbFxuICAgICAgICAgKi9cbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpXG4gICAgICAgICAgdGhpcy51cGRhdGVIaWdoSGFuZGxlKHRoaXMudmFsdWVUb1Bvc2l0aW9uKHRoaXMuaGlnaFZhbHVlKSk7XG4gICAgICAgIHRoaXMudXBkYXRlU2VsZWN0aW9uQmFyKCk7XG4gICAgICAgIGlmICh0aGlzLnJhbmdlKVxuICAgICAgICAgIHRoaXMudXBkYXRlQ21iTGFiZWwoKTtcblxuICAgICAgICB0aGlzLnVwZGF0ZVRpY2tzU2NhbGUoKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVHJhbnNsYXRlIHZhbHVlIHRvIGh1bWFuIHJlYWRhYmxlIGZvcm1hdFxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gdmFsdWVcbiAgICAgICAqIEBwYXJhbSB7anFMaXRlfSBsYWJlbFxuICAgICAgICogQHBhcmFtIHtTdHJpbmd9IHdoaWNoXG4gICAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFt1c2VDdXN0b21Ucl1cbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIHRyYW5zbGF0ZUZuOiBmdW5jdGlvbih2YWx1ZSwgbGFiZWwsIHdoaWNoLCB1c2VDdXN0b21Ucikge1xuICAgICAgICB1c2VDdXN0b21UciA9IHVzZUN1c3RvbVRyID09PSB1bmRlZmluZWQgPyB0cnVlIDogdXNlQ3VzdG9tVHI7XG5cbiAgICAgICAgdmFyIHZhbFN0ciA9ICcnLFxuICAgICAgICAgIGdldERpbWVuc2lvbiA9IGZhbHNlLFxuICAgICAgICAgIG5vTGFiZWxJbmplY3Rpb24gPSBsYWJlbC5oYXNDbGFzcygnbm8tbGFiZWwtaW5qZWN0aW9uJyk7XG5cbiAgICAgICAgaWYgKHVzZUN1c3RvbVRyKSB7XG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdGVwc0FycmF5ICYmICF0aGlzLm9wdGlvbnMuYmluZEluZGV4Rm9yU3RlcHNBcnJheSlcbiAgICAgICAgICAgIHZhbHVlID0gdGhpcy5nZXRTdGVwVmFsdWUodmFsdWUpO1xuICAgICAgICAgIHZhbFN0ciA9IFN0cmluZyh0aGlzLmN1c3RvbVRyRm4odmFsdWUsIHRoaXMub3B0aW9ucy5pZCwgd2hpY2gpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICB2YWxTdHIgPSBTdHJpbmcodmFsdWUpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGFiZWwucnpzdiA9PT0gdW5kZWZpbmVkIHx8IGxhYmVsLnJ6c3YubGVuZ3RoICE9PSB2YWxTdHIubGVuZ3RoIHx8IChsYWJlbC5yenN2Lmxlbmd0aCA+IDAgJiYgbGFiZWwucnpzZCA9PT0gMCkpIHtcbiAgICAgICAgICBnZXREaW1lbnNpb24gPSB0cnVlO1xuICAgICAgICAgIGxhYmVsLnJ6c3YgPSB2YWxTdHI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW5vTGFiZWxJbmplY3Rpb24pIHtcbiAgICAgICAgICBsYWJlbC5odG1sKHZhbFN0cik7XG4gICAgICAgIH1cbiAgICAgICAgO1xuXG4gICAgICAgIHRoaXMuc2NvcGVbd2hpY2ggKyAnTGFiZWwnXSA9IHZhbFN0cjtcblxuICAgICAgICAvLyBVcGRhdGUgd2lkdGggb25seSB3aGVuIGxlbmd0aCBvZiB0aGUgbGFiZWwgaGF2ZSBjaGFuZ2VkXG4gICAgICAgIGlmIChnZXREaW1lbnNpb24pIHtcbiAgICAgICAgICB0aGlzLmdldERpbWVuc2lvbihsYWJlbCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogU2V0IG1heGltdW0gYW5kIG1pbmltdW0gdmFsdWVzIGZvciB0aGUgc2xpZGVyIGFuZCBlbnN1cmUgdGhlIG1vZGVsIGFuZCBoaWdoXG4gICAgICAgKiB2YWx1ZSBtYXRjaCB0aGVzZSBsaW1pdHNcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIHNldE1pbkFuZE1heDogZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdGhpcy5zdGVwID0gK3RoaXMub3B0aW9ucy5zdGVwO1xuICAgICAgICB0aGlzLnByZWNpc2lvbiA9ICt0aGlzLm9wdGlvbnMucHJlY2lzaW9uO1xuXG4gICAgICAgIHRoaXMubWluVmFsdWUgPSB0aGlzLm9wdGlvbnMuZmxvb3I7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMubG9nU2NhbGUgJiYgdGhpcy5taW5WYWx1ZSA9PT0gMClcbiAgICAgICAgICB0aHJvdyBFcnJvcihcIkNhbid0IHVzZSBmbG9vcj0wIHdpdGggbG9nYXJpdGhtaWMgc2NhbGVcIik7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5lbmZvcmNlU3RlcCkge1xuICAgICAgICAgIHRoaXMubG93VmFsdWUgPSB0aGlzLnJvdW5kU3RlcCh0aGlzLmxvd1ZhbHVlKTtcbiAgICAgICAgICBpZiAodGhpcy5yYW5nZSlcbiAgICAgICAgICAgIHRoaXMuaGlnaFZhbHVlID0gdGhpcy5yb3VuZFN0ZXAodGhpcy5oaWdoVmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5jZWlsICE9IG51bGwpXG4gICAgICAgICAgdGhpcy5tYXhWYWx1ZSA9IHRoaXMub3B0aW9ucy5jZWlsO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgdGhpcy5tYXhWYWx1ZSA9IHRoaXMub3B0aW9ucy5jZWlsID0gdGhpcy5yYW5nZSA/IHRoaXMuaGlnaFZhbHVlIDogdGhpcy5sb3dWYWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmVuZm9yY2VSYW5nZSkge1xuICAgICAgICAgIHRoaXMubG93VmFsdWUgPSB0aGlzLnNhbml0aXplVmFsdWUodGhpcy5sb3dWYWx1ZSk7XG4gICAgICAgICAgaWYgKHRoaXMucmFuZ2UpXG4gICAgICAgICAgICB0aGlzLmhpZ2hWYWx1ZSA9IHRoaXMuc2FuaXRpemVWYWx1ZSh0aGlzLmhpZ2hWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmFwcGx5TG93VmFsdWUoKTtcbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpXG4gICAgICAgICAgdGhpcy5hcHBseUhpZ2hWYWx1ZSgpO1xuXG4gICAgICAgIHRoaXMudmFsdWVSYW5nZSA9IHRoaXMubWF4VmFsdWUgLSB0aGlzLm1pblZhbHVlO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBBZGRzIGFjY2Vzc2liaWxpdHkgYXR0cmlidXRlc1xuICAgICAgICpcbiAgICAgICAqIFJ1biBvbmx5IG9uY2UgZHVyaW5nIGluaXRpYWxpemF0aW9uXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgYWRkQWNjZXNzaWJpbGl0eTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubWluSC5hdHRyKCdyb2xlJywgJ3NsaWRlcicpO1xuICAgICAgICB0aGlzLnVwZGF0ZUFyaWFBdHRyaWJ1dGVzKCk7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMua2V5Ym9hcmRTdXBwb3J0ICYmICEodGhpcy5vcHRpb25zLnJlYWRPbmx5IHx8IHRoaXMub3B0aW9ucy5kaXNhYmxlZCkpXG4gICAgICAgICAgdGhpcy5taW5ILmF0dHIoJ3RhYmluZGV4JywgJzAnKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRoaXMubWluSC5hdHRyKCd0YWJpbmRleCcsICcnKTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy52ZXJ0aWNhbClcbiAgICAgICAgICB0aGlzLm1pbkguYXR0cignYXJpYS1vcmllbnRhdGlvbicsICd2ZXJ0aWNhbCcpO1xuXG4gICAgICAgIGlmICh0aGlzLnJhbmdlKSB7XG4gICAgICAgICAgdGhpcy5tYXhILmF0dHIoJ3JvbGUnLCAnc2xpZGVyJyk7XG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5rZXlib2FyZFN1cHBvcnQgJiYgISh0aGlzLm9wdGlvbnMucmVhZE9ubHkgfHwgdGhpcy5vcHRpb25zLmRpc2FibGVkKSlcbiAgICAgICAgICAgIHRoaXMubWF4SC5hdHRyKCd0YWJpbmRleCcsICcwJyk7XG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5tYXhILmF0dHIoJ3RhYmluZGV4JywgJycpO1xuICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMudmVydGljYWwpXG4gICAgICAgICAgICB0aGlzLm1heEguYXR0cignYXJpYS1vcmllbnRhdGlvbicsICd2ZXJ0aWNhbCcpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFVwZGF0ZXMgYXJpYSBhdHRyaWJ1dGVzIGFjY29yZGluZyB0byBjdXJyZW50IHZhbHVlc1xuICAgICAgICovXG4gICAgICB1cGRhdGVBcmlhQXR0cmlidXRlczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubWluSC5hdHRyKHtcbiAgICAgICAgICAnYXJpYS12YWx1ZW5vdyc6IHRoaXMuc2NvcGUucnpTbGlkZXJNb2RlbCxcbiAgICAgICAgICAnYXJpYS12YWx1ZXRleHQnOiB0aGlzLmN1c3RvbVRyRm4odGhpcy5zY29wZS5yelNsaWRlck1vZGVsLCB0aGlzLm9wdGlvbnMuaWQsICdtb2RlbCcpLFxuICAgICAgICAgICdhcmlhLXZhbHVlbWluJzogdGhpcy5taW5WYWx1ZSxcbiAgICAgICAgICAnYXJpYS12YWx1ZW1heCc6IHRoaXMubWF4VmFsdWVcbiAgICAgICAgfSk7XG4gICAgICAgIGlmICh0aGlzLnJhbmdlKSB7XG4gICAgICAgICAgdGhpcy5tYXhILmF0dHIoe1xuICAgICAgICAgICAgJ2FyaWEtdmFsdWVub3cnOiB0aGlzLnNjb3BlLnJ6U2xpZGVySGlnaCxcbiAgICAgICAgICAgICdhcmlhLXZhbHVldGV4dCc6IHRoaXMuY3VzdG9tVHJGbih0aGlzLnNjb3BlLnJ6U2xpZGVySGlnaCwgdGhpcy5vcHRpb25zLmlkLCAnaGlnaCcpLFxuICAgICAgICAgICAgJ2FyaWEtdmFsdWVtaW4nOiB0aGlzLm1pblZhbHVlLFxuICAgICAgICAgICAgJ2FyaWEtdmFsdWVtYXgnOiB0aGlzLm1heFZhbHVlXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogQ2FsY3VsYXRlIGRpbWVuc2lvbnMgdGhhdCBhcmUgZGVwZW5kZW50IG9uIHZpZXcgcG9ydCBzaXplXG4gICAgICAgKlxuICAgICAgICogUnVuIG9uY2UgZHVyaW5nIGluaXRpYWxpemF0aW9uIGFuZCBldmVyeSB0aW1lIHZpZXcgcG9ydCBjaGFuZ2VzIHNpemUuXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgY2FsY1ZpZXdEaW1lbnNpb25zOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGhhbmRsZVdpZHRoID0gdGhpcy5nZXREaW1lbnNpb24odGhpcy5taW5IKTtcblxuICAgICAgICB0aGlzLmhhbmRsZUhhbGZEaW0gPSBoYW5kbGVXaWR0aCAvIDI7XG4gICAgICAgIHRoaXMuYmFyRGltZW5zaW9uID0gdGhpcy5nZXREaW1lbnNpb24odGhpcy5mdWxsQmFyKTtcblxuICAgICAgICB0aGlzLm1heFBvcyA9IHRoaXMuYmFyRGltZW5zaW9uIC0gaGFuZGxlV2lkdGg7XG5cbiAgICAgICAgdGhpcy5nZXREaW1lbnNpb24odGhpcy5zbGlkZXJFbGVtKTtcbiAgICAgICAgdGhpcy5zbGlkZXJFbGVtLnJ6c3AgPSB0aGlzLnNsaWRlckVsZW1bMF0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClbdGhpcy5wb3NpdGlvblByb3BlcnR5XTtcblxuICAgICAgICBpZiAodGhpcy5pbml0SGFzUnVuKSB7XG4gICAgICAgICAgdGhpcy51cGRhdGVGbG9vckxhYigpO1xuICAgICAgICAgIHRoaXMudXBkYXRlQ2VpbExhYigpO1xuICAgICAgICAgIHRoaXMuaW5pdEhhbmRsZXMoKTtcbiAgICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgICAgJHRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLnVwZGF0ZVRpY2tzU2NhbGUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBVcGRhdGUgdGhlIHRpY2tzIHBvc2l0aW9uXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgdXBkYXRlVGlja3NTY2FsZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICghdGhpcy5vcHRpb25zLnNob3dUaWNrcykgcmV0dXJuO1xuXG4gICAgICAgIHZhciB0aWNrc0FycmF5ID0gdGhpcy5vcHRpb25zLnRpY2tzQXJyYXkgfHwgdGhpcy5nZXRUaWNrc0FycmF5KCksXG4gICAgICAgICAgdHJhbnNsYXRlID0gdGhpcy5vcHRpb25zLnZlcnRpY2FsID8gJ3RyYW5zbGF0ZVknIDogJ3RyYW5zbGF0ZVgnLFxuICAgICAgICAgIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQpXG4gICAgICAgICAgdGlja3NBcnJheS5yZXZlcnNlKCk7XG5cbiAgICAgICAgdGhpcy5zY29wZS50aWNrcyA9IHRpY2tzQXJyYXkubWFwKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgdmFyIHBvc2l0aW9uID0gc2VsZi52YWx1ZVRvUG9zaXRpb24odmFsdWUpO1xuXG4gICAgICAgICAgaWYgKHNlbGYub3B0aW9ucy52ZXJ0aWNhbClcbiAgICAgICAgICAgIHBvc2l0aW9uID0gc2VsZi5tYXhQb3MgLSBwb3NpdGlvbjtcblxuICAgICAgICAgIHZhciB0aWNrID0ge1xuICAgICAgICAgICAgc2VsZWN0ZWQ6IHNlbGYuaXNUaWNrU2VsZWN0ZWQodmFsdWUpLFxuICAgICAgICAgICAgc3R5bGU6IHtcbiAgICAgICAgICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGUgKyAnKCcgKyBNYXRoLnJvdW5kKHBvc2l0aW9uKSArICdweCknXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfTtcbiAgICAgICAgICBpZiAodGljay5zZWxlY3RlZCAmJiBzZWxmLm9wdGlvbnMuZ2V0U2VsZWN0aW9uQmFyQ29sb3IpIHtcbiAgICAgICAgICAgIHRpY2suc3R5bGVbJ2JhY2tncm91bmQtY29sb3InXSA9IHNlbGYuZ2V0U2VsZWN0aW9uQmFyQ29sb3IoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKCF0aWNrLnNlbGVjdGVkICYmIHNlbGYub3B0aW9ucy5nZXRUaWNrQ29sb3IpIHtcbiAgICAgICAgICAgIHRpY2suc3R5bGVbJ2JhY2tncm91bmQtY29sb3InXSA9IHNlbGYuZ2V0VGlja0NvbG9yKHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHNlbGYub3B0aW9ucy50aWNrc1Rvb2x0aXApIHtcbiAgICAgICAgICAgIHRpY2sudG9vbHRpcCA9IHNlbGYub3B0aW9ucy50aWNrc1Rvb2x0aXAodmFsdWUpO1xuICAgICAgICAgICAgdGljay50b29sdGlwUGxhY2VtZW50ID0gc2VsZi5vcHRpb25zLnZlcnRpY2FsID8gJ3JpZ2h0JyA6ICd0b3AnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc2VsZi5vcHRpb25zLnNob3dUaWNrc1ZhbHVlcykge1xuICAgICAgICAgICAgdGljay52YWx1ZSA9IHNlbGYuZ2V0RGlzcGxheVZhbHVlKHZhbHVlLCAndGljay12YWx1ZScpO1xuICAgICAgICAgICAgaWYgKHNlbGYub3B0aW9ucy50aWNrc1ZhbHVlc1Rvb2x0aXApIHtcbiAgICAgICAgICAgICAgdGljay52YWx1ZVRvb2x0aXAgPSBzZWxmLm9wdGlvbnMudGlja3NWYWx1ZXNUb29sdGlwKHZhbHVlKTtcbiAgICAgICAgICAgICAgdGljay52YWx1ZVRvb2x0aXBQbGFjZW1lbnQgPSBzZWxmLm9wdGlvbnMudmVydGljYWwgPyAncmlnaHQnIDogJ3RvcCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzZWxmLmdldExlZ2VuZCkge1xuICAgICAgICAgICAgdmFyIGxlZ2VuZCA9IHNlbGYuZ2V0TGVnZW5kKHZhbHVlLCBzZWxmLm9wdGlvbnMuaWQpO1xuICAgICAgICAgICAgaWYgKGxlZ2VuZClcbiAgICAgICAgICAgICAgdGljay5sZWdlbmQgPSBsZWdlbmQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB0aWNrO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIGdldFRpY2tzQXJyYXk6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc3RlcCA9IHRoaXMuc3RlcCxcbiAgICAgICAgICB0aWNrc0FycmF5ID0gW107XG4gICAgICAgIGlmICh0aGlzLmludGVybWVkaWF0ZVRpY2tzKVxuICAgICAgICAgIHN0ZXAgPSB0aGlzLm9wdGlvbnMuc2hvd1RpY2tzO1xuICAgICAgICBmb3IgKHZhciB2YWx1ZSA9IHRoaXMubWluVmFsdWU7IHZhbHVlIDw9IHRoaXMubWF4VmFsdWU7IHZhbHVlICs9IHN0ZXApIHtcbiAgICAgICAgICB0aWNrc0FycmF5LnB1c2godmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aWNrc0FycmF5O1xuICAgICAgfSxcblxuICAgICAgaXNUaWNrU2VsZWN0ZWQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5yYW5nZSkge1xuICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMuc2hvd1NlbGVjdGlvbkJhckZyb21WYWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdmFyIGNlbnRlciA9IHRoaXMub3B0aW9ucy5zaG93U2VsZWN0aW9uQmFyRnJvbVZhbHVlO1xuICAgICAgICAgICAgaWYgKHRoaXMubG93VmFsdWUgPiBjZW50ZXIgJiYgdmFsdWUgPj0gY2VudGVyICYmIHZhbHVlIDw9IHRoaXMubG93VmFsdWUpXG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgZWxzZSBpZiAodGhpcy5sb3dWYWx1ZSA8IGNlbnRlciAmJiB2YWx1ZSA8PSBjZW50ZXIgJiYgdmFsdWUgPj0gdGhpcy5sb3dWYWx1ZSlcbiAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKHRoaXMub3B0aW9ucy5zaG93U2VsZWN0aW9uQmFyRW5kKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgPj0gdGhpcy5sb3dWYWx1ZSlcbiAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKHRoaXMub3B0aW9ucy5zaG93U2VsZWN0aW9uQmFyICYmIHZhbHVlIDw9IHRoaXMubG93VmFsdWUpXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5yYW5nZSAmJiB2YWx1ZSA+PSB0aGlzLmxvd1ZhbHVlICYmIHZhbHVlIDw9IHRoaXMuaGlnaFZhbHVlKVxuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFVwZGF0ZSBwb3NpdGlvbiBvZiB0aGUgZmxvb3IgbGFiZWxcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICB1cGRhdGVGbG9vckxhYjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMudHJhbnNsYXRlRm4odGhpcy5taW5WYWx1ZSwgdGhpcy5mbHJMYWIsICdmbG9vcicpO1xuICAgICAgICB0aGlzLmdldERpbWVuc2lvbih0aGlzLmZsckxhYik7XG4gICAgICAgIHZhciBwb3NpdGlvbiA9IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCA/IHRoaXMuYmFyRGltZW5zaW9uIC0gdGhpcy5mbHJMYWIucnpzZCA6IDA7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24odGhpcy5mbHJMYWIsIHBvc2l0aW9uKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVXBkYXRlIHBvc2l0aW9uIG9mIHRoZSBjZWlsaW5nIGxhYmVsXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgdXBkYXRlQ2VpbExhYjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMudHJhbnNsYXRlRm4odGhpcy5tYXhWYWx1ZSwgdGhpcy5jZWlsTGFiLCAnY2VpbCcpO1xuICAgICAgICB0aGlzLmdldERpbWVuc2lvbih0aGlzLmNlaWxMYWIpO1xuICAgICAgICB2YXIgcG9zaXRpb24gPSB0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQgPyAwIDogdGhpcy5iYXJEaW1lbnNpb24gLSB0aGlzLmNlaWxMYWIucnpzZDtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbih0aGlzLmNlaWxMYWIsIHBvc2l0aW9uKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVXBkYXRlIHNsaWRlciBoYW5kbGVzIGFuZCBsYWJlbCBwb3NpdGlvbnNcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge3N0cmluZ30gd2hpY2hcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuZXdQb3NcbiAgICAgICAqL1xuICAgICAgdXBkYXRlSGFuZGxlczogZnVuY3Rpb24od2hpY2gsIG5ld1Bvcykge1xuICAgICAgICBpZiAod2hpY2ggPT09ICdsb3dWYWx1ZScpXG4gICAgICAgICAgdGhpcy51cGRhdGVMb3dIYW5kbGUobmV3UG9zKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIHRoaXMudXBkYXRlSGlnaEhhbmRsZShuZXdQb3MpO1xuXG4gICAgICAgIHRoaXMudXBkYXRlU2VsZWN0aW9uQmFyKCk7XG4gICAgICAgIHRoaXMudXBkYXRlVGlja3NTY2FsZSgpO1xuICAgICAgICBpZiAodGhpcy5yYW5nZSlcbiAgICAgICAgICB0aGlzLnVwZGF0ZUNtYkxhYmVsKCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byB3b3JrIG91dCB0aGUgcG9zaXRpb24gZm9yIGhhbmRsZSBsYWJlbHMgZGVwZW5kaW5nIG9uIFJUTCBvciBub3RcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbGFiZWxOYW1lIG1heExhYiBvciBtaW5MYWJcbiAgICAgICAqIEBwYXJhbSBuZXdQb3NcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICBnZXRIYW5kbGVMYWJlbFBvczogZnVuY3Rpb24obGFiZWxOYW1lLCBuZXdQb3MpIHtcbiAgICAgICAgdmFyIGxhYmVsUnpzZCA9IHRoaXNbbGFiZWxOYW1lXS5yenNkLFxuICAgICAgICAgIG5lYXJIYW5kbGVQb3MgPSBuZXdQb3MgLSBsYWJlbFJ6c2QgLyAyICsgdGhpcy5oYW5kbGVIYWxmRGltLFxuICAgICAgICAgIGVuZE9mQmFyUG9zID0gdGhpcy5iYXJEaW1lbnNpb24gLSBsYWJlbFJ6c2Q7XG5cbiAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYm91bmRQb2ludGVyTGFiZWxzKVxuICAgICAgICAgIHJldHVybiBuZWFySGFuZGxlUG9zO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQgJiYgbGFiZWxOYW1lID09PSAnbWluTGFiJyB8fCAhdGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0ICYmIGxhYmVsTmFtZSA9PT0gJ21heExhYicpIHtcbiAgICAgICAgICByZXR1cm4gTWF0aC5taW4obmVhckhhbmRsZVBvcywgZW5kT2ZCYXJQb3MpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChuZWFySGFuZGxlUG9zLCAwKSwgZW5kT2ZCYXJQb3MpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFVwZGF0ZSBsb3cgc2xpZGVyIGhhbmRsZSBwb3NpdGlvbiBhbmQgbGFiZWxcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge251bWJlcn0gbmV3UG9zXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICB1cGRhdGVMb3dIYW5kbGU6IGZ1bmN0aW9uKG5ld1Bvcykge1xuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKHRoaXMubWluSCwgbmV3UG9zKTtcbiAgICAgICAgdGhpcy50cmFuc2xhdGVGbih0aGlzLmxvd1ZhbHVlLCB0aGlzLm1pbkxhYiwgJ21vZGVsJyk7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24odGhpcy5taW5MYWIsIHRoaXMuZ2V0SGFuZGxlTGFiZWxQb3MoJ21pbkxhYicsIG5ld1BvcykpO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZ2V0UG9pbnRlckNvbG9yKSB7XG4gICAgICAgICAgdmFyIHBvaW50ZXJjb2xvciA9IHRoaXMuZ2V0UG9pbnRlckNvbG9yKCdtaW4nKTtcbiAgICAgICAgICB0aGlzLnNjb3BlLm1pblBvaW50ZXJTdHlsZSA9IHtcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogcG9pbnRlcmNvbG9yXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYXV0b0hpZGVMaW1pdExhYmVscykge1xuICAgICAgICAgIHRoaXMuc2hGbG9vckNlaWwoKTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBVcGRhdGUgaGlnaCBzbGlkZXIgaGFuZGxlIHBvc2l0aW9uIGFuZCBsYWJlbFxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuZXdQb3NcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIHVwZGF0ZUhpZ2hIYW5kbGU6IGZ1bmN0aW9uKG5ld1Bvcykge1xuICAgICAgICB0aGlzLnNldFBvc2l0aW9uKHRoaXMubWF4SCwgbmV3UG9zKTtcbiAgICAgICAgdGhpcy50cmFuc2xhdGVGbih0aGlzLmhpZ2hWYWx1ZSwgdGhpcy5tYXhMYWIsICdoaWdoJyk7XG4gICAgICAgIHRoaXMuc2V0UG9zaXRpb24odGhpcy5tYXhMYWIsIHRoaXMuZ2V0SGFuZGxlTGFiZWxQb3MoJ21heExhYicsIG5ld1BvcykpO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZ2V0UG9pbnRlckNvbG9yKSB7XG4gICAgICAgICAgdmFyIHBvaW50ZXJjb2xvciA9IHRoaXMuZ2V0UG9pbnRlckNvbG9yKCdtYXgnKTtcbiAgICAgICAgICB0aGlzLnNjb3BlLm1heFBvaW50ZXJTdHlsZSA9IHtcbiAgICAgICAgICAgIGJhY2tncm91bmRDb2xvcjogcG9pbnRlcmNvbG9yXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmF1dG9IaWRlTGltaXRMYWJlbHMpIHtcbiAgICAgICAgICB0aGlzLnNoRmxvb3JDZWlsKCk7XG4gICAgICAgIH1cblxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTaG93L2hpZGUgZmxvb3IvY2VpbGluZyBsYWJlbFxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIHNoRmxvb3JDZWlsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gU2hvdyBiYXNlZCBvbmx5IG9uIGhpZGVMaW1pdExhYmVscyBpZiBwb2ludGVyIGxhYmVscyBhcmUgaGlkZGVuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuaGlkZVBvaW50ZXJMYWJlbHMpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGZsSGlkZGVuID0gZmFsc2UsXG4gICAgICAgICAgY2xIaWRkZW4gPSBmYWxzZSxcbiAgICAgICAgICBpc01pbkxhYkF0Rmxvb3IgPSB0aGlzLmlzTGFiZWxCZWxvd0Zsb29yTGFiKHRoaXMubWluTGFiKSxcbiAgICAgICAgICBpc01pbkxhYkF0Q2VpbCA9IHRoaXMuaXNMYWJlbEFib3ZlQ2VpbExhYih0aGlzLm1pbkxhYiksXG4gICAgICAgICAgaXNNYXhMYWJBdENlaWwgPSB0aGlzLmlzTGFiZWxBYm92ZUNlaWxMYWIodGhpcy5tYXhMYWIpLFxuICAgICAgICAgIGlzQ21iTGFiQXRGbG9vciA9IHRoaXMuaXNMYWJlbEJlbG93Rmxvb3JMYWIodGhpcy5jbWJMYWIpLFxuICAgICAgICAgIGlzQ21iTGFiQXRDZWlsID0gIHRoaXMuaXNMYWJlbEFib3ZlQ2VpbExhYih0aGlzLmNtYkxhYik7XG5cbiAgICAgICAgaWYgKGlzTWluTGFiQXRGbG9vcikge1xuICAgICAgICAgIGZsSGlkZGVuID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLmhpZGVFbCh0aGlzLmZsckxhYik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmxIaWRkZW4gPSBmYWxzZTtcbiAgICAgICAgICB0aGlzLnNob3dFbCh0aGlzLmZsckxhYik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNNaW5MYWJBdENlaWwpIHtcbiAgICAgICAgICBjbEhpZGRlbiA9IHRydWU7XG4gICAgICAgICAgdGhpcy5oaWRlRWwodGhpcy5jZWlsTGFiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjbEhpZGRlbiA9IGZhbHNlO1xuICAgICAgICAgIHRoaXMuc2hvd0VsKHRoaXMuY2VpbExhYik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5yYW5nZSkge1xuICAgICAgICAgIHZhciBoaWRlQ2VpbCA9IHRoaXMuY21iTGFiZWxTaG93biA/IGlzQ21iTGFiQXRDZWlsIDogaXNNYXhMYWJBdENlaWw7XG4gICAgICAgICAgdmFyIGhpZGVGbG9vciA9IHRoaXMuY21iTGFiZWxTaG93biA/IGlzQ21iTGFiQXRGbG9vciA6IGlzTWluTGFiQXRGbG9vcjtcblxuICAgICAgICAgIGlmIChoaWRlQ2VpbCkge1xuICAgICAgICAgICAgdGhpcy5oaWRlRWwodGhpcy5jZWlsTGFiKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKCFjbEhpZGRlbikge1xuICAgICAgICAgICAgdGhpcy5zaG93RWwodGhpcy5jZWlsTGFiKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBIaWRlIG9yIHNob3cgZmxvb3IgbGFiZWxcbiAgICAgICAgICBpZiAoaGlkZUZsb29yKSB7XG4gICAgICAgICAgICB0aGlzLmhpZGVFbCh0aGlzLmZsckxhYik7XG4gICAgICAgICAgfSBlbHNlIGlmICghZmxIaWRkZW4pIHtcbiAgICAgICAgICAgIHRoaXMuc2hvd0VsKHRoaXMuZmxyTGFiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIGlzTGFiZWxCZWxvd0Zsb29yTGFiOiBmdW5jdGlvbihsYWJlbCkge1xuICAgICAgICB2YXIgaXNSVEwgPSB0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQsXG4gICAgICAgICAgcG9zID0gbGFiZWwucnpzcCxcbiAgICAgICAgICBkaW0gPSBsYWJlbC5yenNkLFxuICAgICAgICAgIGZsb29yUG9zID0gdGhpcy5mbHJMYWIucnpzcCxcbiAgICAgICAgICBmbG9vckRpbSA9IHRoaXMuZmxyTGFiLnJ6c2Q7XG4gICAgICAgIHJldHVybiBpc1JUTCA/XG4gICAgICAgIHBvcyArIGRpbSA+PSBmbG9vclBvcyAtIDIgOlxuICAgICAgICBwb3MgPD0gZmxvb3JQb3MgKyBmbG9vckRpbSArIDI7XG4gICAgICB9LFxuXG4gICAgICBpc0xhYmVsQWJvdmVDZWlsTGFiOiBmdW5jdGlvbihsYWJlbCkge1xuICAgICAgICB2YXIgaXNSVEwgPSB0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQsXG4gICAgICAgICAgcG9zID0gbGFiZWwucnpzcCxcbiAgICAgICAgICBkaW0gPSBsYWJlbC5yenNkLFxuICAgICAgICAgIGNlaWxQb3MgPSB0aGlzLmNlaWxMYWIucnpzcCxcbiAgICAgICAgICBjZWlsRGltID0gdGhpcy5jZWlsTGFiLnJ6c2Q7XG4gICAgICAgIHJldHVybiBpc1JUTCA/XG4gICAgICAgIHBvcyA8PSBjZWlsUG9zICsgY2VpbERpbSArIDIgOlxuICAgICAgICBwb3MgKyBkaW0gPj0gY2VpbFBvcyAtIDI7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFVwZGF0ZSBzbGlkZXIgc2VsZWN0aW9uIGJhciwgY29tYmluZWQgbGFiZWwgYW5kIHJhbmdlIGxhYmVsXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgdXBkYXRlU2VsZWN0aW9uQmFyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHBvc2l0aW9uID0gMCxcbiAgICAgICAgICBkaW1lbnNpb24gPSAwLFxuICAgICAgICAgIGlzU2VsZWN0aW9uQmFyRnJvbVJpZ2h0ID0gdGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0ID8gIXRoaXMub3B0aW9ucy5zaG93U2VsZWN0aW9uQmFyRW5kIDogdGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXJFbmQsXG4gICAgICAgICAgcG9zaXRpb25Gb3JSYW5nZSA9IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCA/IHRoaXMubWF4SC5yenNwICsgdGhpcy5oYW5kbGVIYWxmRGltIDogdGhpcy5taW5ILnJ6c3AgKyB0aGlzLmhhbmRsZUhhbGZEaW07XG5cbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpIHtcbiAgICAgICAgICBkaW1lbnNpb24gPSBNYXRoLmFicyh0aGlzLm1heEgucnpzcCAtIHRoaXMubWluSC5yenNwKTtcbiAgICAgICAgICBwb3NpdGlvbiA9IHBvc2l0aW9uRm9yUmFuZ2U7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zaG93U2VsZWN0aW9uQmFyRnJvbVZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICB2YXIgY2VudGVyID0gdGhpcy5vcHRpb25zLnNob3dTZWxlY3Rpb25CYXJGcm9tVmFsdWUsXG4gICAgICAgICAgICAgIGNlbnRlclBvc2l0aW9uID0gdGhpcy52YWx1ZVRvUG9zaXRpb24oY2VudGVyKSxcbiAgICAgICAgICAgICAgaXNNb2RlbEdyZWF0ZXJUaGFuQ2VudGVyID0gdGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0ID8gdGhpcy5sb3dWYWx1ZSA8PSBjZW50ZXIgOiB0aGlzLmxvd1ZhbHVlID4gY2VudGVyO1xuICAgICAgICAgICAgaWYgKGlzTW9kZWxHcmVhdGVyVGhhbkNlbnRlcikge1xuICAgICAgICAgICAgICBkaW1lbnNpb24gPSB0aGlzLm1pbkgucnpzcCAtIGNlbnRlclBvc2l0aW9uO1xuICAgICAgICAgICAgICBwb3NpdGlvbiA9IGNlbnRlclBvc2l0aW9uICsgdGhpcy5oYW5kbGVIYWxmRGltO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgIGRpbWVuc2lvbiA9IGNlbnRlclBvc2l0aW9uIC0gdGhpcy5taW5ILnJ6c3A7XG4gICAgICAgICAgICAgIHBvc2l0aW9uID0gdGhpcy5taW5ILnJ6c3AgKyB0aGlzLmhhbmRsZUhhbGZEaW07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKGlzU2VsZWN0aW9uQmFyRnJvbVJpZ2h0KSB7XG4gICAgICAgICAgICBkaW1lbnNpb24gPSBNYXRoLmFicyh0aGlzLm1heFBvcyAtIHRoaXMubWluSC5yenNwKSArIHRoaXMuaGFuZGxlSGFsZkRpbTtcbiAgICAgICAgICAgIHBvc2l0aW9uID0gdGhpcy5taW5ILnJ6c3AgKyB0aGlzLmhhbmRsZUhhbGZEaW07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRpbWVuc2lvbiA9IE1hdGguYWJzKHRoaXMubWF4SC5yenNwIC0gdGhpcy5taW5ILnJ6c3ApICsgdGhpcy5oYW5kbGVIYWxmRGltO1xuICAgICAgICAgICAgcG9zaXRpb24gPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNldERpbWVuc2lvbih0aGlzLnNlbEJhciwgZGltZW5zaW9uKTtcbiAgICAgICAgdGhpcy5zZXRQb3NpdGlvbih0aGlzLnNlbEJhciwgcG9zaXRpb24pO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmdldFNlbGVjdGlvbkJhckNvbG9yKSB7XG4gICAgICAgICAgdmFyIGNvbG9yID0gdGhpcy5nZXRTZWxlY3Rpb25CYXJDb2xvcigpO1xuICAgICAgICAgIHRoaXMuc2NvcGUuYmFyU3R5bGUgPSB7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I6IGNvbG9yXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBXcmFwcGVyIGFyb3VuZCB0aGUgZ2V0U2VsZWN0aW9uQmFyQ29sb3Igb2YgdGhlIHVzZXIgdG8gcGFzcyB0b1xuICAgICAgICogY29ycmVjdCBwYXJhbWV0ZXJzXG4gICAgICAgKi9cbiAgICAgIGdldFNlbGVjdGlvbkJhckNvbG9yOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpXG4gICAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5nZXRTZWxlY3Rpb25CYXJDb2xvcih0aGlzLnNjb3BlLnJ6U2xpZGVyTW9kZWwsIHRoaXMuc2NvcGUucnpTbGlkZXJIaWdoKTtcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5nZXRTZWxlY3Rpb25CYXJDb2xvcih0aGlzLnNjb3BlLnJ6U2xpZGVyTW9kZWwpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBXcmFwcGVyIGFyb3VuZCB0aGUgZ2V0UG9pbnRlckNvbG9yIG9mIHRoZSB1c2VyIHRvIHBhc3MgdG9cbiAgICAgICAqIGNvcnJlY3QgcGFyYW1ldGVyc1xuICAgICAgICovXG4gICAgICBnZXRQb2ludGVyQ29sb3I6IGZ1bmN0aW9uKHBvaW50ZXJUeXBlKSB7XG4gICAgICAgIGlmIChwb2ludGVyVHlwZSA9PT0gJ21heCcpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmdldFBvaW50ZXJDb2xvcih0aGlzLnNjb3BlLnJ6U2xpZGVySGlnaCwgcG9pbnRlclR5cGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuZ2V0UG9pbnRlckNvbG9yKHRoaXMuc2NvcGUucnpTbGlkZXJNb2RlbCwgcG9pbnRlclR5cGUpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBXcmFwcGVyIGFyb3VuZCB0aGUgZ2V0VGlja0NvbG9yIG9mIHRoZSB1c2VyIHRvIHBhc3MgdG9cbiAgICAgICAqIGNvcnJlY3QgcGFyYW1ldGVyc1xuICAgICAgICovXG4gICAgICBnZXRUaWNrQ29sb3I6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuZ2V0VGlja0NvbG9yKHZhbHVlKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogVXBkYXRlIGNvbWJpbmVkIGxhYmVsIHBvc2l0aW9uIGFuZCB2YWx1ZVxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIHVwZGF0ZUNtYkxhYmVsOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGlzTGFiZWxPdmVybGFwID0gbnVsbDtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCkge1xuICAgICAgICAgIGlzTGFiZWxPdmVybGFwID0gdGhpcy5taW5MYWIucnpzcCAtIHRoaXMubWluTGFiLnJ6c2QgLSAxMCA8PSB0aGlzLm1heExhYi5yenNwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlzTGFiZWxPdmVybGFwID0gdGhpcy5taW5MYWIucnpzcCArIHRoaXMubWluTGFiLnJ6c2QgKyAxMCA+PSB0aGlzLm1heExhYi5yenNwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzTGFiZWxPdmVybGFwKSB7XG4gICAgICAgICAgdmFyIGxvd1RyID0gdGhpcy5nZXREaXNwbGF5VmFsdWUodGhpcy5sb3dWYWx1ZSwgJ21vZGVsJyksXG4gICAgICAgICAgICBoaWdoVHIgPSB0aGlzLmdldERpc3BsYXlWYWx1ZSh0aGlzLmhpZ2hWYWx1ZSwgJ2hpZ2gnKSxcbiAgICAgICAgICAgIGxhYmVsVmFsID0gJyc7XG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5tZXJnZVJhbmdlTGFiZWxzSWZTYW1lICYmIGxvd1RyID09PSBoaWdoVHIpIHtcbiAgICAgICAgICAgIGxhYmVsVmFsID0gbG93VHI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxhYmVsVmFsID0gdGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0ID8gaGlnaFRyICsgJyAtICcgKyBsb3dUciA6IGxvd1RyICsgJyAtICcgKyBoaWdoVHI7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy50cmFuc2xhdGVGbihsYWJlbFZhbCwgdGhpcy5jbWJMYWIsICdjbWInLCBmYWxzZSk7XG4gICAgICAgICAgdmFyIHBvcyA9IHRoaXMub3B0aW9ucy5ib3VuZFBvaW50ZXJMYWJlbHMgPyBNYXRoLm1pbihcbiAgICAgICAgICAgIE1hdGgubWF4KFxuICAgICAgICAgICAgICB0aGlzLnNlbEJhci5yenNwICsgdGhpcy5zZWxCYXIucnpzZCAvIDIgLSB0aGlzLmNtYkxhYi5yenNkIC8gMixcbiAgICAgICAgICAgICAgMFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHRoaXMuYmFyRGltZW5zaW9uIC0gdGhpcy5jbWJMYWIucnpzZFxuICAgICAgICAgICkgOiB0aGlzLnNlbEJhci5yenNwICsgdGhpcy5zZWxCYXIucnpzZCAvIDIgLSB0aGlzLmNtYkxhYi5yenNkIC8gMjtcblxuICAgICAgICAgIHRoaXMuc2V0UG9zaXRpb24odGhpcy5jbWJMYWIsIHBvcyk7XG4gICAgICAgICAgdGhpcy5jbWJMYWJlbFNob3duID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLmhpZGVFbCh0aGlzLm1pbkxhYik7XG4gICAgICAgICAgdGhpcy5oaWRlRWwodGhpcy5tYXhMYWIpO1xuICAgICAgICAgIHRoaXMuc2hvd0VsKHRoaXMuY21iTGFiKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmNtYkxhYmVsU2hvd24gPSBmYWxzZTtcbiAgICAgICAgICB0aGlzLnNob3dFbCh0aGlzLm1heExhYik7XG4gICAgICAgICAgdGhpcy5zaG93RWwodGhpcy5taW5MYWIpO1xuICAgICAgICAgIHRoaXMuaGlkZUVsKHRoaXMuY21iTGFiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmF1dG9IaWRlTGltaXRMYWJlbHMpIHtcbiAgICAgICAgICB0aGlzLnNoRmxvb3JDZWlsKCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogUmV0dXJuIHRoZSB0cmFuc2xhdGVkIHZhbHVlIGlmIGEgdHJhbnNsYXRlIGZ1bmN0aW9uIGlzIHByb3ZpZGVkIGVsc2UgdGhlIG9yaWdpbmFsIHZhbHVlXG4gICAgICAgKiBAcGFyYW0gdmFsdWVcbiAgICAgICAqIEBwYXJhbSB3aGljaCBpZiBpdCdzIG1pbiBvciBtYXggaGFuZGxlXG4gICAgICAgKiBAcmV0dXJucyB7Kn1cbiAgICAgICAqL1xuICAgICAgZ2V0RGlzcGxheVZhbHVlOiBmdW5jdGlvbih2YWx1ZSwgd2hpY2gpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5zdGVwc0FycmF5ICYmICF0aGlzLm9wdGlvbnMuYmluZEluZGV4Rm9yU3RlcHNBcnJheSkge1xuICAgICAgICAgIHZhbHVlID0gdGhpcy5nZXRTdGVwVmFsdWUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmN1c3RvbVRyRm4odmFsdWUsIHRoaXMub3B0aW9ucy5pZCwgd2hpY2gpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSb3VuZCB2YWx1ZSB0byBzdGVwIGFuZCBwcmVjaXNpb24gYmFzZWQgb24gbWluVmFsdWVcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge251bWJlcn0gdmFsdWVcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjdXN0b21TdGVwIGEgY3VzdG9tIHN0ZXAgdG8gb3ZlcnJpZGUgdGhlIGRlZmluZWQgc3RlcFxuICAgICAgICogQHJldHVybnMge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgcm91bmRTdGVwOiBmdW5jdGlvbih2YWx1ZSwgY3VzdG9tU3RlcCkge1xuICAgICAgICB2YXIgc3RlcCA9IGN1c3RvbVN0ZXAgPyBjdXN0b21TdGVwIDogdGhpcy5zdGVwLFxuICAgICAgICAgIHN0ZXBwZWREaWZmZXJlbmNlID0gcGFyc2VGbG9hdCgodmFsdWUgLSB0aGlzLm1pblZhbHVlKSAvIHN0ZXApLnRvUHJlY2lzaW9uKDEyKTtcbiAgICAgICAgc3RlcHBlZERpZmZlcmVuY2UgPSBNYXRoLnJvdW5kKCtzdGVwcGVkRGlmZmVyZW5jZSkgKiBzdGVwO1xuICAgICAgICB2YXIgbmV3VmFsdWUgPSAodGhpcy5taW5WYWx1ZSArIHN0ZXBwZWREaWZmZXJlbmNlKS50b0ZpeGVkKHRoaXMucHJlY2lzaW9uKTtcbiAgICAgICAgcmV0dXJuICtuZXdWYWx1ZTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogSGlkZSBlbGVtZW50XG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIGVsZW1lbnRcbiAgICAgICAqIEByZXR1cm5zIHtqcUxpdGV9IFRoZSBqcUxpdGUgd3JhcHBlZCBET00gZWxlbWVudFxuICAgICAgICovXG4gICAgICBoaWRlRWw6IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICAgICAgcmV0dXJuIGVsZW1lbnQuY3NzKHtcbiAgICAgICAgICB2aXNpYmlsaXR5OiAnaGlkZGVuJ1xuICAgICAgICB9KTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogU2hvdyBlbGVtZW50XG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIGVsZW1lbnQgVGhlIGpxTGl0ZSB3cmFwcGVkIERPTSBlbGVtZW50XG4gICAgICAgKiBAcmV0dXJucyB7anFMaXRlfSBUaGUganFMaXRlXG4gICAgICAgKi9cbiAgICAgIHNob3dFbDogZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgICBpZiAoISFlbGVtZW50LnJ6QWx3YXlzSGlkZSkge1xuICAgICAgICAgIHJldHVybiBlbGVtZW50O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVsZW1lbnQuY3NzKHtcbiAgICAgICAgICB2aXNpYmlsaXR5OiAndmlzaWJsZSdcbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFNldCBlbGVtZW50IGxlZnQvdG9wIHBvc2l0aW9uIGRlcGVuZGluZyBvbiB3aGV0aGVyIHNsaWRlciBpcyBob3Jpem9udGFsIG9yIHZlcnRpY2FsXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtqcUxpdGV9IGVsZW0gVGhlIGpxTGl0ZSB3cmFwcGVkIERPTSBlbGVtZW50XG4gICAgICAgKiBAcGFyYW0ge251bWJlcn0gcG9zXG4gICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICBzZXRQb3NpdGlvbjogZnVuY3Rpb24oZWxlbSwgcG9zKSB7XG4gICAgICAgIGVsZW0ucnpzcCA9IHBvcztcbiAgICAgICAgdmFyIGNzcyA9IHt9O1xuICAgICAgICBjc3NbdGhpcy5wb3NpdGlvblByb3BlcnR5XSA9IE1hdGgucm91bmQocG9zKSArICdweCc7XG4gICAgICAgIGVsZW0uY3NzKGNzcyk7XG4gICAgICAgIHJldHVybiBwb3M7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEdldCBlbGVtZW50IHdpZHRoL2hlaWdodCBkZXBlbmRpbmcgb24gd2hldGhlciBzbGlkZXIgaXMgaG9yaXpvbnRhbCBvciB2ZXJ0aWNhbFxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7anFMaXRlfSBlbGVtIFRoZSBqcUxpdGUgd3JhcHBlZCBET00gZWxlbWVudFxuICAgICAgICogQHJldHVybnMge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgZ2V0RGltZW5zaW9uOiBmdW5jdGlvbihlbGVtKSB7XG4gICAgICAgIHZhciB2YWwgPSBlbGVtWzBdLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnZlcnRpY2FsKVxuICAgICAgICAgIGVsZW0ucnpzZCA9ICh2YWwuYm90dG9tIC0gdmFsLnRvcCkgKiB0aGlzLm9wdGlvbnMuc2NhbGU7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBlbGVtLnJ6c2QgPSAodmFsLnJpZ2h0IC0gdmFsLmxlZnQpICogdGhpcy5vcHRpb25zLnNjYWxlO1xuICAgICAgICByZXR1cm4gZWxlbS5yenNkO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQgZWxlbWVudCB3aWR0aC9oZWlnaHQgZGVwZW5kaW5nIG9uIHdoZXRoZXIgc2xpZGVyIGlzIGhvcml6b250YWwgb3IgdmVydGljYWxcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge2pxTGl0ZX0gZWxlbSAgVGhlIGpxTGl0ZSB3cmFwcGVkIERPTSBlbGVtZW50XG4gICAgICAgKiBAcGFyYW0ge251bWJlcn0gZGltXG4gICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICBzZXREaW1lbnNpb246IGZ1bmN0aW9uKGVsZW0sIGRpbSkge1xuICAgICAgICBlbGVtLnJ6c2QgPSBkaW07XG4gICAgICAgIHZhciBjc3MgPSB7fTtcbiAgICAgICAgY3NzW3RoaXMuZGltZW5zaW9uUHJvcGVydHldID0gTWF0aC5yb3VuZChkaW0pICsgJ3B4JztcbiAgICAgICAgZWxlbS5jc3MoY3NzKTtcbiAgICAgICAgcmV0dXJuIGRpbTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogUmV0dXJucyBhIHZhbHVlIHRoYXQgaXMgd2l0aGluIHNsaWRlciByYW5nZVxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWxcbiAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHNhbml0aXplVmFsdWU6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICByZXR1cm4gTWF0aC5taW4oTWF0aC5tYXgodmFsLCB0aGlzLm1pblZhbHVlKSwgdGhpcy5tYXhWYWx1ZSk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIFRyYW5zbGF0ZSB2YWx1ZSB0byBwaXhlbCBwb3NpdGlvblxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSB2YWxcbiAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHZhbHVlVG9Qb3NpdGlvbjogZnVuY3Rpb24odmFsKSB7XG4gICAgICAgIHZhciBmbiA9IHRoaXMubGluZWFyVmFsdWVUb1Bvc2l0aW9uO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmN1c3RvbVZhbHVlVG9Qb3NpdGlvbilcbiAgICAgICAgICBmbiA9IHRoaXMub3B0aW9ucy5jdXN0b21WYWx1ZVRvUG9zaXRpb247XG4gICAgICAgIGVsc2UgaWYgKHRoaXMub3B0aW9ucy5sb2dTY2FsZSlcbiAgICAgICAgICBmbiA9IHRoaXMubG9nVmFsdWVUb1Bvc2l0aW9uO1xuXG4gICAgICAgIHZhbCA9IHRoaXMuc2FuaXRpemVWYWx1ZSh2YWwpO1xuICAgICAgICB2YXIgcGVyY2VudCA9IGZuKHZhbCwgdGhpcy5taW5WYWx1ZSwgdGhpcy5tYXhWYWx1ZSkgfHwgMDtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdClcbiAgICAgICAgICBwZXJjZW50ID0gMSAtIHBlcmNlbnQ7XG4gICAgICAgIHJldHVybiBwZXJjZW50ICogdGhpcy5tYXhQb3M7XG4gICAgICB9LFxuXG4gICAgICBsaW5lYXJWYWx1ZVRvUG9zaXRpb246IGZ1bmN0aW9uKHZhbCwgbWluVmFsLCBtYXhWYWwpIHtcbiAgICAgICAgdmFyIHJhbmdlID0gbWF4VmFsIC0gbWluVmFsO1xuICAgICAgICByZXR1cm4gKHZhbCAtIG1pblZhbCkgLyByYW5nZTtcbiAgICAgIH0sXG5cbiAgICAgIGxvZ1ZhbHVlVG9Qb3NpdGlvbjogZnVuY3Rpb24odmFsLCBtaW5WYWwsIG1heFZhbCkge1xuICAgICAgICB2YWwgPSBNYXRoLmxvZyh2YWwpO1xuICAgICAgICBtaW5WYWwgPSBNYXRoLmxvZyhtaW5WYWwpO1xuICAgICAgICBtYXhWYWwgPSBNYXRoLmxvZyhtYXhWYWwpO1xuICAgICAgICB2YXIgcmFuZ2UgPSBtYXhWYWwgLSBtaW5WYWw7XG4gICAgICAgIHJldHVybiAodmFsIC0gbWluVmFsKSAvIHJhbmdlO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBUcmFuc2xhdGUgcG9zaXRpb24gdG8gbW9kZWwgdmFsdWVcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge251bWJlcn0gcG9zaXRpb25cbiAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIHBvc2l0aW9uVG9WYWx1ZTogZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICAgICAgdmFyIHBlcmNlbnQgPSBwb3NpdGlvbiAvIHRoaXMubWF4UG9zO1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJpZ2h0VG9MZWZ0KVxuICAgICAgICAgIHBlcmNlbnQgPSAxIC0gcGVyY2VudDtcbiAgICAgICAgdmFyIGZuID0gdGhpcy5saW5lYXJQb3NpdGlvblRvVmFsdWU7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuY3VzdG9tUG9zaXRpb25Ub1ZhbHVlKVxuICAgICAgICAgIGZuID0gdGhpcy5vcHRpb25zLmN1c3RvbVBvc2l0aW9uVG9WYWx1ZTtcbiAgICAgICAgZWxzZSBpZiAodGhpcy5vcHRpb25zLmxvZ1NjYWxlKVxuICAgICAgICAgIGZuID0gdGhpcy5sb2dQb3NpdGlvblRvVmFsdWU7XG4gICAgICAgIHJldHVybiBmbihwZXJjZW50LCB0aGlzLm1pblZhbHVlLCB0aGlzLm1heFZhbHVlKSB8fCAwO1xuICAgICAgfSxcblxuICAgICAgbGluZWFyUG9zaXRpb25Ub1ZhbHVlOiBmdW5jdGlvbihwZXJjZW50LCBtaW5WYWwsIG1heFZhbCkge1xuICAgICAgICByZXR1cm4gcGVyY2VudCAqIChtYXhWYWwgLSBtaW5WYWwpICsgbWluVmFsO1xuICAgICAgfSxcblxuICAgICAgbG9nUG9zaXRpb25Ub1ZhbHVlOiBmdW5jdGlvbihwZXJjZW50LCBtaW5WYWwsIG1heFZhbCkge1xuICAgICAgICBtaW5WYWwgPSBNYXRoLmxvZyhtaW5WYWwpO1xuICAgICAgICBtYXhWYWwgPSBNYXRoLmxvZyhtYXhWYWwpO1xuICAgICAgICB2YXIgdmFsdWUgPSBwZXJjZW50ICogKG1heFZhbCAtIG1pblZhbCkgKyBtaW5WYWw7XG4gICAgICAgIHJldHVybiBNYXRoLmV4cCh2YWx1ZSk7XG4gICAgICB9LFxuXG4gICAgICAvLyBFdmVudHNcbiAgICAgIC8qKlxuICAgICAgICogR2V0IHRoZSBYLWNvb3JkaW5hdGUgb3IgWS1jb29yZGluYXRlIG9mIGFuIGV2ZW50XG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtPYmplY3R9IGV2ZW50ICBUaGUgZXZlbnRcbiAgICAgICAqIEByZXR1cm5zIHtudW1iZXJ9XG4gICAgICAgKi9cbiAgICAgIGdldEV2ZW50WFk6IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIC8qIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzEyMzM2MDc1LzI4Mjg4MiAqL1xuICAgICAgICAvL25vaW5zcGVjdGlvbiBKU0xpbnRcbiAgICAgICAgdmFyIGNsaWVudFhZID0gdGhpcy5vcHRpb25zLnZlcnRpY2FsID8gJ2NsaWVudFknIDogJ2NsaWVudFgnO1xuICAgICAgICBpZiAoZXZlbnRbY2xpZW50WFldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICByZXR1cm4gZXZlbnRbY2xpZW50WFldO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGV2ZW50Lm9yaWdpbmFsRXZlbnQgPT09IHVuZGVmaW5lZCA/XG4gICAgICAgICAgZXZlbnQudG91Y2hlc1swXVtjbGllbnRYWV0gOiBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXNbMF1bY2xpZW50WFldO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBDb21wdXRlIHRoZSBldmVudCBwb3NpdGlvbiBkZXBlbmRpbmcgb24gd2hldGhlciB0aGUgc2xpZGVyIGlzIGhvcml6b250YWwgb3IgdmVydGljYWxcbiAgICAgICAqIEBwYXJhbSBldmVudFxuICAgICAgICogQHJldHVybnMge251bWJlcn1cbiAgICAgICAqL1xuICAgICAgZ2V0RXZlbnRQb3NpdGlvbjogZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdmFyIHNsaWRlclBvcyA9IHRoaXMuc2xpZGVyRWxlbS5yenNwLFxuICAgICAgICAgIGV2ZW50UG9zID0gMDtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy52ZXJ0aWNhbClcbiAgICAgICAgICBldmVudFBvcyA9IC10aGlzLmdldEV2ZW50WFkoZXZlbnQpICsgc2xpZGVyUG9zO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgZXZlbnRQb3MgPSB0aGlzLmdldEV2ZW50WFkoZXZlbnQpIC0gc2xpZGVyUG9zO1xuICAgICAgICByZXR1cm4gZXZlbnRQb3MgKiB0aGlzLm9wdGlvbnMuc2NhbGUgLSB0aGlzLmhhbmRsZUhhbGZEaW07IC8vICMzNDYgaGFuZGxlSGFsZkRpbSBpcyBhbHJlYWR5IHNjYWxlZFxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBHZXQgZXZlbnQgbmFtZXMgZm9yIG1vdmUgYW5kIGV2ZW50IGVuZFxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7RXZlbnR9ICAgIGV2ZW50ICAgIFRoZSBldmVudFxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm4ge3ttb3ZlRXZlbnQ6IHN0cmluZywgZW5kRXZlbnQ6IHN0cmluZ319XG4gICAgICAgKi9cbiAgICAgIGdldEV2ZW50TmFtZXM6IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIHZhciBldmVudE5hbWVzID0ge1xuICAgICAgICAgIG1vdmVFdmVudDogJycsXG4gICAgICAgICAgZW5kRXZlbnQ6ICcnXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGV2ZW50LnRvdWNoZXMgfHwgKGV2ZW50Lm9yaWdpbmFsRXZlbnQgIT09IHVuZGVmaW5lZCAmJiBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXMpKSB7XG4gICAgICAgICAgZXZlbnROYW1lcy5tb3ZlRXZlbnQgPSAndG91Y2htb3ZlJztcbiAgICAgICAgICBldmVudE5hbWVzLmVuZEV2ZW50ID0gJ3RvdWNoZW5kJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBldmVudE5hbWVzLm1vdmVFdmVudCA9ICdtb3VzZW1vdmUnO1xuICAgICAgICAgIGV2ZW50TmFtZXMuZW5kRXZlbnQgPSAnbW91c2V1cCc7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZXZlbnROYW1lcztcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogR2V0IHRoZSBoYW5kbGUgY2xvc2VzdCB0byBhbiBldmVudC5cbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gZXZlbnQge0V2ZW50fSBUaGUgZXZlbnRcbiAgICAgICAqIEByZXR1cm5zIHtqcUxpdGV9IFRoZSBoYW5kbGUgY2xvc2VzdCB0byB0aGUgZXZlbnQuXG4gICAgICAgKi9cbiAgICAgIGdldE5lYXJlc3RIYW5kbGU6IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmICghdGhpcy5yYW5nZSkge1xuICAgICAgICAgIHJldHVybiB0aGlzLm1pbkg7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHBvc2l0aW9uID0gdGhpcy5nZXRFdmVudFBvc2l0aW9uKGV2ZW50KSxcbiAgICAgICAgICBkaXN0YW5jZU1pbiA9IE1hdGguYWJzKHBvc2l0aW9uIC0gdGhpcy5taW5ILnJ6c3ApLFxuICAgICAgICAgIGRpc3RhbmNlTWF4ID0gTWF0aC5hYnMocG9zaXRpb24gLSB0aGlzLm1heEgucnpzcCk7XG4gICAgICAgIGlmIChkaXN0YW5jZU1pbiA8IGRpc3RhbmNlTWF4KVxuICAgICAgICAgIHJldHVybiB0aGlzLm1pbkg7XG4gICAgICAgIGVsc2UgaWYgKGRpc3RhbmNlTWluID4gZGlzdGFuY2VNYXgpXG4gICAgICAgICAgcmV0dXJuIHRoaXMubWF4SDtcbiAgICAgICAgZWxzZSBpZiAoIXRoaXMub3B0aW9ucy5yaWdodFRvTGVmdClcbiAgICAgICAgLy9pZiBldmVudCBpcyBhdCB0aGUgc2FtZSBkaXN0YW5jZSBmcm9tIG1pbi9tYXggdGhlbiBpZiBpdCdzIGF0IGxlZnQgb2YgbWluSCwgd2UgcmV0dXJuIG1pbkggZWxzZSBtYXhIXG4gICAgICAgICAgcmV0dXJuIHBvc2l0aW9uIDwgdGhpcy5taW5ILnJ6c3AgPyB0aGlzLm1pbkggOiB0aGlzLm1heEg7XG4gICAgICAgIGVsc2VcbiAgICAgICAgLy9yZXZlcnNlIGluIHJ0bFxuICAgICAgICAgIHJldHVybiBwb3NpdGlvbiA+IHRoaXMubWluSC5yenNwID8gdGhpcy5taW5IIDogdGhpcy5tYXhIO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBXcmFwcGVyIGZ1bmN0aW9uIHRvIGZvY3VzIGFuIGFuZ3VsYXIgZWxlbWVudFxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSBlbCB7QW5ndWxhckVsZW1lbnR9IHRoZSBlbGVtZW50IHRvIGZvY3VzXG4gICAgICAgKi9cbiAgICAgIGZvY3VzRWxlbWVudDogZnVuY3Rpb24oZWwpIHtcbiAgICAgICAgdmFyIERPTV9FTEVNRU5UID0gMDtcbiAgICAgICAgZWxbRE9NX0VMRU1FTlRdLmZvY3VzKCk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEJpbmQgbW91c2UgYW5kIHRvdWNoIGV2ZW50cyB0byBzbGlkZXIgaGFuZGxlc1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIGJpbmRFdmVudHM6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgYmFyVHJhY2tpbmcsIGJhclN0YXJ0LCBiYXJNb3ZlO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZHJhZ2dhYmxlUmFuZ2UpIHtcbiAgICAgICAgICBiYXJUcmFja2luZyA9ICdyelNsaWRlckRyYWcnO1xuICAgICAgICAgIGJhclN0YXJ0ID0gdGhpcy5vbkRyYWdTdGFydDtcbiAgICAgICAgICBiYXJNb3ZlID0gdGhpcy5vbkRyYWdNb3ZlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGJhclRyYWNraW5nID0gJ2xvd1ZhbHVlJztcbiAgICAgICAgICBiYXJTdGFydCA9IHRoaXMub25TdGFydDtcbiAgICAgICAgICBiYXJNb3ZlID0gdGhpcy5vbk1vdmU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMub3B0aW9ucy5vbmx5QmluZEhhbmRsZXMpIHtcbiAgICAgICAgICB0aGlzLnNlbEJhci5vbignbW91c2Vkb3duJywgYW5ndWxhci5iaW5kKHRoaXMsIGJhclN0YXJ0LCBudWxsLCBiYXJUcmFja2luZykpO1xuICAgICAgICAgIHRoaXMuc2VsQmFyLm9uKCdtb3VzZWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgYmFyTW92ZSwgdGhpcy5zZWxCYXIpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuZHJhZ2dhYmxlUmFuZ2VPbmx5KSB7XG4gICAgICAgICAgdGhpcy5taW5ILm9uKCdtb3VzZWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgYmFyU3RhcnQsIG51bGwsIGJhclRyYWNraW5nKSk7XG4gICAgICAgICAgdGhpcy5tYXhILm9uKCdtb3VzZWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgYmFyU3RhcnQsIG51bGwsIGJhclRyYWNraW5nKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5taW5ILm9uKCdtb3VzZWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblN0YXJ0LCB0aGlzLm1pbkgsICdsb3dWYWx1ZScpKTtcbiAgICAgICAgICBpZiAodGhpcy5yYW5nZSkge1xuICAgICAgICAgICAgdGhpcy5tYXhILm9uKCdtb3VzZWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblN0YXJ0LCB0aGlzLm1heEgsICdoaWdoVmFsdWUnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghdGhpcy5vcHRpb25zLm9ubHlCaW5kSGFuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5mdWxsQmFyLm9uKCdtb3VzZWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblN0YXJ0LCBudWxsLCBudWxsKSk7XG4gICAgICAgICAgICB0aGlzLmZ1bGxCYXIub24oJ21vdXNlZG93bicsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uTW92ZSwgdGhpcy5mdWxsQmFyKSk7XG4gICAgICAgICAgICB0aGlzLnRpY2tzLm9uKCdtb3VzZWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblN0YXJ0LCBudWxsLCBudWxsKSk7XG4gICAgICAgICAgICB0aGlzLnRpY2tzLm9uKCdtb3VzZWRvd24nLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblRpY2tDbGljaywgdGhpcy50aWNrcykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy5vcHRpb25zLm9ubHlCaW5kSGFuZGxlcykge1xuICAgICAgICAgIHRoaXMuc2VsQmFyLm9uKCd0b3VjaHN0YXJ0JywgYW5ndWxhci5iaW5kKHRoaXMsIGJhclN0YXJ0LCBudWxsLCBiYXJUcmFja2luZykpO1xuICAgICAgICAgIHRoaXMuc2VsQmFyLm9uKCd0b3VjaHN0YXJ0JywgYW5ndWxhci5iaW5kKHRoaXMsIGJhck1vdmUsIHRoaXMuc2VsQmFyKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5kcmFnZ2FibGVSYW5nZU9ubHkpIHtcbiAgICAgICAgICB0aGlzLm1pbkgub24oJ3RvdWNoc3RhcnQnLCBhbmd1bGFyLmJpbmQodGhpcywgYmFyU3RhcnQsIG51bGwsIGJhclRyYWNraW5nKSk7XG4gICAgICAgICAgdGhpcy5tYXhILm9uKCd0b3VjaHN0YXJ0JywgYW5ndWxhci5iaW5kKHRoaXMsIGJhclN0YXJ0LCBudWxsLCBiYXJUcmFja2luZykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMubWluSC5vbigndG91Y2hzdGFydCcsIGFuZ3VsYXIuYmluZCh0aGlzLCB0aGlzLm9uU3RhcnQsIHRoaXMubWluSCwgJ2xvd1ZhbHVlJykpO1xuICAgICAgICAgIGlmICh0aGlzLnJhbmdlKSB7XG4gICAgICAgICAgICB0aGlzLm1heEgub24oJ3RvdWNoc3RhcnQnLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblN0YXJ0LCB0aGlzLm1heEgsICdoaWdoVmFsdWUnKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghdGhpcy5vcHRpb25zLm9ubHlCaW5kSGFuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5mdWxsQmFyLm9uKCd0b3VjaHN0YXJ0JywgYW5ndWxhci5iaW5kKHRoaXMsIHRoaXMub25TdGFydCwgbnVsbCwgbnVsbCkpO1xuICAgICAgICAgICAgdGhpcy5mdWxsQmFyLm9uKCd0b3VjaHN0YXJ0JywgYW5ndWxhci5iaW5kKHRoaXMsIHRoaXMub25Nb3ZlLCB0aGlzLmZ1bGxCYXIpKTtcbiAgICAgICAgICAgIHRoaXMudGlja3Mub24oJ3RvdWNoc3RhcnQnLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblN0YXJ0LCBudWxsLCBudWxsKSk7XG4gICAgICAgICAgICB0aGlzLnRpY2tzLm9uKCd0b3VjaHN0YXJ0JywgYW5ndWxhci5iaW5kKHRoaXMsIHRoaXMub25UaWNrQ2xpY2ssIHRoaXMudGlja3MpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmtleWJvYXJkU3VwcG9ydCkge1xuICAgICAgICAgIHRoaXMubWluSC5vbignZm9jdXMnLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblBvaW50ZXJGb2N1cywgdGhpcy5taW5ILCAnbG93VmFsdWUnKSk7XG4gICAgICAgICAgaWYgKHRoaXMucmFuZ2UpIHtcbiAgICAgICAgICAgIHRoaXMubWF4SC5vbignZm9jdXMnLCBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5vblBvaW50ZXJGb2N1cywgdGhpcy5tYXhILCAnaGlnaFZhbHVlJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBVbmJpbmQgbW91c2UgYW5kIHRvdWNoIGV2ZW50cyB0byBzbGlkZXIgaGFuZGxlc1xuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIHVuYmluZEV2ZW50czogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMubWluSC5vZmYoKTtcbiAgICAgICAgdGhpcy5tYXhILm9mZigpO1xuICAgICAgICB0aGlzLmZ1bGxCYXIub2ZmKCk7XG4gICAgICAgIHRoaXMuc2VsQmFyLm9mZigpO1xuICAgICAgICB0aGlzLnRpY2tzLm9mZigpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBvblN0YXJ0IGV2ZW50IGhhbmRsZXJcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gez9PYmplY3R9IHBvaW50ZXIgVGhlIGpxTGl0ZSB3cmFwcGVkIERPTSBlbGVtZW50OyBpZiBudWxsLCB0aGUgY2xvc2VzdCBoYW5kbGUgaXMgdXNlZFxuICAgICAgICogQHBhcmFtIHs/c3RyaW5nfSByZWYgICAgIFRoZSBuYW1lIG9mIHRoZSBoYW5kbGUgYmVpbmcgY2hhbmdlZDsgaWYgbnVsbCwgdGhlIGNsb3Nlc3QgaGFuZGxlJ3MgdmFsdWUgaXMgbW9kaWZpZWRcbiAgICAgICAqIEBwYXJhbSB7RXZlbnR9ICAgZXZlbnQgICBUaGUgZXZlbnRcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIG9uU3RhcnQ6IGZ1bmN0aW9uKHBvaW50ZXIsIHJlZiwgZXZlbnQpIHtcbiAgICAgICAgdmFyIGVoTW92ZSwgZWhFbmQsXG4gICAgICAgICAgZXZlbnROYW1lcyA9IHRoaXMuZ2V0RXZlbnROYW1lcyhldmVudCk7XG5cbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgLy8gV2UgaGF2ZSB0byBkbyB0aGlzIGluIGNhc2UgdGhlIEhUTUwgd2hlcmUgdGhlIHNsaWRlcnMgYXJlIG9uXG4gICAgICAgIC8vIGhhdmUgYmVlbiBhbmltYXRlZCBpbnRvIHZpZXcuXG4gICAgICAgIHRoaXMuY2FsY1ZpZXdEaW1lbnNpb25zKCk7XG5cbiAgICAgICAgaWYgKHBvaW50ZXIpIHtcbiAgICAgICAgICB0aGlzLnRyYWNraW5nID0gcmVmO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBvaW50ZXIgPSB0aGlzLmdldE5lYXJlc3RIYW5kbGUoZXZlbnQpO1xuICAgICAgICAgIHRoaXMudHJhY2tpbmcgPSBwb2ludGVyID09PSB0aGlzLm1pbkggPyAnbG93VmFsdWUnIDogJ2hpZ2hWYWx1ZSc7XG4gICAgICAgIH1cblxuICAgICAgICBwb2ludGVyLmFkZENsYXNzKCdyei1hY3RpdmUnKTtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmtleWJvYXJkU3VwcG9ydClcbiAgICAgICAgICB0aGlzLmZvY3VzRWxlbWVudChwb2ludGVyKTtcblxuICAgICAgICBlaE1vdmUgPSBhbmd1bGFyLmJpbmQodGhpcywgdGhpcy5kcmFnZ2luZy5hY3RpdmUgPyB0aGlzLm9uRHJhZ01vdmUgOiB0aGlzLm9uTW92ZSwgcG9pbnRlcik7XG4gICAgICAgIGVoRW5kID0gYW5ndWxhci5iaW5kKHRoaXMsIHRoaXMub25FbmQsIGVoTW92ZSk7XG5cbiAgICAgICAgJGRvY3VtZW50Lm9uKGV2ZW50TmFtZXMubW92ZUV2ZW50LCBlaE1vdmUpO1xuICAgICAgICAkZG9jdW1lbnQub25lKGV2ZW50TmFtZXMuZW5kRXZlbnQsIGVoRW5kKTtcbiAgICAgICAgdGhpcy5jYWxsT25TdGFydCgpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBvbk1vdmUgZXZlbnQgaGFuZGxlclxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7anFMaXRlfSBwb2ludGVyXG4gICAgICAgKiBAcGFyYW0ge0V2ZW50fSAgZXZlbnQgVGhlIGV2ZW50XG4gICAgICAgKiBAcGFyYW0ge2Jvb2xlYW59ICBmcm9tVGljayBpZiB0aGUgZXZlbnQgb2NjdXJlZCBvbiBhIHRpY2sgb3Igbm90XG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICBvbk1vdmU6IGZ1bmN0aW9uKHBvaW50ZXIsIGV2ZW50LCBmcm9tVGljaykge1xuICAgICAgICB2YXIgbmV3UG9zID0gdGhpcy5nZXRFdmVudFBvc2l0aW9uKGV2ZW50KSxcbiAgICAgICAgICBuZXdWYWx1ZSxcbiAgICAgICAgICBjZWlsVmFsdWUgPSB0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQgPyB0aGlzLm1pblZhbHVlIDogdGhpcy5tYXhWYWx1ZSxcbiAgICAgICAgICBmbHJWYWx1ZSA9IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCA/IHRoaXMubWF4VmFsdWUgOiB0aGlzLm1pblZhbHVlO1xuXG4gICAgICAgIGlmIChuZXdQb3MgPD0gMCkge1xuICAgICAgICAgIG5ld1ZhbHVlID0gZmxyVmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAobmV3UG9zID49IHRoaXMubWF4UG9zKSB7XG4gICAgICAgICAgbmV3VmFsdWUgPSBjZWlsVmFsdWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3VmFsdWUgPSB0aGlzLnBvc2l0aW9uVG9WYWx1ZShuZXdQb3MpO1xuICAgICAgICAgIGlmIChmcm9tVGljayAmJiBhbmd1bGFyLmlzTnVtYmVyKHRoaXMub3B0aW9ucy5zaG93VGlja3MpKVxuICAgICAgICAgICAgbmV3VmFsdWUgPSB0aGlzLnJvdW5kU3RlcChuZXdWYWx1ZSwgdGhpcy5vcHRpb25zLnNob3dUaWNrcyk7XG4gICAgICAgICAgZWxzZVxuICAgICAgICAgICAgbmV3VmFsdWUgPSB0aGlzLnJvdW5kU3RlcChuZXdWYWx1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wb3NpdGlvblRyYWNraW5nSGFuZGxlKG5ld1ZhbHVlKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogb25FbmQgZXZlbnQgaGFuZGxlclxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7RXZlbnR9ICAgIGV2ZW50ICAgIFRoZSBldmVudFxuICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZWhNb3ZlICAgVGhlIHRoZSBib3VuZCBtb3ZlIGV2ZW50IGhhbmRsZXJcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIG9uRW5kOiBmdW5jdGlvbihlaE1vdmUsIGV2ZW50KSB7XG4gICAgICAgIHZhciBtb3ZlRXZlbnROYW1lID0gdGhpcy5nZXRFdmVudE5hbWVzKGV2ZW50KS5tb3ZlRXZlbnQ7XG5cbiAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMua2V5Ym9hcmRTdXBwb3J0KSB7XG4gICAgICAgICAgdGhpcy5taW5ILnJlbW92ZUNsYXNzKCdyei1hY3RpdmUnKTtcbiAgICAgICAgICB0aGlzLm1heEgucmVtb3ZlQ2xhc3MoJ3J6LWFjdGl2ZScpO1xuICAgICAgICAgIHRoaXMudHJhY2tpbmcgPSAnJztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRyYWdnaW5nLmFjdGl2ZSA9IGZhbHNlO1xuXG4gICAgICAgICRkb2N1bWVudC5vZmYobW92ZUV2ZW50TmFtZSwgZWhNb3ZlKTtcbiAgICAgICAgdGhpcy5jYWxsT25FbmQoKTtcbiAgICAgIH0sXG5cbiAgICAgIG9uVGlja0NsaWNrOiBmdW5jdGlvbihwb2ludGVyLCBldmVudCkge1xuICAgICAgICB0aGlzLm9uTW92ZShwb2ludGVyLCBldmVudCwgdHJ1ZSk7XG4gICAgICB9LFxuXG4gICAgICBvblBvaW50ZXJGb2N1czogZnVuY3Rpb24ocG9pbnRlciwgcmVmKSB7XG4gICAgICAgIHRoaXMudHJhY2tpbmcgPSByZWY7XG4gICAgICAgIHBvaW50ZXIub25lKCdibHVyJywgYW5ndWxhci5iaW5kKHRoaXMsIHRoaXMub25Qb2ludGVyQmx1ciwgcG9pbnRlcikpO1xuICAgICAgICBwb2ludGVyLm9uKCdrZXlkb3duJywgYW5ndWxhci5iaW5kKHRoaXMsIHRoaXMub25LZXlib2FyZEV2ZW50KSk7XG4gICAgICAgIHBvaW50ZXIub24oJ2tleXVwJywgYW5ndWxhci5iaW5kKHRoaXMsIHRoaXMub25LZXlVcCkpO1xuICAgICAgICB0aGlzLmZpcnN0S2V5RG93biA9IHRydWU7XG4gICAgICAgIHBvaW50ZXIuYWRkQ2xhc3MoJ3J6LWFjdGl2ZScpO1xuXG4gICAgICAgIHRoaXMuY3VycmVudEZvY3VzRWxlbWVudCA9IHtcbiAgICAgICAgICBwb2ludGVyOiBwb2ludGVyLFxuICAgICAgICAgIHJlZjogcmVmXG4gICAgICAgIH07XG4gICAgICB9LFxuXG4gICAgICBvbktleVVwOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdGhpcy5maXJzdEtleURvd24gPSB0cnVlO1xuICAgICAgICB0aGlzLmNhbGxPbkVuZCgpO1xuICAgICAgfSxcblxuICAgICAgb25Qb2ludGVyQmx1cjogZnVuY3Rpb24ocG9pbnRlcikge1xuICAgICAgICBwb2ludGVyLm9mZigna2V5ZG93bicpO1xuICAgICAgICBwb2ludGVyLm9mZigna2V5dXAnKTtcbiAgICAgICAgdGhpcy50cmFja2luZyA9ICcnO1xuICAgICAgICBwb2ludGVyLnJlbW92ZUNsYXNzKCdyei1hY3RpdmUnKTtcbiAgICAgICAgdGhpcy5jdXJyZW50Rm9jdXNFbGVtZW50ID0gbnVsbFxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBLZXkgYWN0aW9ucyBoZWxwZXIgZnVuY3Rpb25cbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0ge251bWJlcn0gY3VycmVudFZhbHVlIHZhbHVlIG9mIHRoZSBzbGlkZXJcbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7P09iamVjdH0gYWN0aW9uIHZhbHVlIG1hcHBpbmdzXG4gICAgICAgKi9cbiAgICAgIGdldEtleUFjdGlvbnM6IGZ1bmN0aW9uKGN1cnJlbnRWYWx1ZSkge1xuICAgICAgICB2YXIgaW5jcmVhc2VTdGVwID0gY3VycmVudFZhbHVlICsgdGhpcy5zdGVwLFxuICAgICAgICAgIGRlY3JlYXNlU3RlcCA9IGN1cnJlbnRWYWx1ZSAtIHRoaXMuc3RlcCxcbiAgICAgICAgICBpbmNyZWFzZVBhZ2UgPSBjdXJyZW50VmFsdWUgKyB0aGlzLnZhbHVlUmFuZ2UgLyAxMCxcbiAgICAgICAgICBkZWNyZWFzZVBhZ2UgPSBjdXJyZW50VmFsdWUgLSB0aGlzLnZhbHVlUmFuZ2UgLyAxMDtcblxuICAgICAgICAvL0xlZnQgdG8gcmlnaHQgZGVmYXVsdCBhY3Rpb25zXG4gICAgICAgIHZhciBhY3Rpb25zID0ge1xuICAgICAgICAgICdVUCc6IGluY3JlYXNlU3RlcCxcbiAgICAgICAgICAnRE9XTic6IGRlY3JlYXNlU3RlcCxcbiAgICAgICAgICAnTEVGVCc6IGRlY3JlYXNlU3RlcCxcbiAgICAgICAgICAnUklHSFQnOiBpbmNyZWFzZVN0ZXAsXG4gICAgICAgICAgJ1BBR0VVUCc6IGluY3JlYXNlUGFnZSxcbiAgICAgICAgICAnUEFHRURPV04nOiBkZWNyZWFzZVBhZ2UsXG4gICAgICAgICAgJ0hPTUUnOiB0aGlzLm1pblZhbHVlLFxuICAgICAgICAgICdFTkQnOiB0aGlzLm1heFZhbHVlXG4gICAgICAgIH07XG4gICAgICAgIC8vcmlnaHQgdG8gbGVmdCBtZWFucyBzd2FwcGluZyByaWdodCBhbmQgbGVmdCBhcnJvd3NcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCkge1xuICAgICAgICAgIGFjdGlvbnMuTEVGVCA9IGluY3JlYXNlU3RlcDtcbiAgICAgICAgICBhY3Rpb25zLlJJR0hUID0gZGVjcmVhc2VTdGVwO1xuICAgICAgICAgIC8vIHJpZ2h0IHRvIGxlZnQgYW5kIHZlcnRpY2FsIG1lYW5zIHdlIGFsc28gc3dhcCB1cCBhbmQgZG93blxuICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMudmVydGljYWwpIHtcbiAgICAgICAgICAgIGFjdGlvbnMuVVAgPSBkZWNyZWFzZVN0ZXA7XG4gICAgICAgICAgICBhY3Rpb25zLkRPV04gPSBpbmNyZWFzZVN0ZXA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhY3Rpb25zO1xuICAgICAgfSxcblxuICAgICAgb25LZXlib2FyZEV2ZW50OiBmdW5jdGlvbihldmVudCkge1xuICAgICAgICB2YXIgY3VycmVudFZhbHVlID0gdGhpc1t0aGlzLnRyYWNraW5nXSxcbiAgICAgICAgICBrZXlDb2RlID0gZXZlbnQua2V5Q29kZSB8fCBldmVudC53aGljaCxcbiAgICAgICAgICBrZXlzID0ge1xuICAgICAgICAgICAgMzg6ICdVUCcsXG4gICAgICAgICAgICA0MDogJ0RPV04nLFxuICAgICAgICAgICAgMzc6ICdMRUZUJyxcbiAgICAgICAgICAgIDM5OiAnUklHSFQnLFxuICAgICAgICAgICAgMzM6ICdQQUdFVVAnLFxuICAgICAgICAgICAgMzQ6ICdQQUdFRE9XTicsXG4gICAgICAgICAgICAzNjogJ0hPTUUnLFxuICAgICAgICAgICAgMzU6ICdFTkQnXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhY3Rpb25zID0gdGhpcy5nZXRLZXlBY3Rpb25zKGN1cnJlbnRWYWx1ZSksXG4gICAgICAgICAga2V5ID0ga2V5c1trZXlDb2RlXSxcbiAgICAgICAgICBhY3Rpb24gPSBhY3Rpb25zW2tleV07XG4gICAgICAgIGlmIChhY3Rpb24gPT0gbnVsbCB8fCB0aGlzLnRyYWNraW5nID09PSAnJykgcmV0dXJuO1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIGlmICh0aGlzLmZpcnN0S2V5RG93bikge1xuICAgICAgICAgIHRoaXMuZmlyc3RLZXlEb3duID0gZmFsc2U7XG4gICAgICAgICAgdGhpcy5jYWxsT25TdGFydCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICAkdGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgICB2YXIgbmV3VmFsdWUgPSBzZWxmLnJvdW5kU3RlcChzZWxmLnNhbml0aXplVmFsdWUoYWN0aW9uKSk7XG4gICAgICAgICAgaWYgKCFzZWxmLm9wdGlvbnMuZHJhZ2dhYmxlUmFuZ2VPbmx5KSB7XG4gICAgICAgICAgICBzZWxmLnBvc2l0aW9uVHJhY2tpbmdIYW5kbGUobmV3VmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHZhciBkaWZmZXJlbmNlID0gc2VsZi5oaWdoVmFsdWUgLSBzZWxmLmxvd1ZhbHVlLFxuICAgICAgICAgICAgICBuZXdNaW5WYWx1ZSwgbmV3TWF4VmFsdWU7XG4gICAgICAgICAgICBpZiAoc2VsZi50cmFja2luZyA9PT0gJ2xvd1ZhbHVlJykge1xuICAgICAgICAgICAgICBuZXdNaW5WYWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgICBuZXdNYXhWYWx1ZSA9IG5ld1ZhbHVlICsgZGlmZmVyZW5jZTtcbiAgICAgICAgICAgICAgaWYgKG5ld01heFZhbHVlID4gc2VsZi5tYXhWYWx1ZSkge1xuICAgICAgICAgICAgICAgIG5ld01heFZhbHVlID0gc2VsZi5tYXhWYWx1ZTtcbiAgICAgICAgICAgICAgICBuZXdNaW5WYWx1ZSA9IG5ld01heFZhbHVlIC0gZGlmZmVyZW5jZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgbmV3TWF4VmFsdWUgPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgICAgbmV3TWluVmFsdWUgPSBuZXdWYWx1ZSAtIGRpZmZlcmVuY2U7XG4gICAgICAgICAgICAgIGlmIChuZXdNaW5WYWx1ZSA8IHNlbGYubWluVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBuZXdNaW5WYWx1ZSA9IHNlbGYubWluVmFsdWU7XG4gICAgICAgICAgICAgICAgbmV3TWF4VmFsdWUgPSBuZXdNaW5WYWx1ZSArIGRpZmZlcmVuY2U7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNlbGYucG9zaXRpb25UcmFja2luZ0JhcihuZXdNaW5WYWx1ZSwgbmV3TWF4VmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIG9uRHJhZ1N0YXJ0IGV2ZW50IGhhbmRsZXJcbiAgICAgICAqXG4gICAgICAgKiBIYW5kbGVzIGRyYWdnaW5nIG9mIHRoZSBtaWRkbGUgYmFyLlxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwb2ludGVyIFRoZSBqcUxpdGUgd3JhcHBlZCBET00gZWxlbWVudFxuICAgICAgICogQHBhcmFtIHtzdHJpbmd9IHJlZiAgICAgT25lIG9mIHRoZSByZWZMb3csIHJlZkhpZ2ggdmFsdWVzXG4gICAgICAgKiBAcGFyYW0ge0V2ZW50fSAgZXZlbnQgICBUaGUgZXZlbnRcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIG9uRHJhZ1N0YXJ0OiBmdW5jdGlvbihwb2ludGVyLCByZWYsIGV2ZW50KSB7XG4gICAgICAgIHZhciBwb3NpdGlvbiA9IHRoaXMuZ2V0RXZlbnRQb3NpdGlvbihldmVudCk7XG4gICAgICAgIHRoaXMuZHJhZ2dpbmcgPSB7XG4gICAgICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgICAgIHZhbHVlOiB0aGlzLnBvc2l0aW9uVG9WYWx1ZShwb3NpdGlvbiksXG4gICAgICAgICAgZGlmZmVyZW5jZTogdGhpcy5oaWdoVmFsdWUgLSB0aGlzLmxvd1ZhbHVlLFxuICAgICAgICAgIGxvd0xpbWl0OiB0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQgPyB0aGlzLm1pbkgucnpzcCAtIHBvc2l0aW9uIDogcG9zaXRpb24gLSB0aGlzLm1pbkgucnpzcCxcbiAgICAgICAgICBoaWdoTGltaXQ6IHRoaXMub3B0aW9ucy5yaWdodFRvTGVmdCA/IHBvc2l0aW9uIC0gdGhpcy5tYXhILnJ6c3AgOiB0aGlzLm1heEgucnpzcCAtIHBvc2l0aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5vblN0YXJ0KHBvaW50ZXIsIHJlZiwgZXZlbnQpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBnZXRWYWx1ZSBoZWxwZXIgZnVuY3Rpb25cbiAgICAgICAqXG4gICAgICAgKiBnZXRzIG1heCBvciBtaW4gdmFsdWUgZGVwZW5kaW5nIG9uIHdoZXRoZXIgdGhlIG5ld1BvcyBpcyBvdXRPZkJvdW5kcyBhYm92ZSBvciBiZWxvdyB0aGUgYmFyIGFuZCByaWdodFRvTGVmdFxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlICdtYXgnIHx8ICdtaW4nIFRoZSB2YWx1ZSB3ZSBhcmUgY2FsY3VsYXRpbmdcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuZXdQb3MgIFRoZSBuZXcgcG9zaXRpb25cbiAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gb3V0T2ZCb3VuZHMgSXMgdGhlIG5ldyBwb3NpdGlvbiBhYm92ZSBvciBiZWxvdyB0aGUgbWF4L21pbj9cbiAgICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNBYm92ZSBJcyB0aGUgbmV3IHBvc2l0aW9uIGFib3ZlIHRoZSBiYXIgaWYgb3V0IG9mIGJvdW5kcz9cbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7bnVtYmVyfVxuICAgICAgICovXG4gICAgICBnZXRWYWx1ZTogZnVuY3Rpb24odHlwZSwgbmV3UG9zLCBvdXRPZkJvdW5kcywgaXNBYm92ZSkge1xuICAgICAgICB2YXIgaXNSVEwgPSB0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQsXG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuXG4gICAgICAgIGlmICh0eXBlID09PSAnbWluJykge1xuICAgICAgICAgIGlmIChvdXRPZkJvdW5kcykge1xuICAgICAgICAgICAgaWYgKGlzQWJvdmUpIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBpc1JUTCA/IHRoaXMubWluVmFsdWUgOiB0aGlzLm1heFZhbHVlIC0gdGhpcy5kcmFnZ2luZy5kaWZmZXJlbmNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdmFsdWUgPSBpc1JUTCA/IHRoaXMubWF4VmFsdWUgLSB0aGlzLmRyYWdnaW5nLmRpZmZlcmVuY2UgOiB0aGlzLm1pblZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGlzUlRMID8gdGhpcy5wb3NpdGlvblRvVmFsdWUobmV3UG9zICsgdGhpcy5kcmFnZ2luZy5sb3dMaW1pdCkgOiB0aGlzLnBvc2l0aW9uVG9WYWx1ZShuZXdQb3MgLSB0aGlzLmRyYWdnaW5nLmxvd0xpbWl0KVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAob3V0T2ZCb3VuZHMpIHtcbiAgICAgICAgICAgIGlmIChpc0Fib3ZlKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gaXNSVEwgPyB0aGlzLm1pblZhbHVlICsgdGhpcy5kcmFnZ2luZy5kaWZmZXJlbmNlIDogdGhpcy5tYXhWYWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gaXNSVEwgPyB0aGlzLm1heFZhbHVlIDogdGhpcy5taW5WYWx1ZSArIHRoaXMuZHJhZ2dpbmcuZGlmZmVyZW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGlzUlRMKSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gdGhpcy5wb3NpdGlvblRvVmFsdWUobmV3UG9zICsgdGhpcy5kcmFnZ2luZy5sb3dMaW1pdCkgKyB0aGlzLmRyYWdnaW5nLmRpZmZlcmVuY2VcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHZhbHVlID0gdGhpcy5wb3NpdGlvblRvVmFsdWUobmV3UG9zIC0gdGhpcy5kcmFnZ2luZy5sb3dMaW1pdCkgKyB0aGlzLmRyYWdnaW5nLmRpZmZlcmVuY2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnJvdW5kU3RlcCh2YWx1ZSk7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIG9uRHJhZ01vdmUgZXZlbnQgaGFuZGxlclxuICAgICAgICpcbiAgICAgICAqIEhhbmRsZXMgZHJhZ2dpbmcgb2YgdGhlIG1pZGRsZSBiYXIuXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtqcUxpdGV9IHBvaW50ZXJcbiAgICAgICAqIEBwYXJhbSB7RXZlbnR9ICBldmVudCBUaGUgZXZlbnRcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIG9uRHJhZ01vdmU6IGZ1bmN0aW9uKHBvaW50ZXIsIGV2ZW50KSB7XG4gICAgICAgIHZhciBuZXdQb3MgPSB0aGlzLmdldEV2ZW50UG9zaXRpb24oZXZlbnQpLFxuICAgICAgICAgIG5ld01pblZhbHVlLCBuZXdNYXhWYWx1ZSxcbiAgICAgICAgICBjZWlsTGltaXQsIGZsckxpbWl0LFxuICAgICAgICAgIGlzVW5kZXJGbHJMaW1pdCwgaXNPdmVyQ2VpbExpbWl0LFxuICAgICAgICAgIGZsckgsIGNlaWxIO1xuXG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMucmlnaHRUb0xlZnQpIHtcbiAgICAgICAgICBjZWlsTGltaXQgPSB0aGlzLmRyYWdnaW5nLmxvd0xpbWl0O1xuICAgICAgICAgIGZsckxpbWl0ID0gdGhpcy5kcmFnZ2luZy5oaWdoTGltaXQ7XG4gICAgICAgICAgZmxySCA9IHRoaXMubWF4SDtcbiAgICAgICAgICBjZWlsSCA9IHRoaXMubWluSDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjZWlsTGltaXQgPSB0aGlzLmRyYWdnaW5nLmhpZ2hMaW1pdDtcbiAgICAgICAgICBmbHJMaW1pdCA9IHRoaXMuZHJhZ2dpbmcubG93TGltaXQ7XG4gICAgICAgICAgZmxySCA9IHRoaXMubWluSDtcbiAgICAgICAgICBjZWlsSCA9IHRoaXMubWF4SDtcbiAgICAgICAgfVxuICAgICAgICBpc1VuZGVyRmxyTGltaXQgPSBuZXdQb3MgPD0gZmxyTGltaXQ7XG4gICAgICAgIGlzT3ZlckNlaWxMaW1pdCA9IG5ld1BvcyA+PSB0aGlzLm1heFBvcyAtIGNlaWxMaW1pdDtcblxuICAgICAgICBpZiAoaXNVbmRlckZsckxpbWl0KSB7XG4gICAgICAgICAgaWYgKGZsckgucnpzcCA9PT0gMClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICBuZXdNaW5WYWx1ZSA9IHRoaXMuZ2V0VmFsdWUoJ21pbicsIG5ld1BvcywgdHJ1ZSwgZmFsc2UpO1xuICAgICAgICAgIG5ld01heFZhbHVlID0gdGhpcy5nZXRWYWx1ZSgnbWF4JywgbmV3UG9zLCB0cnVlLCBmYWxzZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNPdmVyQ2VpbExpbWl0KSB7XG4gICAgICAgICAgaWYgKGNlaWxILnJ6c3AgPT09IHRoaXMubWF4UG9zKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIG5ld01heFZhbHVlID0gdGhpcy5nZXRWYWx1ZSgnbWF4JywgbmV3UG9zLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICBuZXdNaW5WYWx1ZSA9IHRoaXMuZ2V0VmFsdWUoJ21pbicsIG5ld1BvcywgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV3TWluVmFsdWUgPSB0aGlzLmdldFZhbHVlKCdtaW4nLCBuZXdQb3MsIGZhbHNlKTtcbiAgICAgICAgICBuZXdNYXhWYWx1ZSA9IHRoaXMuZ2V0VmFsdWUoJ21heCcsIG5ld1BvcywgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucG9zaXRpb25UcmFja2luZ0JhcihuZXdNaW5WYWx1ZSwgbmV3TWF4VmFsdWUpO1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTZXQgdGhlIG5ldyB2YWx1ZSBhbmQgcG9zaXRpb24gZm9yIHRoZSBlbnRpcmUgYmFyXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtudW1iZXJ9IG5ld01pblZhbHVlICAgdGhlIG5ldyBtaW5pbXVtIHZhbHVlXG4gICAgICAgKiBAcGFyYW0ge251bWJlcn0gbmV3TWF4VmFsdWUgICB0aGUgbmV3IG1heGltdW0gdmFsdWVcbiAgICAgICAqL1xuICAgICAgcG9zaXRpb25UcmFja2luZ0JhcjogZnVuY3Rpb24obmV3TWluVmFsdWUsIG5ld01heFZhbHVlKSB7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5taW5MaW1pdCAhPSBudWxsICYmIG5ld01pblZhbHVlIDwgdGhpcy5vcHRpb25zLm1pbkxpbWl0KSB7XG4gICAgICAgICAgbmV3TWluVmFsdWUgPSB0aGlzLm9wdGlvbnMubWluTGltaXQ7XG4gICAgICAgICAgbmV3TWF4VmFsdWUgPSBuZXdNaW5WYWx1ZSArIHRoaXMuZHJhZ2dpbmcuZGlmZmVyZW5jZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLm1heExpbWl0ICE9IG51bGwgJiYgbmV3TWF4VmFsdWUgPiB0aGlzLm9wdGlvbnMubWF4TGltaXQpIHtcbiAgICAgICAgICBuZXdNYXhWYWx1ZSA9IHRoaXMub3B0aW9ucy5tYXhMaW1pdDtcbiAgICAgICAgICBuZXdNaW5WYWx1ZSA9IG5ld01heFZhbHVlIC0gdGhpcy5kcmFnZ2luZy5kaWZmZXJlbmNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb3dWYWx1ZSA9IG5ld01pblZhbHVlO1xuICAgICAgICB0aGlzLmhpZ2hWYWx1ZSA9IG5ld01heFZhbHVlO1xuICAgICAgICB0aGlzLmFwcGx5TG93VmFsdWUoKTtcbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpXG4gICAgICAgICAgdGhpcy5hcHBseUhpZ2hWYWx1ZSgpO1xuICAgICAgICB0aGlzLmFwcGx5TW9kZWwoKTtcbiAgICAgICAgdGhpcy51cGRhdGVIYW5kbGVzKCdsb3dWYWx1ZScsIHRoaXMudmFsdWVUb1Bvc2l0aW9uKG5ld01pblZhbHVlKSk7XG4gICAgICAgIHRoaXMudXBkYXRlSGFuZGxlcygnaGlnaFZhbHVlJywgdGhpcy52YWx1ZVRvUG9zaXRpb24obmV3TWF4VmFsdWUpKTtcbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogU2V0IHRoZSBuZXcgdmFsdWUgYW5kIHBvc2l0aW9uIHRvIHRoZSBjdXJyZW50IHRyYWNraW5nIGhhbmRsZVxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuZXdWYWx1ZSBuZXcgbW9kZWwgdmFsdWVcbiAgICAgICAqL1xuICAgICAgcG9zaXRpb25UcmFja2luZ0hhbmRsZTogZnVuY3Rpb24obmV3VmFsdWUpIHtcbiAgICAgICAgdmFyIHZhbHVlQ2hhbmdlZCA9IGZhbHNlO1xuXG4gICAgICAgIG5ld1ZhbHVlID0gdGhpcy5hcHBseU1pbk1heExpbWl0KG5ld1ZhbHVlKTtcbiAgICAgICAgaWYgKHRoaXMucmFuZ2UpIHtcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnB1c2hSYW5nZSkge1xuICAgICAgICAgICAgbmV3VmFsdWUgPSB0aGlzLmFwcGx5UHVzaFJhbmdlKG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIHZhbHVlQ2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5ub1N3aXRjaGluZykge1xuICAgICAgICAgICAgICBpZiAodGhpcy50cmFja2luZyA9PT0gJ2xvd1ZhbHVlJyAmJiBuZXdWYWx1ZSA+IHRoaXMuaGlnaFZhbHVlKVxuICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gdGhpcy5hcHBseU1pbk1heFJhbmdlKHRoaXMuaGlnaFZhbHVlKTtcbiAgICAgICAgICAgICAgZWxzZSBpZiAodGhpcy50cmFja2luZyA9PT0gJ2hpZ2hWYWx1ZScgJiYgbmV3VmFsdWUgPCB0aGlzLmxvd1ZhbHVlKVxuICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gdGhpcy5hcHBseU1pbk1heFJhbmdlKHRoaXMubG93VmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV3VmFsdWUgPSB0aGlzLmFwcGx5TWluTWF4UmFuZ2UobmV3VmFsdWUpO1xuICAgICAgICAgICAgLyogVGhpcyBpcyB0byBjaGVjayBpZiB3ZSBuZWVkIHRvIHN3aXRjaCB0aGUgbWluIGFuZCBtYXggaGFuZGxlcyAqL1xuICAgICAgICAgICAgaWYgKHRoaXMudHJhY2tpbmcgPT09ICdsb3dWYWx1ZScgJiYgbmV3VmFsdWUgPiB0aGlzLmhpZ2hWYWx1ZSkge1xuICAgICAgICAgICAgICB0aGlzLmxvd1ZhbHVlID0gdGhpcy5oaWdoVmFsdWU7XG4gICAgICAgICAgICAgIHRoaXMuYXBwbHlMb3dWYWx1ZSgpO1xuICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUhhbmRsZXModGhpcy50cmFja2luZywgdGhpcy5tYXhILnJ6c3ApO1xuICAgICAgICAgICAgICB0aGlzLnVwZGF0ZUFyaWFBdHRyaWJ1dGVzKCk7XG4gICAgICAgICAgICAgIHRoaXMudHJhY2tpbmcgPSAnaGlnaFZhbHVlJztcbiAgICAgICAgICAgICAgdGhpcy5taW5ILnJlbW92ZUNsYXNzKCdyei1hY3RpdmUnKTtcbiAgICAgICAgICAgICAgdGhpcy5tYXhILmFkZENsYXNzKCdyei1hY3RpdmUnKTtcbiAgICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5rZXlib2FyZFN1cHBvcnQpXG4gICAgICAgICAgICAgICAgdGhpcy5mb2N1c0VsZW1lbnQodGhpcy5tYXhIKTtcbiAgICAgICAgICAgICAgdmFsdWVDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYgKHRoaXMudHJhY2tpbmcgPT09ICdoaWdoVmFsdWUnICYmIG5ld1ZhbHVlIDwgdGhpcy5sb3dWYWx1ZSkge1xuICAgICAgICAgICAgICB0aGlzLmhpZ2hWYWx1ZSA9IHRoaXMubG93VmFsdWU7XG4gICAgICAgICAgICAgIHRoaXMuYXBwbHlIaWdoVmFsdWUoKTtcbiAgICAgICAgICAgICAgdGhpcy51cGRhdGVIYW5kbGVzKHRoaXMudHJhY2tpbmcsIHRoaXMubWluSC5yenNwKTtcbiAgICAgICAgICAgICAgdGhpcy51cGRhdGVBcmlhQXR0cmlidXRlcygpO1xuICAgICAgICAgICAgICB0aGlzLnRyYWNraW5nID0gJ2xvd1ZhbHVlJztcbiAgICAgICAgICAgICAgdGhpcy5tYXhILnJlbW92ZUNsYXNzKCdyei1hY3RpdmUnKTtcbiAgICAgICAgICAgICAgdGhpcy5taW5ILmFkZENsYXNzKCdyei1hY3RpdmUnKTtcbiAgICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5rZXlib2FyZFN1cHBvcnQpXG4gICAgICAgICAgICAgICAgdGhpcy5mb2N1c0VsZW1lbnQodGhpcy5taW5IKTtcbiAgICAgICAgICAgICAgdmFsdWVDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpc1t0aGlzLnRyYWNraW5nXSAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICB0aGlzW3RoaXMudHJhY2tpbmddID0gbmV3VmFsdWU7XG4gICAgICAgICAgaWYgKHRoaXMudHJhY2tpbmcgPT09ICdsb3dWYWx1ZScpXG4gICAgICAgICAgICB0aGlzLmFwcGx5TG93VmFsdWUoKTtcbiAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLmFwcGx5SGlnaFZhbHVlKCk7XG4gICAgICAgICAgdGhpcy51cGRhdGVIYW5kbGVzKHRoaXMudHJhY2tpbmcsIHRoaXMudmFsdWVUb1Bvc2l0aW9uKG5ld1ZhbHVlKSk7XG4gICAgICAgICAgdGhpcy51cGRhdGVBcmlhQXR0cmlidXRlcygpO1xuICAgICAgICAgIHZhbHVlQ2hhbmdlZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWVDaGFuZ2VkKVxuICAgICAgICAgIHRoaXMuYXBwbHlNb2RlbCgpO1xuICAgICAgfSxcblxuICAgICAgYXBwbHlNaW5NYXhMaW1pdDogZnVuY3Rpb24obmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5taW5MaW1pdCAhPSBudWxsICYmIG5ld1ZhbHVlIDwgdGhpcy5vcHRpb25zLm1pbkxpbWl0KVxuICAgICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMubWluTGltaXQ7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMubWF4TGltaXQgIT0gbnVsbCAmJiBuZXdWYWx1ZSA+IHRoaXMub3B0aW9ucy5tYXhMaW1pdClcbiAgICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLm1heExpbWl0O1xuICAgICAgICByZXR1cm4gbmV3VmFsdWU7XG4gICAgICB9LFxuXG4gICAgICBhcHBseU1pbk1heFJhbmdlOiBmdW5jdGlvbihuZXdWYWx1ZSkge1xuICAgICAgICB2YXIgb3Bwb3NpdGVWYWx1ZSA9IHRoaXMudHJhY2tpbmcgPT09ICdsb3dWYWx1ZScgPyB0aGlzLmhpZ2hWYWx1ZSA6IHRoaXMubG93VmFsdWUsXG4gICAgICAgICAgZGlmZmVyZW5jZSA9IE1hdGguYWJzKG5ld1ZhbHVlIC0gb3Bwb3NpdGVWYWx1ZSk7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMubWluUmFuZ2UgIT0gbnVsbCkge1xuICAgICAgICAgIGlmIChkaWZmZXJlbmNlIDwgdGhpcy5vcHRpb25zLm1pblJhbmdlKSB7XG4gICAgICAgICAgICBpZiAodGhpcy50cmFja2luZyA9PT0gJ2xvd1ZhbHVlJylcbiAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaGlnaFZhbHVlIC0gdGhpcy5vcHRpb25zLm1pblJhbmdlO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5sb3dWYWx1ZSArIHRoaXMub3B0aW9ucy5taW5SYW5nZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5tYXhSYW5nZSAhPSBudWxsKSB7XG4gICAgICAgICAgaWYgKGRpZmZlcmVuY2UgPiB0aGlzLm9wdGlvbnMubWF4UmFuZ2UpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnRyYWNraW5nID09PSAnbG93VmFsdWUnKVxuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5oaWdoVmFsdWUgLSB0aGlzLm9wdGlvbnMubWF4UmFuZ2U7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIHJldHVybiB0aGlzLmxvd1ZhbHVlICsgdGhpcy5vcHRpb25zLm1heFJhbmdlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3VmFsdWU7XG4gICAgICB9LFxuXG4gICAgICBhcHBseVB1c2hSYW5nZTogZnVuY3Rpb24obmV3VmFsdWUpIHtcbiAgICAgICAgdmFyIGRpZmZlcmVuY2UgPSB0aGlzLnRyYWNraW5nID09PSAnbG93VmFsdWUnID8gdGhpcy5oaWdoVmFsdWUgLSBuZXdWYWx1ZSA6IG5ld1ZhbHVlIC0gdGhpcy5sb3dWYWx1ZSxcbiAgICAgICAgICBtaW5SYW5nZSA9IHRoaXMub3B0aW9ucy5taW5SYW5nZSAhPT0gbnVsbCA/IHRoaXMub3B0aW9ucy5taW5SYW5nZSA6IHRoaXMub3B0aW9ucy5zdGVwLFxuICAgICAgICAgIG1heFJhbmdlID0gdGhpcy5vcHRpb25zLm1heFJhbmdlO1xuICAgICAgICAvLyBpZiBzbWFsbGVyIHRoYW4gbWluUmFuZ2VcbiAgICAgICAgaWYgKGRpZmZlcmVuY2UgPCBtaW5SYW5nZSkge1xuICAgICAgICAgIGlmICh0aGlzLnRyYWNraW5nID09PSAnbG93VmFsdWUnKSB7XG4gICAgICAgICAgICB0aGlzLmhpZ2hWYWx1ZSA9IE1hdGgubWluKG5ld1ZhbHVlICsgbWluUmFuZ2UsIHRoaXMubWF4VmFsdWUpO1xuICAgICAgICAgICAgbmV3VmFsdWUgPSB0aGlzLmhpZ2hWYWx1ZSAtIG1pblJhbmdlO1xuICAgICAgICAgICAgdGhpcy5hcHBseUhpZ2hWYWx1ZSgpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVIYW5kbGVzKCdoaWdoVmFsdWUnLCB0aGlzLnZhbHVlVG9Qb3NpdGlvbih0aGlzLmhpZ2hWYWx1ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMubG93VmFsdWUgPSBNYXRoLm1heChuZXdWYWx1ZSAtIG1pblJhbmdlLCB0aGlzLm1pblZhbHVlKTtcbiAgICAgICAgICAgIG5ld1ZhbHVlID0gdGhpcy5sb3dWYWx1ZSArIG1pblJhbmdlO1xuICAgICAgICAgICAgdGhpcy5hcHBseUxvd1ZhbHVlKCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUhhbmRsZXMoJ2xvd1ZhbHVlJywgdGhpcy52YWx1ZVRvUG9zaXRpb24odGhpcy5sb3dWYWx1ZSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLnVwZGF0ZUFyaWFBdHRyaWJ1dGVzKCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgZ3JlYXRlciB0aGFuIG1heFJhbmdlXG4gICAgICAgIGVsc2UgaWYgKG1heFJhbmdlICE9PSBudWxsICYmIGRpZmZlcmVuY2UgPiBtYXhSYW5nZSkge1xuICAgICAgICAgIGlmICh0aGlzLnRyYWNraW5nID09PSAnbG93VmFsdWUnKSB7XG4gICAgICAgICAgICB0aGlzLmhpZ2hWYWx1ZSA9IG5ld1ZhbHVlICsgbWF4UmFuZ2U7XG4gICAgICAgICAgICB0aGlzLmFwcGx5SGlnaFZhbHVlKCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUhhbmRsZXMoJ2hpZ2hWYWx1ZScsIHRoaXMudmFsdWVUb1Bvc2l0aW9uKHRoaXMuaGlnaFZhbHVlKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5sb3dWYWx1ZSA9IG5ld1ZhbHVlIC0gbWF4UmFuZ2U7XG4gICAgICAgICAgICB0aGlzLmFwcGx5TG93VmFsdWUoKTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlSGFuZGxlcygnbG93VmFsdWUnLCB0aGlzLnZhbHVlVG9Qb3NpdGlvbih0aGlzLmxvd1ZhbHVlKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMudXBkYXRlQXJpYUF0dHJpYnV0ZXMoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3VmFsdWU7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIEFwcGx5IHRoZSBtb2RlbCB2YWx1ZXMgdXNpbmcgc2NvcGUuJGFwcGx5LlxuICAgICAgICogV2Ugd3JhcCBpdCB3aXRoIHRoZSBpbnRlcm5hbENoYW5nZSBmbGFnIHRvIGF2b2lkIHRoZSB3YXRjaGVycyB0byBiZSBjYWxsZWRcbiAgICAgICAqL1xuICAgICAgYXBwbHlNb2RlbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuaW50ZXJuYWxDaGFuZ2UgPSB0cnVlO1xuICAgICAgICB0aGlzLnNjb3BlLiRhcHBseSgpO1xuICAgICAgICB0aGlzLmNhbGxPbkNoYW5nZSgpO1xuICAgICAgICB0aGlzLmludGVybmFsQ2hhbmdlID0gZmFsc2U7XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENhbGwgdGhlIG9uU3RhcnQgY2FsbGJhY2sgaWYgZGVmaW5lZFxuICAgICAgICogVGhlIGNhbGxiYWNrIGNhbGwgaXMgd3JhcHBlZCBpbiBhICRldmFsQXN5bmMgdG8gZW5zdXJlIHRoYXQgaXRzIHJlc3VsdCB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIHNjb3BlLlxuICAgICAgICpcbiAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XG4gICAgICAgKi9cbiAgICAgIGNhbGxPblN0YXJ0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5vblN0YXJ0KSB7XG4gICAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgcG9pbnRlclR5cGUgPSB0aGlzLnRyYWNraW5nID09PSAnbG93VmFsdWUnID8gJ21pbicgOiAnbWF4JztcbiAgICAgICAgICB0aGlzLnNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLm9wdGlvbnMub25TdGFydChzZWxmLm9wdGlvbnMuaWQsIHNlbGYuc2NvcGUucnpTbGlkZXJNb2RlbCwgc2VsZi5zY29wZS5yelNsaWRlckhpZ2gsIHBvaW50ZXJUeXBlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBDYWxsIHRoZSBvbkNoYW5nZSBjYWxsYmFjayBpZiBkZWZpbmVkXG4gICAgICAgKiBUaGUgY2FsbGJhY2sgY2FsbCBpcyB3cmFwcGVkIGluIGEgJGV2YWxBc3luYyB0byBlbnN1cmUgdGhhdCBpdHMgcmVzdWx0IHdpbGwgYmUgYXBwbGllZCB0byB0aGUgc2NvcGUuXG4gICAgICAgKlxuICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cbiAgICAgICAqL1xuICAgICAgY2FsbE9uQ2hhbmdlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5vbkNoYW5nZSkge1xuICAgICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIHBvaW50ZXJUeXBlID0gdGhpcy50cmFja2luZyA9PT0gJ2xvd1ZhbHVlJyA/ICdtaW4nIDogJ21heCc7XG4gICAgICAgICAgdGhpcy5zY29wZS4kZXZhbEFzeW5jKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgc2VsZi5vcHRpb25zLm9uQ2hhbmdlKHNlbGYub3B0aW9ucy5pZCwgc2VsZi5zY29wZS5yelNsaWRlck1vZGVsLCBzZWxmLnNjb3BlLnJ6U2xpZGVySGlnaCwgcG9pbnRlclR5cGUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIENhbGwgdGhlIG9uRW5kIGNhbGxiYWNrIGlmIGRlZmluZWRcbiAgICAgICAqIFRoZSBjYWxsYmFjayBjYWxsIGlzIHdyYXBwZWQgaW4gYSAkZXZhbEFzeW5jIHRvIGVuc3VyZSB0aGF0IGl0cyByZXN1bHQgd2lsbCBiZSBhcHBsaWVkIHRvIHRoZSBzY29wZS5cbiAgICAgICAqXG4gICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxuICAgICAgICovXG4gICAgICBjYWxsT25FbmQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLm9uRW5kKSB7XG4gICAgICAgICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgICAgICAgcG9pbnRlclR5cGUgPSB0aGlzLnRyYWNraW5nID09PSAnbG93VmFsdWUnID8gJ21pbicgOiAnbWF4JztcbiAgICAgICAgICB0aGlzLnNjb3BlLiRldmFsQXN5bmMoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBzZWxmLm9wdGlvbnMub25FbmQoc2VsZi5vcHRpb25zLmlkLCBzZWxmLnNjb3BlLnJ6U2xpZGVyTW9kZWwsIHNlbGYuc2NvcGUucnpTbGlkZXJIaWdoLCBwb2ludGVyVHlwZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zY29wZS4kZW1pdCgnc2xpZGVFbmRlZCcpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gU2xpZGVyO1xuICB9XSlcblxuICAuZGlyZWN0aXZlKCdyenNsaWRlcicsIFsnUnpTbGlkZXInLCBmdW5jdGlvbihSelNsaWRlcikge1xuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIHJldHVybiB7XG4gICAgICByZXN0cmljdDogJ0FFJyxcbiAgICAgIHJlcGxhY2U6IHRydWUsXG4gICAgICBzY29wZToge1xuICAgICAgICByelNsaWRlck1vZGVsOiAnPT8nLFxuICAgICAgICByelNsaWRlckhpZ2g6ICc9PycsXG4gICAgICAgIHJ6U2xpZGVyT3B0aW9uczogJyY/JyxcbiAgICAgICAgcnpTbGlkZXJUcGxVcmw6ICdAJ1xuICAgICAgfSxcblxuICAgICAgLyoqXG4gICAgICAgKiBSZXR1cm4gdGVtcGxhdGUgVVJMXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtIHtqcUxpdGV9IGVsZW1cbiAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBhdHRyc1xuICAgICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAgICovXG4gICAgICB0ZW1wbGF0ZVVybDogZnVuY3Rpb24oZWxlbSwgYXR0cnMpIHtcbiAgICAgICAgLy9ub2luc3BlY3Rpb24gSlNVbnJlc29sdmVkVmFyaWFibGVcbiAgICAgICAgcmV0dXJuIGF0dHJzLnJ6U2xpZGVyVHBsVXJsIHx8ICdyelNsaWRlclRwbC5odG1sJztcbiAgICAgIH0sXG5cbiAgICAgIGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtKSB7XG4gICAgICAgIHNjb3BlLnNsaWRlciA9IG5ldyBSelNsaWRlcihzY29wZSwgZWxlbSk7IC8vYXR0YWNoIG9uIHNjb3BlIHNvIHdlIGNhbiB0ZXN0IGl0XG4gICAgICB9XG4gICAgfTtcbiAgfV0pO1xuXG4gIC8vIElERSBhc3Npc3RcblxuICAvKipcbiAgICogQG5hbWUgbmdTY29wZVxuICAgKlxuICAgKiBAcHJvcGVydHkge251bWJlcn0gcnpTbGlkZXJNb2RlbFxuICAgKiBAcHJvcGVydHkge251bWJlcn0gcnpTbGlkZXJIaWdoXG4gICAqIEBwcm9wZXJ0eSB7T2JqZWN0fSByelNsaWRlck9wdGlvbnNcbiAgICovXG5cbiAgLyoqXG4gICAqIEBuYW1lIGpxTGl0ZVxuICAgKlxuICAgKiBAcHJvcGVydHkge251bWJlcnx1bmRlZmluZWR9IHJ6c3AgcnpzbGlkZXIgbGFiZWwgcG9zaXRpb24gcG9zaXRpb25cbiAgICogQHByb3BlcnR5IHtudW1iZXJ8dW5kZWZpbmVkfSByenNkIHJ6c2xpZGVyIGVsZW1lbnQgZGltZW5zaW9uXG4gICAqIEBwcm9wZXJ0eSB7c3RyaW5nfHVuZGVmaW5lZH0gcnpzdiByenNsaWRlciBsYWJlbCB2YWx1ZS90ZXh0XG4gICAqIEBwcm9wZXJ0eSB7RnVuY3Rpb259IGNzc1xuICAgKiBAcHJvcGVydHkge0Z1bmN0aW9ufSB0ZXh0XG4gICAqL1xuXG4gIC8qKlxuICAgKiBAbmFtZSBFdmVudFxuICAgKiBAcHJvcGVydHkge0FycmF5fSB0b3VjaGVzXG4gICAqIEBwcm9wZXJ0eSB7RXZlbnR9IG9yaWdpbmFsRXZlbnRcbiAgICovXG5cbiAgLyoqXG4gICAqIEBuYW1lIFRocm90dGxlT3B0aW9uc1xuICAgKlxuICAgKiBAcHJvcGVydHkge2Jvb2xlYW59IGxlYWRpbmdcbiAgICogQHByb3BlcnR5IHtib29sZWFufSB0cmFpbGluZ1xuICAgKi9cblxuICBtb2R1bGUucnVuKFsnJHRlbXBsYXRlQ2FjaGUnLCBmdW5jdGlvbigkdGVtcGxhdGVDYWNoZSkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgJHRlbXBsYXRlQ2FjaGUucHV0KCdyelNsaWRlclRwbC5odG1sJyxcbiAgICBcIjxkaXYgY2xhc3M9cnpzbGlkZXI+PHNwYW4gY2xhc3M9cnotYmFyLXdyYXBwZXI+PHNwYW4gY2xhc3M9cnotYmFyPjwvc3Bhbj48L3NwYW4+IDxzcGFuIGNsYXNzPXJ6LWJhci13cmFwcGVyPjxzcGFuIGNsYXNzPVxcXCJyei1iYXIgcnotc2VsZWN0aW9uXFxcIiBuZy1zdHlsZT1iYXJTdHlsZT48L3NwYW4+PC9zcGFuPiA8c3BhbiBjbGFzcz1cXFwicnotcG9pbnRlciByei1wb2ludGVyLW1pblxcXCIgbmctc3R5bGU9bWluUG9pbnRlclN0eWxlPjwvc3Bhbj4gPHNwYW4gY2xhc3M9XFxcInJ6LXBvaW50ZXIgcnotcG9pbnRlci1tYXhcXFwiIG5nLXN0eWxlPW1heFBvaW50ZXJTdHlsZT48L3NwYW4+IDxzcGFuIGNsYXNzPVxcXCJyei1idWJibGUgcnotbGltaXQgcnotZmxvb3JcXFwiPjwvc3Bhbj4gPHNwYW4gY2xhc3M9XFxcInJ6LWJ1YmJsZSByei1saW1pdCByei1jZWlsXFxcIj48L3NwYW4+IDxzcGFuIGNsYXNzPXJ6LWJ1YmJsZT48L3NwYW4+IDxzcGFuIGNsYXNzPXJ6LWJ1YmJsZT48L3NwYW4+IDxzcGFuIGNsYXNzPXJ6LWJ1YmJsZT48L3NwYW4+PHVsIG5nLXNob3c9c2hvd1RpY2tzIGNsYXNzPXJ6LXRpY2tzPjxsaSBuZy1yZXBlYXQ9XFxcInQgaW4gdGlja3MgdHJhY2sgYnkgJGluZGV4XFxcIiBjbGFzcz1yei10aWNrIG5nLWNsYXNzPVxcXCJ7J3J6LXNlbGVjdGVkJzogdC5zZWxlY3RlZH1cXFwiIG5nLXN0eWxlPXQuc3R5bGUgbmctYXR0ci11aWItdG9vbHRpcD1cXFwie3sgdC50b29sdGlwIH19XFxcIiBuZy1hdHRyLXRvb2x0aXAtcGxhY2VtZW50PXt7dC50b29sdGlwUGxhY2VtZW50fX0gbmctYXR0ci10b29sdGlwLWFwcGVuZC10by1ib2R5PVxcXCJ7eyB0LnRvb2x0aXAgPyB0cnVlIDogdW5kZWZpbmVkfX1cXFwiPjxzcGFuIG5nLWlmPVxcXCJ0LnZhbHVlICE9IG51bGxcXFwiIGNsYXNzPXJ6LXRpY2stdmFsdWUgbmctYXR0ci11aWItdG9vbHRpcD1cXFwie3sgdC52YWx1ZVRvb2x0aXAgfX1cXFwiIG5nLWF0dHItdG9vbHRpcC1wbGFjZW1lbnQ9e3t0LnZhbHVlVG9vbHRpcFBsYWNlbWVudH19Pnt7IHQudmFsdWUgfX08L3NwYW4+IDxzcGFuIG5nLWlmPVxcXCJ0LmxlZ2VuZCAhPSBudWxsXFxcIiBjbGFzcz1yei10aWNrLWxlZ2VuZD57eyB0LmxlZ2VuZCB9fTwvc3Bhbj48L2xpPjwvdWw+PC9kaXY+XCJcbiAgKTtcblxufV0pO1xuXG4gIHJldHVybiBtb2R1bGUubmFtZVxufSkpO1xuIiwiLyoqXG4gKiBNb3VzZXRyYXAgd3JhcHBlciBmb3IgQW5ndWxhckpTXG4gKiBAdmVyc2lvbiB2MC4wLjEgLSAyMDEzLTEyLTMwXG4gKiBAbGluayBodHRwczovL2dpdGh1Yi5jb20vbWdvbnRvL21nby1tb3VzZXRyYXBcbiAqIEBhdXRob3IgTWFydGluIEdvbnRvdm5pa2FzIDxtYXJ0aW5AZ29uLnRvPlxuICogQGxpY2Vuc2UgTUlUIExpY2Vuc2UsIGh0dHA6Ly93d3cub3BlbnNvdXJjZS5vcmcvbGljZW5zZXMvTUlUXG4gKi9cbmFuZ3VsYXIubW9kdWxlKCdtZ28tbW91c2V0cmFwJywgW10pLmRpcmVjdGl2ZSgnd01vdXNldHJhcCcsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0EnLFxuICAgICAgICBjb250cm9sbGVyOiBbJyRzY29wZScsICckZWxlbWVudCcsICckYXR0cnMnLFxuICAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKCRzY29wZSwgJGVsZW1lbnQsICRhdHRycykge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgbW91c2V0cmFwO1xuXG4gICAgICAgICAgICAkc2NvcGUuJHdhdGNoKCRhdHRycy53TW91c2V0cmFwLCBmdW5jdGlvbihfbW91c2V0cmFwKSB7XG4gICAgICAgICAgICAgICAgbW91c2V0cmFwID0gX21vdXNldHJhcDtcblxuICAgICAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBtb3VzZXRyYXApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vdXNldHJhcC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBNb3VzZXRyYXAudW5iaW5kKGtleSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBNb3VzZXRyYXAuYmluZChrZXksIGFwcGx5V3JhcHBlcihtb3VzZXRyYXBba2V5XSkpOyBcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sIHRydWUpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBmdW5jdGlvbiBhcHBseVdyYXBwZXIoZnVuYykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmdW5jKGUpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICAkZWxlbWVudC5iaW5kKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIGlmICghbW91c2V0cmFwKSByZXR1cm47XG5cbiAgICAgICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gbW91c2V0cmFwKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtb3VzZXRyYXAuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgTW91c2V0cmFwLnVuYmluZChrZXkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfV1cbiAgICB9XG59KTtcbiJdfQ==
