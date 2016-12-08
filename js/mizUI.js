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

var app = angular.module("ntuApp", ['LocalStorageModule', 'angular-marquee', 'youtube-embed']);


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
    _factory.listInvites = function(projectId) {
        return $http.get("/api/invite/list-invites?projectId=" + projectId);
    };

    _factory.acceptInivte = function(inviteId) {
        return $http.post("/api/invite/accept", {
            id: inviteId
        });
    };

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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFuZ3VsYXItbG9jYWwtc3RvcmFnZS5qcyIsImFuZ3VsYXItbWFycXVlZS5qcyIsImFuZ3VsYXIteW91dHViZS1lbWJlZC5qcyIsImFwcC5qcyIsImJhc2UuanMiLCJtb3VzZXRyYXAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25pQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzVQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdlZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJtaXpVSS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQW4gQW5ndWxhciBtb2R1bGUgdGhhdCBnaXZlcyB5b3UgYWNjZXNzIHRvIHRoZSBicm93c2VycyBsb2NhbCBzdG9yYWdlXG4gKiBAdmVyc2lvbiB2MC41LjIgLSAyMDE2LTA5LTI4XG4gKiBAbGluayBodHRwczovL2dpdGh1Yi5jb20vZ3Jldm9yeS9hbmd1bGFyLWxvY2FsLXN0b3JhZ2VcbiAqIEBhdXRob3IgZ3Jldm9yeSA8Z3JlZ0BncmVncGlrZS5jYT5cbiAqIEBsaWNlbnNlIE1JVCBMaWNlbnNlLCBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL01JVFxuICovXG4oZnVuY3Rpb24gKHdpbmRvdywgYW5ndWxhcikge1xudmFyIGlzRGVmaW5lZCA9IGFuZ3VsYXIuaXNEZWZpbmVkLFxuICBpc1VuZGVmaW5lZCA9IGFuZ3VsYXIuaXNVbmRlZmluZWQsXG4gIGlzTnVtYmVyID0gYW5ndWxhci5pc051bWJlcixcbiAgaXNPYmplY3QgPSBhbmd1bGFyLmlzT2JqZWN0LFxuICBpc0FycmF5ID0gYW5ndWxhci5pc0FycmF5LFxuICBpc1N0cmluZyA9IGFuZ3VsYXIuaXNTdHJpbmcsXG4gIGV4dGVuZCA9IGFuZ3VsYXIuZXh0ZW5kLFxuICB0b0pzb24gPSBhbmd1bGFyLnRvSnNvbjtcblxuYW5ndWxhclxuICAubW9kdWxlKCdMb2NhbFN0b3JhZ2VNb2R1bGUnLCBbXSlcbiAgLnByb3ZpZGVyKCdsb2NhbFN0b3JhZ2VTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG4gICAgLy8gWW91IHNob3VsZCBzZXQgYSBwcmVmaXggdG8gYXZvaWQgb3ZlcndyaXRpbmcgYW55IGxvY2FsIHN0b3JhZ2UgdmFyaWFibGVzIGZyb20gdGhlIHJlc3Qgb2YgeW91ciBhcHBcbiAgICAvLyBlLmcuIGxvY2FsU3RvcmFnZVNlcnZpY2VQcm92aWRlci5zZXRQcmVmaXgoJ3lvdXJBcHBOYW1lJyk7XG4gICAgLy8gV2l0aCBwcm92aWRlciB5b3UgY2FuIHVzZSBjb25maWcgYXMgdGhpczpcbiAgICAvLyBteUFwcC5jb25maWcoZnVuY3Rpb24gKGxvY2FsU3RvcmFnZVNlcnZpY2VQcm92aWRlcikge1xuICAgIC8vICAgIGxvY2FsU3RvcmFnZVNlcnZpY2VQcm92aWRlci5wcmVmaXggPSAneW91ckFwcE5hbWUnO1xuICAgIC8vIH0pO1xuICAgIHRoaXMucHJlZml4ID0gJ2xzJztcblxuICAgIC8vIFlvdSBjb3VsZCBjaGFuZ2Ugd2ViIHN0b3JhZ2UgdHlwZSBsb2NhbHN0b3JhZ2Ugb3Igc2Vzc2lvblN0b3JhZ2VcbiAgICB0aGlzLnN0b3JhZ2VUeXBlID0gJ2xvY2FsU3RvcmFnZSc7XG5cbiAgICAvLyBDb29raWUgb3B0aW9ucyAodXN1YWxseSBpbiBjYXNlIG9mIGZhbGxiYWNrKVxuICAgIC8vIGV4cGlyeSA9IE51bWJlciBvZiBkYXlzIGJlZm9yZSBjb29raWVzIGV4cGlyZSAvLyAwID0gRG9lcyBub3QgZXhwaXJlXG4gICAgLy8gcGF0aCA9IFRoZSB3ZWIgcGF0aCB0aGUgY29va2llIHJlcHJlc2VudHNcbiAgICAvLyBzZWN1cmUgPSBXZXRoZXIgdGhlIGNvb2tpZXMgc2hvdWxkIGJlIHNlY3VyZSAoaS5lIG9ubHkgc2VudCBvbiBIVFRQUyByZXF1ZXN0cylcbiAgICB0aGlzLmNvb2tpZSA9IHtcbiAgICAgIGV4cGlyeTogMzAsXG4gICAgICBwYXRoOiAnLycsXG4gICAgICBzZWN1cmU6IGZhbHNlXG4gICAgfTtcblxuICAgIC8vIERlY2lkZXMgd2V0aGVyIHdlIHNob3VsZCBkZWZhdWx0IHRvIGNvb2tpZXMgaWYgbG9jYWxzdG9yYWdlIGlzIG5vdCBzdXBwb3J0ZWQuXG4gICAgdGhpcy5kZWZhdWx0VG9Db29raWUgPSB0cnVlO1xuXG4gICAgLy8gU2VuZCBzaWduYWxzIGZvciBlYWNoIG9mIHRoZSBmb2xsb3dpbmcgYWN0aW9ucz9cbiAgICB0aGlzLm5vdGlmeSA9IHtcbiAgICAgIHNldEl0ZW06IHRydWUsXG4gICAgICByZW1vdmVJdGVtOiBmYWxzZVxuICAgIH07XG5cbiAgICAvLyBTZXR0ZXIgZm9yIHRoZSBwcmVmaXhcbiAgICB0aGlzLnNldFByZWZpeCA9IGZ1bmN0aW9uKHByZWZpeCkge1xuICAgICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLy8gU2V0dGVyIGZvciB0aGUgc3RvcmFnZVR5cGVcbiAgICB0aGlzLnNldFN0b3JhZ2VUeXBlID0gZnVuY3Rpb24oc3RvcmFnZVR5cGUpIHtcbiAgICAgIHRoaXMuc3RvcmFnZVR5cGUgPSBzdG9yYWdlVHlwZTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgLy8gU2V0dGVyIGZvciBkZWZhdWx0VG9Db29raWUgdmFsdWUsIGRlZmF1bHQgaXMgdHJ1ZS5cbiAgICB0aGlzLnNldERlZmF1bHRUb0Nvb2tpZSA9IGZ1bmN0aW9uIChzaG91bGREZWZhdWx0KSB7XG4gICAgICB0aGlzLmRlZmF1bHRUb0Nvb2tpZSA9ICEhc2hvdWxkRGVmYXVsdDsgLy8gRG91YmxlLW5vdCB0byBtYWtlIHN1cmUgaXQncyBhIGJvb2wgdmFsdWUuXG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIC8vIFNldHRlciBmb3IgY29va2llIGNvbmZpZ1xuICAgIHRoaXMuc2V0U3RvcmFnZUNvb2tpZSA9IGZ1bmN0aW9uKGV4cCwgcGF0aCwgc2VjdXJlKSB7XG4gICAgICB0aGlzLmNvb2tpZS5leHBpcnkgPSBleHA7XG4gICAgICB0aGlzLmNvb2tpZS5wYXRoID0gcGF0aDtcbiAgICAgIHRoaXMuY29va2llLnNlY3VyZSA9IHNlY3VyZTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvLyBTZXR0ZXIgZm9yIGNvb2tpZSBkb21haW5cbiAgICB0aGlzLnNldFN0b3JhZ2VDb29raWVEb21haW4gPSBmdW5jdGlvbihkb21haW4pIHtcbiAgICAgIHRoaXMuY29va2llLmRvbWFpbiA9IGRvbWFpbjtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICAvLyBTZXR0ZXIgZm9yIG5vdGlmaWNhdGlvbiBjb25maWdcbiAgICAvLyBpdGVtU2V0ICYgaXRlbVJlbW92ZSBzaG91bGQgYmUgYm9vbGVhbnNcbiAgICB0aGlzLnNldE5vdGlmeSA9IGZ1bmN0aW9uKGl0ZW1TZXQsIGl0ZW1SZW1vdmUpIHtcbiAgICAgIHRoaXMubm90aWZ5ID0ge1xuICAgICAgICBzZXRJdGVtOiBpdGVtU2V0LFxuICAgICAgICByZW1vdmVJdGVtOiBpdGVtUmVtb3ZlXG4gICAgICB9O1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIHRoaXMuJGdldCA9IFsnJHJvb3RTY29wZScsICckd2luZG93JywgJyRkb2N1bWVudCcsICckcGFyc2UnLCckdGltZW91dCcsIGZ1bmN0aW9uKCRyb290U2NvcGUsICR3aW5kb3csICRkb2N1bWVudCwgJHBhcnNlLCAkdGltZW91dCkge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIHByZWZpeCA9IHNlbGYucHJlZml4O1xuICAgICAgdmFyIGNvb2tpZSA9IHNlbGYuY29va2llO1xuICAgICAgdmFyIG5vdGlmeSA9IHNlbGYubm90aWZ5O1xuICAgICAgdmFyIHN0b3JhZ2VUeXBlID0gc2VsZi5zdG9yYWdlVHlwZTtcbiAgICAgIHZhciB3ZWJTdG9yYWdlO1xuXG4gICAgICAvLyBXaGVuIEFuZ3VsYXIncyAkZG9jdW1lbnQgaXMgbm90IGF2YWlsYWJsZVxuICAgICAgaWYgKCEkZG9jdW1lbnQpIHtcbiAgICAgICAgJGRvY3VtZW50ID0gZG9jdW1lbnQ7XG4gICAgICB9IGVsc2UgaWYgKCRkb2N1bWVudFswXSkge1xuICAgICAgICAkZG9jdW1lbnQgPSAkZG9jdW1lbnRbMF07XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHRoZXJlIGlzIGEgcHJlZml4IHNldCBpbiB0aGUgY29uZmlnIGxldHMgdXNlIHRoYXQgd2l0aCBhbiBhcHBlbmRlZCBwZXJpb2QgZm9yIHJlYWRhYmlsaXR5XG4gICAgICBpZiAocHJlZml4LnN1YnN0cigtMSkgIT09ICcuJykge1xuICAgICAgICBwcmVmaXggPSAhIXByZWZpeCA/IHByZWZpeCArICcuJyA6ICcnO1xuICAgICAgfVxuICAgICAgdmFyIGRlcml2ZVF1YWxpZmllZEtleSA9IGZ1bmN0aW9uKGtleSkge1xuICAgICAgICByZXR1cm4gcHJlZml4ICsga2V5O1xuICAgICAgfTtcblxuICAgICAgLy8gUmVtb3ZlcyBwcmVmaXggZnJvbSB0aGUga2V5LlxuICAgICAgdmFyIHVuZGVyaXZlUXVhbGlmaWVkS2V5ID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICByZXR1cm4ga2V5LnJlcGxhY2UobmV3IFJlZ0V4cCgnXicgKyBwcmVmaXgsICdnJyksICcnKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIENoZWNrIGlmIHRoZSBrZXkgaXMgd2l0aGluIG91ciBwcmVmaXggbmFtZXNwYWNlLlxuICAgICAgdmFyIGlzS2V5UHJlZml4T3VycyA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIGtleS5pbmRleE9mKHByZWZpeCkgPT09IDA7XG4gICAgICB9O1xuXG4gICAgICAvLyBDaGVja3MgdGhlIGJyb3dzZXIgdG8gc2VlIGlmIGxvY2FsIHN0b3JhZ2UgaXMgc3VwcG9ydGVkXG4gICAgICB2YXIgY2hlY2tTdXBwb3J0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciBzdXBwb3J0ZWQgPSAoc3RvcmFnZVR5cGUgaW4gJHdpbmRvdyAmJiAkd2luZG93W3N0b3JhZ2VUeXBlXSAhPT0gbnVsbCk7XG5cbiAgICAgICAgICAvLyBXaGVuIFNhZmFyaSAoT1MgWCBvciBpT1MpIGlzIGluIHByaXZhdGUgYnJvd3NpbmcgbW9kZSwgaXQgYXBwZWFycyBhcyB0aG91Z2ggbG9jYWxTdG9yYWdlXG4gICAgICAgICAgLy8gaXMgYXZhaWxhYmxlLCBidXQgdHJ5aW5nIHRvIGNhbGwgLnNldEl0ZW0gdGhyb3dzIGFuIGV4Y2VwdGlvbi5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFwiUVVPVEFfRVhDRUVERURfRVJSOiBET00gRXhjZXB0aW9uIDIyOiBBbiBhdHRlbXB0IHdhcyBtYWRlIHRvIGFkZCBzb21ldGhpbmcgdG8gc3RvcmFnZVxuICAgICAgICAgIC8vIHRoYXQgZXhjZWVkZWQgdGhlIHF1b3RhLlwiXG4gICAgICAgICAgdmFyIGtleSA9IGRlcml2ZVF1YWxpZmllZEtleSgnX18nICsgTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogMWU3KSk7XG4gICAgICAgICAgaWYgKHN1cHBvcnRlZCkge1xuICAgICAgICAgICAgd2ViU3RvcmFnZSA9ICR3aW5kb3dbc3RvcmFnZVR5cGVdO1xuICAgICAgICAgICAgd2ViU3RvcmFnZS5zZXRJdGVtKGtleSwgJycpO1xuICAgICAgICAgICAgd2ViU3RvcmFnZS5yZW1vdmVJdGVtKGtleSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIHN1cHBvcnRlZDtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIC8vIE9ubHkgY2hhbmdlIHN0b3JhZ2VUeXBlIHRvIGNvb2tpZXMgaWYgZGVmYXVsdGluZyBpcyBlbmFibGVkLlxuICAgICAgICAgIGlmIChzZWxmLmRlZmF1bHRUb0Nvb2tpZSlcbiAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gJ2Nvb2tpZSc7XG4gICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICB2YXIgYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlID0gY2hlY2tTdXBwb3J0KCk7XG5cbiAgICAgIC8vIERpcmVjdGx5IGFkZHMgYSB2YWx1ZSB0byBsb2NhbCBzdG9yYWdlXG4gICAgICAvLyBJZiBsb2NhbCBzdG9yYWdlIGlzIG5vdCBhdmFpbGFibGUgaW4gdGhlIGJyb3dzZXIgdXNlIGNvb2tpZXNcbiAgICAgIC8vIEV4YW1wbGUgdXNlOiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmFkZCgnbGlicmFyeScsJ2FuZ3VsYXInKTtcbiAgICAgIHZhciBhZGRUb0xvY2FsU3RvcmFnZSA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCB0eXBlKSB7XG4gICAgICAgIHNldFN0b3JhZ2VUeXBlKHR5cGUpO1xuXG4gICAgICAgIC8vIExldCdzIGNvbnZlcnQgdW5kZWZpbmVkIHZhbHVlcyB0byBudWxsIHRvIGdldCB0aGUgdmFsdWUgY29uc2lzdGVudFxuICAgICAgICBpZiAoaXNVbmRlZmluZWQodmFsdWUpKSB7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gdG9Kc29uKHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHRoaXMgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IGxvY2FsIHN0b3JhZ2UgdXNlIGNvb2tpZXNcbiAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UgJiYgc2VsZi5kZWZhdWx0VG9Db29raWUgfHwgc2VsZi5zdG9yYWdlVHlwZSA9PT0gJ2Nvb2tpZScpIHtcbiAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLndhcm5pbmcnLCAnTE9DQUxfU1RPUkFHRV9OT1RfU1VQUE9SVEVEJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5vdGlmeS5zZXRJdGVtKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uc2V0aXRlbScsIHtrZXk6IGtleSwgbmV3dmFsdWU6IHZhbHVlLCBzdG9yYWdlVHlwZTogJ2Nvb2tpZSd9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGFkZFRvQ29va2llcyhrZXksIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgaWYgKHdlYlN0b3JhZ2UpIHtcbiAgICAgICAgICAgIHdlYlN0b3JhZ2Uuc2V0SXRlbShkZXJpdmVRdWFsaWZpZWRLZXkoa2V5KSwgdmFsdWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAobm90aWZ5LnNldEl0ZW0pIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5zZXRpdGVtJywge2tleToga2V5LCBuZXd2YWx1ZTogdmFsdWUsIHN0b3JhZ2VUeXBlOiBzZWxmLnN0b3JhZ2VUeXBlfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICByZXR1cm4gYWRkVG9Db29raWVzKGtleSwgdmFsdWUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfTtcblxuICAgICAgLy8gRGlyZWN0bHkgZ2V0IGEgdmFsdWUgZnJvbSBsb2NhbCBzdG9yYWdlXG4gICAgICAvLyBFeGFtcGxlIHVzZTogbG9jYWxTdG9yYWdlU2VydmljZS5nZXQoJ2xpYnJhcnknKTsgLy8gcmV0dXJucyAnYW5ndWxhcidcbiAgICAgIHZhciBnZXRGcm9tTG9jYWxTdG9yYWdlID0gZnVuY3Rpb24gKGtleSwgdHlwZSkge1xuICAgICAgICBzZXRTdG9yYWdlVHlwZSh0eXBlKTtcblxuICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSAmJiBzZWxmLmRlZmF1bHRUb0Nvb2tpZSAgfHwgc2VsZi5zdG9yYWdlVHlwZSA9PT0gJ2Nvb2tpZScpIHtcbiAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLndhcm5pbmcnLCAnTE9DQUxfU1RPUkFHRV9OT1RfU1VQUE9SVEVEJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIGdldEZyb21Db29raWVzKGtleSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaXRlbSA9IHdlYlN0b3JhZ2UgPyB3ZWJTdG9yYWdlLmdldEl0ZW0oZGVyaXZlUXVhbGlmaWVkS2V5KGtleSkpIDogbnVsbDtcbiAgICAgICAgLy8gYW5ndWxhci50b0pzb24gd2lsbCBjb252ZXJ0IG51bGwgdG8gJ251bGwnLCBzbyBhIHByb3BlciBjb252ZXJzaW9uIGlzIG5lZWRlZFxuICAgICAgICAvLyBGSVhNRSBub3QgYSBwZXJmZWN0IHNvbHV0aW9uLCBzaW5jZSBhIHZhbGlkICdudWxsJyBzdHJpbmcgY2FuJ3QgYmUgc3RvcmVkXG4gICAgICAgIGlmICghaXRlbSB8fCBpdGVtID09PSAnbnVsbCcpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoaXRlbSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICByZXR1cm4gaXRlbTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgLy8gUmVtb3ZlIGFuIGl0ZW0gZnJvbSBsb2NhbCBzdG9yYWdlXG4gICAgICAvLyBFeGFtcGxlIHVzZTogbG9jYWxTdG9yYWdlU2VydmljZS5yZW1vdmUoJ2xpYnJhcnknKTsgLy8gcmVtb3ZlcyB0aGUga2V5L3ZhbHVlIHBhaXIgb2YgbGlicmFyeT0nYW5ndWxhcidcbiAgICAgIC8vXG4gICAgICAvLyBUaGlzIGlzIHZhci1hcmcgcmVtb3ZhbCwgY2hlY2sgdGhlIGxhc3QgYXJndW1lbnQgdG8gc2VlIGlmIGl0IGlzIGEgc3RvcmFnZVR5cGVcbiAgICAgIC8vIGFuZCBzZXQgdHlwZSBhY2NvcmRpbmdseSBiZWZvcmUgcmVtb3ZpbmcuXG4gICAgICAvL1xuICAgICAgdmFyIHJlbW92ZUZyb21Mb2NhbFN0b3JhZ2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIGNhbid0IHBvcCBvbiBhcmd1bWVudHMsIHNvIHdlIGRvIHRoaXNcbiAgICAgICAgdmFyIGNvbnN1bWVkID0gMDtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMSAmJlxuICAgICAgICAgICAgKGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV0gPT09ICdsb2NhbFN0b3JhZ2UnIHx8XG4gICAgICAgICAgICAgYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXSA9PT0gJ3Nlc3Npb25TdG9yYWdlJykpIHtcbiAgICAgICAgICBjb25zdW1lZCA9IDE7XG4gICAgICAgICAgc2V0U3RvcmFnZVR5cGUoYXJndW1lbnRzW2FyZ3VtZW50cy5sZW5ndGggLSAxXSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaSwga2V5O1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aCAtIGNvbnN1bWVkOyBpKyspIHtcbiAgICAgICAgICBrZXkgPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UgJiYgc2VsZi5kZWZhdWx0VG9Db29raWUgfHwgc2VsZi5zdG9yYWdlVHlwZSA9PT0gJ2Nvb2tpZScpIHtcbiAgICAgICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlKSB7XG4gICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi53YXJuaW5nJywgJ0xPQ0FMX1NUT1JBR0VfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobm90aWZ5LnJlbW92ZUl0ZW0pIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLnJlbW92ZWl0ZW0nLCB7a2V5OiBrZXksIHN0b3JhZ2VUeXBlOiAnY29va2llJ30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVtb3ZlRnJvbUNvb2tpZXMoa2V5KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICB3ZWJTdG9yYWdlLnJlbW92ZUl0ZW0oZGVyaXZlUXVhbGlmaWVkS2V5KGtleSkpO1xuICAgICAgICAgICAgICBpZiAobm90aWZ5LnJlbW92ZUl0ZW0pIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24ucmVtb3ZlaXRlbScsIHtcbiAgICAgICAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgICAgICAgc3RvcmFnZVR5cGU6IHNlbGYuc3RvcmFnZVR5cGVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uZXJyb3InLCBlLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICByZW1vdmVGcm9tQ29va2llcyhrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgLy8gUmV0dXJuIGFycmF5IG9mIGtleXMgZm9yIGxvY2FsIHN0b3JhZ2VcbiAgICAgIC8vIEV4YW1wbGUgdXNlOiB2YXIga2V5cyA9IGxvY2FsU3RvcmFnZVNlcnZpY2Uua2V5cygpXG4gICAgICB2YXIgZ2V0S2V5c0ZvckxvY2FsU3RvcmFnZSA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgIHNldFN0b3JhZ2VUeXBlKHR5cGUpO1xuXG4gICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlKSB7XG4gICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLndhcm5pbmcnLCAnTE9DQUxfU1RPUkFHRV9OT1RfU1VQUE9SVEVEJyk7XG4gICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHByZWZpeExlbmd0aCA9IHByZWZpeC5sZW5ndGg7XG4gICAgICAgIHZhciBrZXlzID0gW107XG4gICAgICAgIGZvciAodmFyIGtleSBpbiB3ZWJTdG9yYWdlKSB7XG4gICAgICAgICAgLy8gT25seSByZXR1cm4ga2V5cyB0aGF0IGFyZSBmb3IgdGhpcyBhcHBcbiAgICAgICAgICBpZiAoa2V5LnN1YnN0cigwLCBwcmVmaXhMZW5ndGgpID09PSBwcmVmaXgpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGtleXMucHVzaChrZXkuc3Vic3RyKHByZWZpeExlbmd0aCkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uZXJyb3InLCBlLkRlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ga2V5cztcbiAgICAgIH07XG5cbiAgICAgIC8vIFJlbW92ZSBhbGwgZGF0YSBmb3IgdGhpcyBhcHAgZnJvbSBsb2NhbCBzdG9yYWdlXG4gICAgICAvLyBBbHNvIG9wdGlvbmFsbHkgdGFrZXMgYSByZWd1bGFyIGV4cHJlc3Npb24gc3RyaW5nIGFuZCByZW1vdmVzIHRoZSBtYXRjaGluZyBrZXktdmFsdWUgcGFpcnNcbiAgICAgIC8vIEV4YW1wbGUgdXNlOiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmNsZWFyQWxsKCk7XG4gICAgICAvLyBTaG91bGQgYmUgdXNlZCBtb3N0bHkgZm9yIGRldmVsb3BtZW50IHB1cnBvc2VzXG4gICAgICB2YXIgY2xlYXJBbGxGcm9tTG9jYWxTdG9yYWdlID0gZnVuY3Rpb24gKHJlZ3VsYXJFeHByZXNzaW9uLCB0eXBlKSB7XG4gICAgICAgIHNldFN0b3JhZ2VUeXBlKHR5cGUpO1xuXG4gICAgICAgIC8vIFNldHRpbmcgYm90aCByZWd1bGFyIGV4cHJlc3Npb25zIGluZGVwZW5kZW50bHlcbiAgICAgICAgLy8gRW1wdHkgc3RyaW5ncyByZXN1bHQgaW4gY2F0Y2hhbGwgUmVnRXhwXG4gICAgICAgIHZhciBwcmVmaXhSZWdleCA9ICEhcHJlZml4ID8gbmV3IFJlZ0V4cCgnXicgKyBwcmVmaXgpIDogbmV3IFJlZ0V4cCgpO1xuICAgICAgICB2YXIgdGVzdFJlZ2V4ID0gISFyZWd1bGFyRXhwcmVzc2lvbiA/IG5ldyBSZWdFeHAocmVndWxhckV4cHJlc3Npb24pIDogbmV3IFJlZ0V4cCgpO1xuXG4gICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlICYmIHNlbGYuZGVmYXVsdFRvQ29va2llICB8fCBzZWxmLnN0b3JhZ2VUeXBlID09PSAnY29va2llJykge1xuICAgICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24ud2FybmluZycsICdMT0NBTF9TVE9SQUdFX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGNsZWFyQWxsRnJvbUNvb2tpZXMoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSAmJiAhc2VsZi5kZWZhdWx0VG9Db29raWUpXG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB2YXIgcHJlZml4TGVuZ3RoID0gcHJlZml4Lmxlbmd0aDtcblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gd2ViU3RvcmFnZSkge1xuICAgICAgICAgIC8vIE9ubHkgcmVtb3ZlIGl0ZW1zIHRoYXQgYXJlIGZvciB0aGlzIGFwcCBhbmQgbWF0Y2ggdGhlIHJlZ3VsYXIgZXhwcmVzc2lvblxuICAgICAgICAgIGlmIChwcmVmaXhSZWdleC50ZXN0KGtleSkgJiYgdGVzdFJlZ2V4LnRlc3Qoa2V5LnN1YnN0cihwcmVmaXhMZW5ndGgpKSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgcmVtb3ZlRnJvbUxvY2FsU3RvcmFnZShrZXkuc3Vic3RyKHByZWZpeExlbmd0aCkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uZXJyb3InLCBlLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICByZXR1cm4gY2xlYXJBbGxGcm9tQ29va2llcygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH07XG5cbiAgICAgIC8vIENoZWNrcyB0aGUgYnJvd3NlciB0byBzZWUgaWYgY29va2llcyBhcmUgc3VwcG9ydGVkXG4gICAgICB2YXIgYnJvd3NlclN1cHBvcnRzQ29va2llcyA9IChmdW5jdGlvbigpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gJHdpbmRvdy5uYXZpZ2F0b3IuY29va2llRW5hYmxlZCB8fFxuICAgICAgICAgIChcImNvb2tpZVwiIGluICRkb2N1bWVudCAmJiAoJGRvY3VtZW50LmNvb2tpZS5sZW5ndGggPiAwIHx8XG4gICAgICAgICAgICAoJGRvY3VtZW50LmNvb2tpZSA9IFwidGVzdFwiKS5pbmRleE9mLmNhbGwoJGRvY3VtZW50LmNvb2tpZSwgXCJ0ZXN0XCIpID4gLTEpKTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uZXJyb3InLCBlLm1lc3NhZ2UpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSgpKTtcblxuICAgICAgICAvLyBEaXJlY3RseSBhZGRzIGEgdmFsdWUgdG8gY29va2llc1xuICAgICAgICAvLyBUeXBpY2FsbHkgdXNlZCBhcyBhIGZhbGxiYWNrIGlmIGxvY2FsIHN0b3JhZ2UgaXMgbm90IGF2YWlsYWJsZSBpbiB0aGUgYnJvd3NlclxuICAgICAgICAvLyBFeGFtcGxlIHVzZTogbG9jYWxTdG9yYWdlU2VydmljZS5jb29raWUuYWRkKCdsaWJyYXJ5JywnYW5ndWxhcicpO1xuICAgICAgICB2YXIgYWRkVG9Db29raWVzID0gZnVuY3Rpb24gKGtleSwgdmFsdWUsIGRheXNUb0V4cGlyeSwgc2VjdXJlKSB7XG5cbiAgICAgICAgICBpZiAoaXNVbmRlZmluZWQodmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfSBlbHNlIGlmKGlzQXJyYXkodmFsdWUpIHx8IGlzT2JqZWN0KHZhbHVlKSkge1xuICAgICAgICAgICAgdmFsdWUgPSB0b0pzb24odmFsdWUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzQ29va2llcykge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgJ0NPT0tJRVNfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgZXhwaXJ5ID0gJycsXG4gICAgICAgICAgICBleHBpcnlEYXRlID0gbmV3IERhdGUoKSxcbiAgICAgICAgICAgIGNvb2tpZURvbWFpbiA9ICcnO1xuXG4gICAgICAgICAgICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgLy8gTWFyayB0aGF0IHRoZSBjb29raWUgaGFzIGV4cGlyZWQgb25lIGRheSBhZ29cbiAgICAgICAgICAgICAgZXhwaXJ5RGF0ZS5zZXRUaW1lKGV4cGlyeURhdGUuZ2V0VGltZSgpICsgKC0xICogMjQgKiA2MCAqIDYwICogMTAwMCkpO1xuICAgICAgICAgICAgICBleHBpcnkgPSBcIjsgZXhwaXJlcz1cIiArIGV4cGlyeURhdGUudG9HTVRTdHJpbmcoKTtcbiAgICAgICAgICAgICAgdmFsdWUgPSAnJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNOdW1iZXIoZGF5c1RvRXhwaXJ5KSAmJiBkYXlzVG9FeHBpcnkgIT09IDApIHtcbiAgICAgICAgICAgICAgZXhwaXJ5RGF0ZS5zZXRUaW1lKGV4cGlyeURhdGUuZ2V0VGltZSgpICsgKGRheXNUb0V4cGlyeSAqIDI0ICogNjAgKiA2MCAqIDEwMDApKTtcbiAgICAgICAgICAgICAgZXhwaXJ5ID0gXCI7IGV4cGlyZXM9XCIgKyBleHBpcnlEYXRlLnRvR01UU3RyaW5nKCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNvb2tpZS5leHBpcnkgIT09IDApIHtcbiAgICAgICAgICAgICAgZXhwaXJ5RGF0ZS5zZXRUaW1lKGV4cGlyeURhdGUuZ2V0VGltZSgpICsgKGNvb2tpZS5leHBpcnkgKiAyNCAqIDYwICogNjAgKiAxMDAwKSk7XG4gICAgICAgICAgICAgIGV4cGlyeSA9IFwiOyBleHBpcmVzPVwiICsgZXhwaXJ5RGF0ZS50b0dNVFN0cmluZygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCEha2V5KSB7XG4gICAgICAgICAgICAgIHZhciBjb29raWVQYXRoID0gXCI7IHBhdGg9XCIgKyBjb29raWUucGF0aDtcbiAgICAgICAgICAgICAgaWYgKGNvb2tpZS5kb21haW4pIHtcbiAgICAgICAgICAgICAgICBjb29raWVEb21haW4gPSBcIjsgZG9tYWluPVwiICsgY29va2llLmRvbWFpbjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvKiBQcm92aWRpbmcgdGhlIHNlY3VyZSBwYXJhbWV0ZXIgYWx3YXlzIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBjb25maWdcbiAgICAgICAgICAgICAgICogKGFsbG93cyBkZXZlbG9wZXIgdG8gbWl4IGFuZCBtYXRjaCBzZWN1cmUgKyBub24tc2VjdXJlKSAqL1xuICAgICAgICAgICAgICBpZiAodHlwZW9mIHNlY3VyZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoc2VjdXJlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgLyogV2UndmUgZXhwbGljaXRseSBzcGVjaWZpZWQgc2VjdXJlLFxuICAgICAgICAgICAgICAgICAgICAgICAqIGFkZCB0aGUgc2VjdXJlIGF0dHJpYnV0ZSB0byB0aGUgY29va2llIChhZnRlciBkb21haW4pICovXG4gICAgICAgICAgICAgICAgICAgICAgY29va2llRG9tYWluICs9IFwiOyBzZWN1cmVcIjtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIC8vIGVsc2UgLSBzZWN1cmUgaGFzIGJlZW4gc3VwcGxpZWQgYnV0IGlzbid0IHRydWUgLSBzbyBkb24ndCBzZXQgc2VjdXJlIGZsYWcsIHJlZ2FyZGxlc3Mgb2Ygd2hhdCBjb25maWcgc2F5c1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2UgaWYgKGNvb2tpZS5zZWN1cmUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgIC8vIHNlY3VyZSBwYXJhbWV0ZXIgd2Fzbid0IHNwZWNpZmllZCwgZ2V0IGRlZmF1bHQgZnJvbSBjb25maWdcbiAgICAgICAgICAgICAgICAgIGNvb2tpZURvbWFpbiArPSBcIjsgc2VjdXJlXCI7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgJGRvY3VtZW50LmNvb2tpZSA9IGRlcml2ZVF1YWxpZmllZEtleShrZXkpICsgXCI9XCIgKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpICsgZXhwaXJ5ICsgY29va2llUGF0aCArIGNvb2tpZURvbWFpbjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uZXJyb3InLCBlLm1lc3NhZ2UpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBEaXJlY3RseSBnZXQgYSB2YWx1ZSBmcm9tIGEgY29va2llXG4gICAgICAgIC8vIEV4YW1wbGUgdXNlOiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmNvb2tpZS5nZXQoJ2xpYnJhcnknKTsgLy8gcmV0dXJucyAnYW5ndWxhcidcbiAgICAgICAgdmFyIGdldEZyb21Db29raWVzID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzQ29va2llcykge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgJ0NPT0tJRVNfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBjb29raWVzID0gJGRvY3VtZW50LmNvb2tpZSAmJiAkZG9jdW1lbnQuY29va2llLnNwbGl0KCc7JykgfHwgW107XG4gICAgICAgICAgZm9yKHZhciBpPTA7IGkgPCBjb29raWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgdGhpc0Nvb2tpZSA9IGNvb2tpZXNbaV07XG4gICAgICAgICAgICB3aGlsZSAodGhpc0Nvb2tpZS5jaGFyQXQoMCkgPT09ICcgJykge1xuICAgICAgICAgICAgICB0aGlzQ29va2llID0gdGhpc0Nvb2tpZS5zdWJzdHJpbmcoMSx0aGlzQ29va2llLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpc0Nvb2tpZS5pbmRleE9mKGRlcml2ZVF1YWxpZmllZEtleShrZXkpICsgJz0nKSA9PT0gMCkge1xuICAgICAgICAgICAgICB2YXIgc3RvcmVkVmFsdWVzID0gZGVjb2RlVVJJQ29tcG9uZW50KHRoaXNDb29raWUuc3Vic3RyaW5nKHByZWZpeC5sZW5ndGggKyBrZXkubGVuZ3RoICsgMSwgdGhpc0Nvb2tpZS5sZW5ndGgpKTtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB2YXIgcGFyc2VkVmFsdWUgPSBKU09OLnBhcnNlKHN0b3JlZFZhbHVlcyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHR5cGVvZihwYXJzZWRWYWx1ZSkgPT09ICdudW1iZXInID8gc3RvcmVkVmFsdWVzIDogcGFyc2VkVmFsdWU7XG4gICAgICAgICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdG9yZWRWYWx1ZXM7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIHJlbW92ZUZyb21Db29raWVzID0gZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgIGFkZFRvQ29va2llcyhrZXksbnVsbCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGNsZWFyQWxsRnJvbUNvb2tpZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIHRoaXNDb29raWUgPSBudWxsO1xuICAgICAgICAgIHZhciBwcmVmaXhMZW5ndGggPSBwcmVmaXgubGVuZ3RoO1xuICAgICAgICAgIHZhciBjb29raWVzID0gJGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnOycpO1xuICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjb29raWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzQ29va2llID0gY29va2llc1tpXTtcblxuICAgICAgICAgICAgd2hpbGUgKHRoaXNDb29raWUuY2hhckF0KDApID09PSAnICcpIHtcbiAgICAgICAgICAgICAgdGhpc0Nvb2tpZSA9IHRoaXNDb29raWUuc3Vic3RyaW5nKDEsIHRoaXNDb29raWUubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIGtleSA9IHRoaXNDb29raWUuc3Vic3RyaW5nKHByZWZpeExlbmd0aCwgdGhpc0Nvb2tpZS5pbmRleE9mKCc9JykpO1xuICAgICAgICAgICAgcmVtb3ZlRnJvbUNvb2tpZXMoa2V5KTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGdldFN0b3JhZ2VUeXBlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcmV0dXJuIHN0b3JhZ2VUeXBlO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBzZXRTdG9yYWdlVHlwZSA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgICAgICBpZiAodHlwZSAmJiBzdG9yYWdlVHlwZSAhPT0gdHlwZSkge1xuICAgICAgICAgICAgc3RvcmFnZVR5cGUgPSB0eXBlO1xuICAgICAgICAgICAgYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlID0gY2hlY2tTdXBwb3J0KCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2U7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gQWRkIGEgbGlzdGVuZXIgb24gc2NvcGUgdmFyaWFibGUgdG8gc2F2ZSBpdHMgY2hhbmdlcyB0byBsb2NhbCBzdG9yYWdlXG4gICAgICAgIC8vIFJldHVybiBhIGZ1bmN0aW9uIHdoaWNoIHdoZW4gY2FsbGVkIGNhbmNlbHMgYmluZGluZ1xuICAgICAgICB2YXIgYmluZFRvU2NvcGUgPSBmdW5jdGlvbihzY29wZSwga2V5LCBkZWYsIGxzS2V5LCB0eXBlKSB7XG4gICAgICAgICAgbHNLZXkgPSBsc0tleSB8fCBrZXk7XG4gICAgICAgICAgdmFyIHZhbHVlID0gZ2V0RnJvbUxvY2FsU3RvcmFnZShsc0tleSwgdHlwZSk7XG5cbiAgICAgICAgICBpZiAodmFsdWUgPT09IG51bGwgJiYgaXNEZWZpbmVkKGRlZikpIHtcbiAgICAgICAgICAgIHZhbHVlID0gZGVmO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaXNPYmplY3QodmFsdWUpICYmIGlzT2JqZWN0KGRlZikpIHtcbiAgICAgICAgICAgIHZhbHVlID0gZXh0ZW5kKHZhbHVlLCBkZWYpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgICRwYXJzZShrZXkpLmFzc2lnbihzY29wZSwgdmFsdWUpO1xuXG4gICAgICAgICAgcmV0dXJuIHNjb3BlLiR3YXRjaChrZXksIGZ1bmN0aW9uKG5ld1ZhbCkge1xuICAgICAgICAgICAgYWRkVG9Mb2NhbFN0b3JhZ2UobHNLZXksIG5ld1ZhbCwgdHlwZSk7XG4gICAgICAgICAgfSwgaXNPYmplY3Qoc2NvcGVba2V5XSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEFkZCBsaXN0ZW5lciB0byBsb2NhbCBzdG9yYWdlLCBmb3IgdXBkYXRlIGNhbGxiYWNrcy5cbiAgICAgICAgaWYgKGJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICAgaWYgKCR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICAgICAgICAgICR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInN0b3JhZ2VcIiwgaGFuZGxlU3RvcmFnZUNoYW5nZUNhbGxiYWNrLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICR3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcInN0b3JhZ2VcIiwgaGFuZGxlU3RvcmFnZUNoYW5nZUNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZigkd2luZG93LmF0dGFjaEV2ZW50KXtcbiAgICAgICAgICAgICAgICAvLyBhdHRhY2hFdmVudCBhbmQgZGV0YWNoRXZlbnQgYXJlIHByb3ByaWV0YXJ5IHRvIElFIHY2LTEwXG4gICAgICAgICAgICAgICAgJHdpbmRvdy5hdHRhY2hFdmVudChcIm9uc3RvcmFnZVwiLCBoYW5kbGVTdG9yYWdlQ2hhbmdlQ2FsbGJhY2spO1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAkd2luZG93LmRldGFjaEV2ZW50KFwib25zdG9yYWdlXCIsIGhhbmRsZVN0b3JhZ2VDaGFuZ2VDYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYWxsYmFjayBoYW5kbGVyIGZvciBzdG9yYWdlIGNoYW5nZWQuXG4gICAgICAgIGZ1bmN0aW9uIGhhbmRsZVN0b3JhZ2VDaGFuZ2VDYWxsYmFjayhlKSB7XG4gICAgICAgICAgICBpZiAoIWUpIHsgZSA9ICR3aW5kb3cuZXZlbnQ7IH1cbiAgICAgICAgICAgIGlmIChub3RpZnkuc2V0SXRlbSkge1xuICAgICAgICAgICAgICAgIGlmIChpc1N0cmluZyhlLmtleSkgJiYgaXNLZXlQcmVmaXhPdXJzKGUua2V5KSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIga2V5ID0gdW5kZXJpdmVRdWFsaWZpZWRLZXkoZS5rZXkpO1xuICAgICAgICAgICAgICAgICAgICAvLyBVc2UgdGltZW91dCwgdG8gYXZvaWQgdXNpbmcgJHJvb3RTY29wZS4kYXBwbHkuXG4gICAgICAgICAgICAgICAgICAgICR0aW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5jaGFuZ2VkJywgeyBrZXk6IGtleSwgbmV3dmFsdWU6IGUubmV3VmFsdWUsIHN0b3JhZ2VUeXBlOiBzZWxmLnN0b3JhZ2VUeXBlIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXR1cm4gbG9jYWxTdG9yYWdlU2VydmljZS5sZW5ndGhcbiAgICAgICAgLy8gaWdub3JlIGtleXMgdGhhdCBub3Qgb3duZWRcbiAgICAgICAgdmFyIGxlbmd0aE9mTG9jYWxTdG9yYWdlID0gZnVuY3Rpb24odHlwZSkge1xuICAgICAgICAgIHNldFN0b3JhZ2VUeXBlKHR5cGUpO1xuXG4gICAgICAgICAgdmFyIGNvdW50ID0gMDtcbiAgICAgICAgICB2YXIgc3RvcmFnZSA9ICR3aW5kb3dbc3RvcmFnZVR5cGVdO1xuICAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBzdG9yYWdlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZihzdG9yYWdlLmtleShpKS5pbmRleE9mKHByZWZpeCkgPT09IDAgKSB7XG4gICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBjb3VudDtcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGlzU3VwcG9ydGVkOiBicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UsXG4gICAgICAgICAgZ2V0U3RvcmFnZVR5cGU6IGdldFN0b3JhZ2VUeXBlLFxuICAgICAgICAgIHNldFN0b3JhZ2VUeXBlOiBzZXRTdG9yYWdlVHlwZSxcbiAgICAgICAgICBzZXQ6IGFkZFRvTG9jYWxTdG9yYWdlLFxuICAgICAgICAgIGFkZDogYWRkVG9Mb2NhbFN0b3JhZ2UsIC8vREVQUkVDQVRFRFxuICAgICAgICAgIGdldDogZ2V0RnJvbUxvY2FsU3RvcmFnZSxcbiAgICAgICAgICBrZXlzOiBnZXRLZXlzRm9yTG9jYWxTdG9yYWdlLFxuICAgICAgICAgIHJlbW92ZTogcmVtb3ZlRnJvbUxvY2FsU3RvcmFnZSxcbiAgICAgICAgICBjbGVhckFsbDogY2xlYXJBbGxGcm9tTG9jYWxTdG9yYWdlLFxuICAgICAgICAgIGJpbmQ6IGJpbmRUb1Njb3BlLFxuICAgICAgICAgIGRlcml2ZUtleTogZGVyaXZlUXVhbGlmaWVkS2V5LFxuICAgICAgICAgIHVuZGVyaXZlS2V5OiB1bmRlcml2ZVF1YWxpZmllZEtleSxcbiAgICAgICAgICBsZW5ndGg6IGxlbmd0aE9mTG9jYWxTdG9yYWdlLFxuICAgICAgICAgIGRlZmF1bHRUb0Nvb2tpZTogdGhpcy5kZWZhdWx0VG9Db29raWUsXG4gICAgICAgICAgY29va2llOiB7XG4gICAgICAgICAgICBpc1N1cHBvcnRlZDogYnJvd3NlclN1cHBvcnRzQ29va2llcyxcbiAgICAgICAgICAgIHNldDogYWRkVG9Db29raWVzLFxuICAgICAgICAgICAgYWRkOiBhZGRUb0Nvb2tpZXMsIC8vREVQUkVDQVRFRFxuICAgICAgICAgICAgZ2V0OiBnZXRGcm9tQ29va2llcyxcbiAgICAgICAgICAgIHJlbW92ZTogcmVtb3ZlRnJvbUNvb2tpZXMsXG4gICAgICAgICAgICBjbGVhckFsbDogY2xlYXJBbGxGcm9tQ29va2llc1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIH1dO1xuICB9KTtcbn0pKHdpbmRvdywgd2luZG93LmFuZ3VsYXIpOyIsIihmdW5jdGlvbigpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG5cdGFuZ3VsYXJcblx0XHQubW9kdWxlKCdhbmd1bGFyLW1hcnF1ZWUnLCBbXSlcblx0XHQuZGlyZWN0aXZlKCdhbmd1bGFyTWFycXVlZScsIGFuZ3VsYXJNYXJxdWVlKTtcblxuXHRmdW5jdGlvbiBhbmd1bGFyTWFycXVlZSgkdGltZW91dCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdFx0c2NvcGU6IHRydWUsXG5cdFx0XHRjb21waWxlOiBmdW5jdGlvbih0RWxlbWVudCwgdEF0dHJzKSB7XG5cdFx0XHRcdGlmICh0RWxlbWVudC5jaGlsZHJlbigpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHRFbGVtZW50LmFwcGVuZCgnPGRpdj4nICsgdEVsZW1lbnQudGV4dCgpICsgJzwvZGl2PicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBjb250ZW50ID0gdEVsZW1lbnQuY2hpbGRyZW4oKTtcbiAgICAgIFx0dmFyICRlbGVtZW50ID0gJCh0RWxlbWVudCk7XG5cdFx0XHRcdCQodEVsZW1lbnQpLmVtcHR5KCk7XG5cdFx0XHRcdHRFbGVtZW50LmFwcGVuZCgnPGRpdiBjbGFzcz1cImFuZ3VsYXItbWFycXVlZVwiIHN0eWxlPVwiZmxvYXQ6bGVmdDtcIj4nICsgY29udGVudC5jbG9uZSgpWzBdLm91dGVySFRNTCArICc8L2Rpdj4nKTtcbiAgICAgICAgdmFyICRpdGVtID0gJGVsZW1lbnQuZmluZCgnLmFuZ3VsYXItbWFycXVlZScpO1xuICAgICAgICAkaXRlbS5jbG9uZSgpLmNzcygnZGlzcGxheScsJ25vbmUnKS5hcHBlbmRUbygkZWxlbWVudCk7XG5cdFx0XHRcdCRlbGVtZW50LndyYXBJbm5lcignPGRpdiBzdHlsZT1cIndpZHRoOjEwMDAwMHB4XCIgY2xhc3M9XCJhbmd1bGFyLW1hcnF1ZWUtd3JhcHBlclwiPjwvZGl2PicpO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRwb3N0OiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcblx0XHRcdFx0XHRcdFx0Ly9kaXJlY3Rpb24sIGR1cmF0aW9uLFxuXHRcdFx0XHRcdFx0XHR2YXIgJGVsZW1lbnQgPSAkKGVsZW1lbnQpO1xuXHRcdFx0XHRcdFx0XHR2YXIgJGl0ZW0gPSAkZWxlbWVudC5maW5kKCcuYW5ndWxhci1tYXJxdWVlOmZpcnN0Jyk7XG5cdFx0XHRcdFx0XHRcdHZhciAkbWFycXVlZSA9ICRlbGVtZW50LmZpbmQoJy5hbmd1bGFyLW1hcnF1ZWUtd3JhcHBlcicpO1xuXHRcdFx0XHRcdFx0XHR2YXIgJGNsb25lSXRlbSA9ICRlbGVtZW50LmZpbmQoJy5hbmd1bGFyLW1hcnF1ZWU6bGFzdCcpO1xuXHRcdFx0XHRcdFx0XHR2YXIgZHVwbGljYXRlZCA9IGZhbHNlO1xuXG5cdFx0XHRcdFx0XHRcdHZhciBjb250YWluZXJXaWR0aCA9IHBhcnNlSW50KCRlbGVtZW50LndpZHRoKCkpO1xuXHRcdFx0XHRcdFx0XHR2YXIgaXRlbVdpZHRoID0gcGFyc2VJbnQoJGl0ZW0ud2lkdGgoKSk7XG5cdFx0XHRcdFx0XHRcdHZhciBkZWZhdWx0T2Zmc2V0ID0gMjA7XG5cdFx0XHRcdFx0XHRcdHZhciBkdXJhdGlvbiA9IDMwMDA7XG5cdFx0XHRcdFx0XHRcdHZhciBzY3JvbGwgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0dmFyIGFuaW1hdGlvbkNzc05hbWUgPSAnJztcblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBjYWxjdWxhdGVXaWR0aEFuZEhlaWdodCgpIHtcblx0XHRcdFx0XHRcdFx0XHRjb250YWluZXJXaWR0aCA9IHBhcnNlSW50KCRlbGVtZW50LndpZHRoKCkpO1xuXHRcdFx0XHRcdFx0XHRcdGl0ZW1XaWR0aCA9IHBhcnNlSW50KCRpdGVtLndpZHRoKCkpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChpdGVtV2lkdGggPiBjb250YWluZXJXaWR0aCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZHVwbGljYXRlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdGR1cGxpY2F0ZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHRpZiAoZHVwbGljYXRlZCkge1xuXHRcdFx0XHRcdFx0XHRcdCRjbG9uZUl0ZW0uc2hvdygpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQkY2xvbmVJdGVtLmhpZGUoKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0XHQkZWxlbWVudC5oZWlnaHQoJGl0ZW0uaGVpZ2h0KCkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gX29ialRvU3RyaW5nKG9iaikge1xuXHRcdFx0XHRcdFx0XHRcdHZhciB0YWJqc29uID0gW107XG5cdFx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgcCBpbiBvYmopIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0aWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dGFianNvbi5wdXNoKHAgKyAnOicgKyBvYmpbcF0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHRhYmpzb24ucHVzaCgpO1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiAneycgKyB0YWJqc29uLmpvaW4oJywnKSArICd9Jztcblx0XHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBjYWxjdWxhdGVBbmltYXRpb25EdXJhdGlvbihuZXdEdXJhdGlvbikge1xuXHRcdFx0XHRcdFx0XHRcdHZhciByZXN1bHQgPSAoaXRlbVdpZHRoICsgY29udGFpbmVyV2lkdGgpIC8gY29udGFpbmVyV2lkdGggKiBuZXdEdXJhdGlvbiAvIDEwMDA7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGR1cGxpY2F0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJlc3VsdCA9IHJlc3VsdCAvIDI7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBnZXRBbmltYXRpb25QcmVmaXgoKSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGVsbSA9IGRvY3VtZW50LmJvZHkgfHwgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGRvbVByZWZpeGVzID0gWyd3ZWJraXQnLCAnbW96JywnTycsJ21zJywnS2h0bWwnXTtcblxuXHRcdFx0XHRcdFx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZG9tUHJlZml4ZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChlbG0uc3R5bGVbZG9tUHJlZml4ZXNbaV0gKyAnQW5pbWF0aW9uTmFtZSddICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dmFyIHByZWZpeCA9IGRvbVByZWZpeGVzW2ldLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcmVmaXg7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gY3JlYXRlS2V5ZnJhbWUobnVtYmVyKSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIHByZWZpeCA9IGdldEFuaW1hdGlvblByZWZpeCgpO1xuXG5cdFx0XHRcdFx0XHRcdFx0dmFyIG1hcmdpbiA9IGl0ZW1XaWR0aDtcblx0XHRcdFx0XHRcdFx0XHQvLyBpZiAoZHVwbGljYXRlZCkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIFx0bWFyZ2luID0gaXRlbVdpZHRoXG5cdFx0XHRcdFx0XHRcdFx0Ly8gfSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBcdG1hcmdpbiA9IGl0ZW1XaWR0aCArIGNvbnRhaW5lcldpZHRoO1xuXHRcdFx0XHRcdFx0XHRcdC8vIH1cblx0XHRcdFx0XHRcdFx0XHR2YXIga2V5ZnJhbWVTdHJpbmcgPSAnQC0nICsgcHJlZml4ICsgJy1rZXlmcmFtZXMgJyArICdzaW1wbGVNYXJxdWVlJyArIG51bWJlcjtcblx0XHRcdFx0XHRcdFx0XHR2YXIgY3NzID0ge1xuXHRcdFx0XHRcdFx0XHRcdFx0J21hcmdpbi1sZWZ0JzogLSAobWFyZ2luKSArJ3B4J1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR2YXIga2V5ZnJhbWVDc3MgPSBrZXlmcmFtZVN0cmluZyArICd7IDEwMCUnICsgX29ialRvU3RyaW5nKGNzcykgKyAnfSc7XG5cdFx0XHRcdFx0XHRcdFx0dmFyICRzdHlsZXMgPSAkKCdzdHlsZScpO1xuXG5cdFx0XHRcdFx0XHRcdFx0Ly9Ob3cgYWRkIHRoZSBrZXlmcmFtZSBhbmltYXRpb24gdG8gdGhlIGhlYWRcblx0XHRcdFx0XHRcdFx0XHRpZiAoJHN0eWxlcy5sZW5ndGggIT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9CdWcgZml4ZWQgZm9yIGpRdWVyeSAxLjMueCAtIEluc3RlYWQgb2YgdXNpbmcgLmxhc3QoKSwgdXNlIGZvbGxvd2luZ1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQkc3R5bGVzLmZpbHRlcihcIjpsYXN0XCIpLmFwcGVuZChrZXlmcmFtZUNzcyk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0JCgnaGVhZCcpLmFwcGVuZCgnPHN0eWxlPicgKyBrZXlmcmFtZUNzcyArICc8L3N0eWxlPicpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIHN0b3BBbmltYXRpb24oKSB7XG5cdFx0XHRcdFx0XHRcdFx0JG1hcnF1ZWUuY3NzKCdtYXJnaW4tbGVmdCcsMCk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGFuaW1hdGlvbkNzc05hbWUgIT0gJycpIHtcblx0XHRcdFx0XHRcdFx0XHRcdCRtYXJxdWVlLmNzcyhhbmltYXRpb25Dc3NOYW1lLCAnJyk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdH1cblxuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIGNyZWF0ZUFuaW1hdGlvbkNzcyhudW1iZXIpIHtcblx0XHRcdFx0XHRcdFx0XHR2YXIgdGltZSA9IGNhbGN1bGF0ZUFuaW1hdGlvbkR1cmF0aW9uKGR1cmF0aW9uKTtcblx0XHRcdFx0XHRcdFx0XHR2YXIgcHJlZml4ID0gZ2V0QW5pbWF0aW9uUHJlZml4KCk7XG5cdFx0XHRcdFx0XHRcdFx0YW5pbWF0aW9uQ3NzTmFtZSA9ICctJyArIHByZWZpeCArJy1hbmltYXRpb24nO1xuXHRcdFx0XHRcdFx0XHRcdHZhciBjc3NWYWx1ZSA9ICdzaW1wbGVNYXJxdWVlJyArIG51bWJlciArICcgJyArIHRpbWUgKyAncyAwcyBsaW5lYXIgaW5maW5pdGUnO1xuXHRcdFx0XHRcdFx0XHRcdCRtYXJxdWVlLmNzcyhhbmltYXRpb25Dc3NOYW1lLCBjc3NWYWx1ZSk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGR1cGxpY2F0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdCRtYXJxdWVlLmNzcygnbWFyZ2luLWxlZnQnLCAwKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIG1hcmdpbiA9IGNvbnRhaW5lcldpZHRoICsgZGVmYXVsdE9mZnNldDtcblx0XHRcdFx0XHRcdFx0XHRcdCRtYXJxdWVlLmNzcygnbWFyZ2luLWxlZnQnLCBtYXJnaW4pO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIGFuaW1hdGUoKSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly9jcmVhdGUgY3NzIHN0eWxlXG5cdFx0XHRcdFx0XHRcdFx0Ly9jcmVhdGUga2V5ZnJhbWVcblx0XHRcdFx0XHRcdFx0XHRjYWxjdWxhdGVXaWR0aEFuZEhlaWdodCgpO1xuXHRcdFx0XHRcdFx0XHRcdHZhciBudW1iZXIgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAxMDAwMDAwKTtcblx0XHRcdFx0XHRcdFx0XHRjcmVhdGVLZXlmcmFtZShudW1iZXIpO1xuXHRcdFx0XHRcdFx0XHRcdGNyZWF0ZUFuaW1hdGlvbkNzcyhudW1iZXIpO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0c2NvcGUuJHdhdGNoKGF0dHJzLnNjcm9sbCwgZnVuY3Rpb24oc2Nyb2xsQXR0clZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdFx0c2Nyb2xsID0gc2Nyb2xsQXR0clZhbHVlO1xuXHRcdFx0XHRcdFx0XHRcdHJlY2FsY3VsYXRlTWFycXVlZSgpO1xuXHRcdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiByZWNhbGN1bGF0ZU1hcnF1ZWUoKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHNjcm9sbCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0YW5pbWF0ZSgpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRzdG9wQW5pbWF0aW9uKCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0dmFyIHRpbWVyO1xuXHRcdFx0XHRcdFx0XHRzY29wZS4kb24oJ3JlY2FsY3VsYXRlTWFycXVlZScsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ3JlY2VpdmUgcmVjYWxjdWxhdGVNYXJxdWVlIGV2ZW50Jyk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHRpbWVyKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQkdGltZW91dC5jYW5jZWwodGltZXIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR0aW1lciA9ICR0aW1lb3V0KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmVjYWxjdWxhdGVNYXJxdWVlKCk7XG5cdFx0XHRcdFx0XHRcdFx0fSwgNTAwKTtcblxuXHRcdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0XHRzY29wZS4kd2F0Y2goYXR0cnMuZHVyYXRpb24sIGZ1bmN0aW9uKGR1cmF0aW9uVGV4dCkge1xuXHRcdFx0XHRcdFx0XHRcdGR1cmF0aW9uID0gcGFyc2VJbnQoZHVyYXRpb25UZXh0KTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoc2Nyb2xsKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRhbmltYXRlKCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdH1cblxufSkoKTsiLCIvKiBnbG9iYWwgWVQgKi9cbmFuZ3VsYXIubW9kdWxlKCd5b3V0dWJlLWVtYmVkJywgW10pXG4uc2VydmljZSAoJ3lvdXR1YmVFbWJlZFV0aWxzJywgWyckd2luZG93JywgJyRyb290U2NvcGUnLCBmdW5jdGlvbiAoJHdpbmRvdywgJHJvb3RTY29wZSkge1xuICAgIHZhciBTZXJ2aWNlID0ge31cblxuICAgIC8vIGFkYXB0ZWQgZnJvbSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS81ODMxMTkxLzE2MTQ5NjdcbiAgICB2YXIgeW91dHViZVJlZ2V4cCA9IC9odHRwcz86XFwvXFwvKD86WzAtOUEtWi1dK1xcLik/KD86eW91dHVcXC5iZVxcL3x5b3V0dWJlKD86LW5vY29va2llKT9cXC5jb21cXFMqW15cXHdcXHMtXSkoW1xcdy1dezExfSkoPz1bXlxcdy1dfCQpKD8hWz89JislXFx3Li1dKig/OlsnXCJdW148Pl0qPnw8XFwvYT4pKVs/PSYrJVxcdy4tXSovaWc7XG4gICAgdmFyIHRpbWVSZWdleHAgPSAvdD0oXFxkKylbbXNdPyhcXGQrKT9zPy87XG5cbiAgICBmdW5jdGlvbiBjb250YWlucyhzdHIsIHN1YnN0cikge1xuICAgICAgICByZXR1cm4gKHN0ci5pbmRleE9mKHN1YnN0cikgPiAtMSk7XG4gICAgfVxuXG4gICAgU2VydmljZS5nZXRJZEZyb21VUkwgPSBmdW5jdGlvbiBnZXRJZEZyb21VUkwodXJsKSB7XG4gICAgICAgIHZhciBpZCA9IHVybC5yZXBsYWNlKHlvdXR1YmVSZWdleHAsICckMScpO1xuXG4gICAgICAgIGlmIChjb250YWlucyhpZCwgJzsnKSkge1xuICAgICAgICAgICAgdmFyIHBpZWNlcyA9IGlkLnNwbGl0KCc7Jyk7XG5cbiAgICAgICAgICAgIGlmIChjb250YWlucyhwaWVjZXNbMV0sICclJykpIHtcbiAgICAgICAgICAgICAgICAvLyBsaW5rcyBsaWtlIHRoaXM6XG4gICAgICAgICAgICAgICAgLy8gXCJodHRwOi8vd3d3LnlvdXR1YmUuY29tL2F0dHJpYnV0aW9uX2xpbms/YT1weGE2Z29IcXphQSZhbXA7dT0lMkZ3YXRjaCUzRnYlM0RkUGRneDMwdzlzVSUyNmZlYXR1cmUlM0RzaGFyZVwiXG4gICAgICAgICAgICAgICAgLy8gaGF2ZSB0aGUgcmVhbCBxdWVyeSBzdHJpbmcgVVJJIGVuY29kZWQgYmVoaW5kIGEgJzsnLlxuICAgICAgICAgICAgICAgIC8vIGF0IHRoaXMgcG9pbnQsIGBpZCBpcyAncHhhNmdvSHF6YUE7dT0lMkZ3YXRjaCUzRnYlM0RkUGRneDMwdzlzVSUyNmZlYXR1cmUlM0RzaGFyZSdcbiAgICAgICAgICAgICAgICB2YXIgdXJpQ29tcG9uZW50ID0gZGVjb2RlVVJJQ29tcG9uZW50KHBpZWNlc1sxXSk7XG4gICAgICAgICAgICAgICAgaWQgPSAoJ2h0dHA6Ly95b3V0dWJlLmNvbScgKyB1cmlDb21wb25lbnQpXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSh5b3V0dWJlUmVnZXhwLCAnJDEnKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly93d3cueW91dHViZS5jb20vd2F0Y2g/dj1WYk5GOVgxd2FTYyZhbXA7ZmVhdHVyZT15b3V0dS5iZVxuICAgICAgICAgICAgICAgIC8vIGBpZGAgbG9va3MgbGlrZSAnVmJORjlYMXdhU2M7ZmVhdHVyZT15b3V0dS5iZScgY3VycmVudGx5LlxuICAgICAgICAgICAgICAgIC8vIHN0cmlwIHRoZSAnO2ZlYXR1cmU9eW91dHUuYmUnXG4gICAgICAgICAgICAgICAgaWQgPSBwaWVjZXNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoY29udGFpbnMoaWQsICcjJykpIHtcbiAgICAgICAgICAgIC8vIGlkIG1pZ2h0IGxvb2sgbGlrZSAnOTNMdlRLRl9qVzAjdD0xJ1xuICAgICAgICAgICAgLy8gYW5kIHdlIHdhbnQgJzkzTHZUS0ZfalcwJ1xuICAgICAgICAgICAgaWQgPSBpZC5zcGxpdCgnIycpWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGlkO1xuICAgIH07XG5cbiAgICBTZXJ2aWNlLmdldFRpbWVGcm9tVVJMID0gZnVuY3Rpb24gZ2V0VGltZUZyb21VUkwodXJsKSB7XG4gICAgICAgIHVybCA9IHVybCB8fCAnJztcblxuICAgICAgICAvLyB0PTRtMjBzXG4gICAgICAgIC8vIHJldHVybnMgWyd0PTRtMjBzJywgJzQnLCAnMjAnXVxuICAgICAgICAvLyB0PTQ2c1xuICAgICAgICAvLyByZXR1cm5zIFsndD00NnMnLCAnNDYnXVxuICAgICAgICAvLyB0PTQ2XG4gICAgICAgIC8vIHJldHVybnMgWyd0PTQ2JywgJzQ2J11cbiAgICAgICAgdmFyIHRpbWVzID0gdXJsLm1hdGNoKHRpbWVSZWdleHApO1xuXG4gICAgICAgIGlmICghdGltZXMpIHtcbiAgICAgICAgICAgIC8vIHplcm8gc2Vjb25kc1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhc3N1bWUgdGhlIGZpcnN0XG4gICAgICAgIHZhciBmdWxsID0gdGltZXNbMF0sXG4gICAgICAgICAgICBtaW51dGVzID0gdGltZXNbMV0sXG4gICAgICAgICAgICBzZWNvbmRzID0gdGltZXNbMl07XG5cbiAgICAgICAgLy8gdD00bTIwc1xuICAgICAgICBpZiAodHlwZW9mIHNlY29uZHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBzZWNvbmRzID0gcGFyc2VJbnQoc2Vjb25kcywgMTApO1xuICAgICAgICAgICAgbWludXRlcyA9IHBhcnNlSW50KG1pbnV0ZXMsIDEwKTtcblxuICAgICAgICAvLyB0PTRtXG4gICAgICAgIH0gZWxzZSBpZiAoY29udGFpbnMoZnVsbCwgJ20nKSkge1xuICAgICAgICAgICAgbWludXRlcyA9IHBhcnNlSW50KG1pbnV0ZXMsIDEwKTtcbiAgICAgICAgICAgIHNlY29uZHMgPSAwO1xuXG4gICAgICAgIC8vIHQ9NHNcbiAgICAgICAgLy8gdD00XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZWNvbmRzID0gcGFyc2VJbnQobWludXRlcywgMTApO1xuICAgICAgICAgICAgbWludXRlcyA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpbiBzZWNvbmRzXG4gICAgICAgIHJldHVybiBzZWNvbmRzICsgKG1pbnV0ZXMgKiA2MCk7XG4gICAgfTtcblxuICAgIFNlcnZpY2UucmVhZHkgPSBmYWxzZTtcblxuICAgIGZ1bmN0aW9uIGFwcGx5U2VydmljZUlzUmVhZHkoKSB7XG4gICAgICAgICRyb290U2NvcGUuJGFwcGx5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIFNlcnZpY2UucmVhZHkgPSB0cnVlO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gSWYgdGhlIGxpYnJhcnkgaXNuJ3QgaGVyZSBhdCBhbGwsXG4gICAgaWYgKHR5cGVvZiBZVCA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAvLyAuLi5ncmFiIG9uIHRvIGdsb2JhbCBjYWxsYmFjaywgaW4gY2FzZSBpdCdzIGV2ZW50dWFsbHkgbG9hZGVkXG4gICAgICAgICR3aW5kb3cub25Zb3VUdWJlSWZyYW1lQVBJUmVhZHkgPSBhcHBseVNlcnZpY2VJc1JlYWR5O1xuICAgICAgICBjb25zb2xlLmxvZygnVW5hYmxlIHRvIGZpbmQgWW91VHViZSBpZnJhbWUgbGlicmFyeSBvbiB0aGlzIHBhZ2UuJylcbiAgICB9IGVsc2UgaWYgKFlULmxvYWRlZCkge1xuICAgICAgICBTZXJ2aWNlLnJlYWR5ID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBZVC5yZWFkeShhcHBseVNlcnZpY2VJc1JlYWR5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gU2VydmljZTtcbn1dKVxuLmRpcmVjdGl2ZSgneW91dHViZVZpZGVvJywgWyckd2luZG93JywgJ3lvdXR1YmVFbWJlZFV0aWxzJywgZnVuY3Rpb24gKCR3aW5kb3csIHlvdXR1YmVFbWJlZFV0aWxzKSB7XG4gICAgdmFyIHVuaXFJZCA9IDE7XG5cbiAgICAvLyBmcm9tIFlULlBsYXllclN0YXRlXG4gICAgdmFyIHN0YXRlTmFtZXMgPSB7XG4gICAgICAgICctMSc6ICd1bnN0YXJ0ZWQnLFxuICAgICAgICAwOiAnZW5kZWQnLFxuICAgICAgICAxOiAncGxheWluZycsXG4gICAgICAgIDI6ICdwYXVzZWQnLFxuICAgICAgICAzOiAnYnVmZmVyaW5nJyxcbiAgICAgICAgNTogJ3F1ZXVlZCdcbiAgICB9O1xuXG4gICAgdmFyIGV2ZW50UHJlZml4ID0gJ3lvdXR1YmUucGxheWVyLic7XG5cbiAgICAkd2luZG93LllUQ29uZmlnID0ge1xuICAgICAgICBob3N0OiAnaHR0cHM6Ly93d3cueW91dHViZS5jb20nXG4gICAgfTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRUEnLFxuICAgICAgICBzY29wZToge1xuICAgICAgICAgICAgdmlkZW9JZDogJz0/JyxcbiAgICAgICAgICAgIHZpZGVvVXJsOiAnPT8nLFxuICAgICAgICAgICAgcGxheWVyOiAnPT8nLFxuICAgICAgICAgICAgcGxheWVyVmFyczogJz0/JyxcbiAgICAgICAgICAgIHBsYXllckhlaWdodDogJz0/JyxcbiAgICAgICAgICAgIHBsYXllcldpZHRoOiAnPT8nXG4gICAgICAgIH0sXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcbiAgICAgICAgICAgIC8vIGFsbG93cyB1cyB0byAkd2F0Y2ggYHJlYWR5YFxuICAgICAgICAgICAgc2NvcGUudXRpbHMgPSB5b3V0dWJlRW1iZWRVdGlscztcblxuICAgICAgICAgICAgLy8gcGxheWVyLWlkIGF0dHIgPiBpZCBhdHRyID4gZGlyZWN0aXZlLWdlbmVyYXRlZCBJRFxuICAgICAgICAgICAgdmFyIHBsYXllcklkID0gYXR0cnMucGxheWVySWQgfHwgZWxlbWVudFswXS5pZCB8fCAndW5pcXVlLXlvdXR1YmUtZW1iZWQtaWQtJyArIHVuaXFJZCsrO1xuICAgICAgICAgICAgZWxlbWVudFswXS5pZCA9IHBsYXllcklkO1xuXG4gICAgICAgICAgICAvLyBBdHRhY2ggdG8gZWxlbWVudFxuICAgICAgICAgICAgc2NvcGUucGxheWVySGVpZ2h0ID0gc2NvcGUucGxheWVySGVpZ2h0IHx8IDM5MDtcbiAgICAgICAgICAgIHNjb3BlLnBsYXllcldpZHRoID0gc2NvcGUucGxheWVyV2lkdGggfHwgNjQwO1xuICAgICAgICAgICAgc2NvcGUucGxheWVyVmFycyA9IHNjb3BlLnBsYXllclZhcnMgfHwge307XG5cbiAgICAgICAgICAgIC8vIFlUIGNhbGxzIGNhbGxiYWNrcyBvdXRzaWRlIG9mIGRpZ2VzdCBjeWNsZVxuICAgICAgICAgICAgZnVuY3Rpb24gYXBwbHlCcm9hZGNhc3QgKCkge1xuICAgICAgICAgICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICBzY29wZS4kYXBwbHkoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBzY29wZS4kZW1pdC5hcHBseShzY29wZSwgYXJncyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uUGxheWVyU3RhdGVDaGFuZ2UgKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgdmFyIHN0YXRlID0gc3RhdGVOYW1lc1tldmVudC5kYXRhXTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHN0YXRlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICBhcHBseUJyb2FkY2FzdChldmVudFByZWZpeCArIHN0YXRlLCBzY29wZS5wbGF5ZXIsIGV2ZW50KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2NvcGUuJGFwcGx5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUucGxheWVyLmN1cnJlbnRTdGF0ZSA9IHN0YXRlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmdW5jdGlvbiBvblBsYXllclJlYWR5IChldmVudCkge1xuICAgICAgICAgICAgICAgIGFwcGx5QnJvYWRjYXN0KGV2ZW50UHJlZml4ICsgJ3JlYWR5Jywgc2NvcGUucGxheWVyLCBldmVudCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZ1bmN0aW9uIG9uUGxheWVyRXJyb3IgKGV2ZW50KSB7XG4gICAgICAgICAgICAgICAgYXBwbHlCcm9hZGNhc3QoZXZlbnRQcmVmaXggKyAnZXJyb3InLCBzY29wZS5wbGF5ZXIsIGV2ZW50KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gY3JlYXRlUGxheWVyICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgcGxheWVyVmFycyA9IGFuZ3VsYXIuY29weShzY29wZS5wbGF5ZXJWYXJzKTtcbiAgICAgICAgICAgICAgICBwbGF5ZXJWYXJzLnN0YXJ0ID0gcGxheWVyVmFycy5zdGFydCB8fCBzY29wZS51cmxTdGFydFRpbWU7XG4gICAgICAgICAgICAgICAgdmFyIHBsYXllciA9IG5ldyBZVC5QbGF5ZXIocGxheWVySWQsIHtcbiAgICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBzY29wZS5wbGF5ZXJIZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgIHdpZHRoOiBzY29wZS5wbGF5ZXJXaWR0aCxcbiAgICAgICAgICAgICAgICAgICAgdmlkZW9JZDogc2NvcGUudmlkZW9JZCxcbiAgICAgICAgICAgICAgICAgICAgcGxheWVyVmFyczogcGxheWVyVmFycyxcbiAgICAgICAgICAgICAgICAgICAgZXZlbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvblJlYWR5OiBvblBsYXllclJlYWR5LFxuICAgICAgICAgICAgICAgICAgICAgICAgb25TdGF0ZUNoYW5nZTogb25QbGF5ZXJTdGF0ZUNoYW5nZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uRXJyb3I6IG9uUGxheWVyRXJyb3JcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcGxheWVyLmlkID0gcGxheWVySWQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBsYXllcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZnVuY3Rpb24gbG9hZFBsYXllciAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNjb3BlLnZpZGVvSWQgfHwgc2NvcGUucGxheWVyVmFycy5saXN0KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzY29wZS5wbGF5ZXIgJiYgdHlwZW9mIHNjb3BlLnBsYXllci5kZXN0cm95ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzY29wZS5wbGF5ZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgc2NvcGUucGxheWVyID0gY3JlYXRlUGxheWVyKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHN0b3BXYXRjaGluZ1JlYWR5ID0gc2NvcGUuJHdhdGNoKFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHNjb3BlLnV0aWxzLnJlYWR5XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBXYWl0IHVudGlsIG9uZSBvZiB0aGVtIGlzIGRlZmluZWQuLi5cbiAgICAgICAgICAgICAgICAgICAgICAgICYmICh0eXBlb2Ygc2NvcGUudmlkZW9VcmwgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCAgdHlwZW9mIHNjb3BlLnZpZGVvSWQgIT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICAgICAgICAgICAgICB8fCAgdHlwZW9mIHNjb3BlLnBsYXllclZhcnMubGlzdCAhPT0gJ3VuZGVmaW5lZCcpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gKHJlYWR5KSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWFkeSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3RvcFdhdGNoaW5nUmVhZHkoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVVJMIHRha2VzIGZpcnN0IHByaW9yaXR5XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHNjb3BlLnZpZGVvVXJsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLiR3YXRjaCgndmlkZW9VcmwnLCBmdW5jdGlvbiAodXJsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLnZpZGVvSWQgPSBzY29wZS51dGlscy5nZXRJZEZyb21VUkwodXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUudXJsU3RhcnRUaW1lID0gc2NvcGUudXRpbHMuZ2V0VGltZUZyb21VUkwodXJsKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2FkUGxheWVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZW4sIGEgdmlkZW8gSURcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNjb3BlLnZpZGVvSWQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUuJHdhdGNoKCd2aWRlb0lkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZS51cmxTdGFydFRpbWUgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2FkUGxheWVyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZpbmFsbHksIGEgbGlzdFxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZS4kd2F0Y2goJ3BsYXllclZhcnMubGlzdCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUudXJsU3RhcnRUaW1lID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZFBsYXllcigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc2NvcGUuJHdhdGNoQ29sbGVjdGlvbihbJ3BsYXllckhlaWdodCcsICdwbGF5ZXJXaWR0aCddLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NvcGUucGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLnBsYXllci5zZXRTaXplKHNjb3BlLnBsYXllcldpZHRoLCBzY29wZS5wbGF5ZXJIZWlnaHQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBzY29wZS4kb24oJyRkZXN0cm95JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNjb3BlLnBsYXllciAmJiBzY29wZS5wbGF5ZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xufV0pO1xuIiwidmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKFwibnR1QXBwXCIsIFsnTG9jYWxTdG9yYWdlTW9kdWxlJywgJ2FuZ3VsYXItbWFycXVlZScsICd5b3V0dWJlLWVtYmVkJ10pO1xuXG5cbmFwcC5jb25maWcoZnVuY3Rpb24obG9jYWxTdG9yYWdlU2VydmljZVByb3ZpZGVyKSB7XG4gICAgbG9jYWxTdG9yYWdlU2VydmljZVByb3ZpZGVyXG4gICAgICAgIC5zZXRQcmVmaXgoJ05UVS1JQ0FOLVBMQVlFUicpO1xufSk7XG5cbmFwcC5kaXJlY3RpdmUoJ3ByZXNzRW50ZXInLCBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzKSB7XG4gICAgICAgIGVsZW1lbnQuYmluZChcImtleWRvd24ga2V5cHJlc3NcIiwgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIGlmIChldmVudC53aGljaCA9PT0gMTMpIHtcbiAgICAgICAgICAgICAgICBzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLiRldmFsKGF0dHJzLnByZXNzRW50ZXIpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcbn0pO1xuYXBwLmNvbnRyb2xsZXIoXCJNdXNpY1BsYXllckNvbnRyb2xsZXJcIiwgZnVuY3Rpb24oJHNjb3BlLCAkdGltZW91dCwgJGxvY2F0aW9uLCAkaHR0cCwgUGxheWVyRmFjdG9yeSwgZ29vZ2xlU2VydmljZSwgbG9jYWxTdG9yYWdlU2VydmljZSkge1xuICAgICRzY29wZS5zZWFyY2hpbmcgPSBmYWxzZTtcbiAgICAkc2NvcGUubXVzaWNMaXN0cyA9IFtdO1xuICAgICRzY29wZS5zZWFyY2hRdWVyeSA9IFwiXCI7XG4gICAgJHNjb3BlLmN1cnJlbnRZb3V0dWJlVmlkZW8gPSB1bmRlZmluZWQ7XG4gICAgJHNjb3BlLmlzRmF2b3JpdGVNb2RlID0gZmFsc2U7XG4gICAgJHNjb3BlLmZhdm9yaXRlTGlzdHMgPSBbXTtcblxuICAgIC8v5qiZ6aGM6LeR6aas54eIIE1hcnF1ZWVcbiAgICAkc2NvcGUuZHVyYXRpb24gPSAxMDAwMDtcblxuICAgIGZ1bmN0aW9uIGFkZE1hcnF1ZWUobXVzaWNMaXN0cykge1xuICAgICAgICBpZiAobXVzaWNMaXN0cy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgbXVzaWNMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uKG0sIGkpIHtcbiAgICAgICAgICAgICAgICBtLm1hcnF1ZWUgPSB7IHNjcm9sbDogZmFsc2UgfTtcblxuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy95b3V0dWJlXG4gICAgJHNjb3BlLnBsYXllclZhcnMgPSB7XG4gICAgICAgIGNvbnRyb2xzOiAwLFxuICAgICAgICBhdXRvcGxheTogMVxuICAgIH07XG5cblxuICAgICRzY29wZS5pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICRzY29wZS5tdXNpY0xpc3RzID0gbG9hZFNlYXJjaCgpO1xuICAgICAgICB2YXIgZmF2b3JpdGVMaXN0cyA9IGxvYWRGYXZvcml0ZSgpO1xuICAgICAgICAkc2NvcGUuZmF2b3JpdGVMaXN0cyA9IGZhdm9yaXRlTGlzdHM7XG4gICAgICAgIGlmIChmYXZvcml0ZUxpc3RzKVxuICAgICAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMuZm9yRWFjaChmdW5jdGlvbihtLCBpKSB7XG4gICAgICAgICAgICAgICAgZmF2b3JpdGVMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uKGYsIGopIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG0uX2lkID09IGYuX2lkKSBtLmlzRmF2b3JpdGUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIGFkZE1hcnF1ZWUoJHNjb3BlLm11c2ljTGlzdHMpO1xuXG4gICAgfVxuXG4gICAgJHNjb3BlLnN3aXRjaEZhdm9yaXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICRzY29wZS5pc0Zhdm9yaXRlTW9kZSA9ICEkc2NvcGUuaXNGYXZvcml0ZU1vZGU7XG4gICAgICAgIGlmICgkc2NvcGUuaXNGYXZvcml0ZU1vZGUpIHtcbiAgICAgICAgICAgIHZhciBmYXZvcml0ZUxpc3RzID0gbG9hZEZhdm9yaXRlKCk7XG4gICAgICAgICAgICAkc2NvcGUuZmF2b3JpdGVMaXN0cyA9IGZhdm9yaXRlTGlzdHM7XG4gICAgICAgICAgICAkc2NvcGUubXVzaWNMaXN0cyA9IGZhdm9yaXRlTGlzdHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAkc2NvcGUuaW5pdCgpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICAkc2NvcGUuc2VhcmNoID0gZnVuY3Rpb24ocXVlcnkpIHtcblxuICAgICAgICAkc2NvcGUubXVzaWNMaXN0cyA9IFtdO1xuICAgICAgICAkc2NvcGUuc2VhcmNoaW5nID0gdHJ1ZTtcbiAgICAgICAgZ29vZ2xlU2VydmljZS5nb29nbGVBcGlDbGllbnRSZWFkeShxdWVyeSkudGhlbihmdW5jdGlvbihkYXRhKSB7XG5cbiAgICAgICAgICAgIGlmIChkYXRhLml0ZW1zKSB7XG4gICAgICAgICAgICAgICAgZGF0YS5pdGVtcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGl0ZW1bJ2lkJ11bJ3ZpZGVvSWQnXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIG11c2ljQ2FyZCA9IHt9O1xuICAgICAgICAgICAgICAgICAgICAgICAgbXVzaWNDYXJkLl9pZCA9IGl0ZW1bJ2lkJ11bJ3ZpZGVvSWQnXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC50aXRsZSA9IGl0ZW1bJ3NuaXBwZXQnXVsndGl0bGUnXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC51cmwgPSBcImh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL2VtYmVkL1wiICsgbXVzaWNDYXJkLl9pZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC5pbWFnZSA9IFwiaHR0cDovL2ltZy55b3V0dWJlLmNvbS92aS9cIiArIG11c2ljQ2FyZC5faWQgKyBcIi8wLmpwZ1wiO1xuICAgICAgICAgICAgICAgICAgICAgICAgbXVzaWNDYXJkLmRlc2NyaXB0aW9uID0gaXRlbVsnc25pcHBldCddWydkZXNjcmlwdGlvbiddO1xuICAgICAgICAgICAgICAgICAgICAgICAgbXVzaWNDYXJkLmlzU2VsZWN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICBtdXNpY0NhcmQuaXNGYXZvcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMucHVzaChtdXNpY0NhcmQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhbGVydChcIuaQnOWwi+mMr+iqpFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICRzY29wZS5zZWFyY2hpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHNhdmVTZWFyY2goJHNjb3BlLm11c2ljTGlzdHMpO1xuICAgICAgICAgICAgYWRkTWFycXVlZSgkc2NvcGUubXVzaWNMaXN0cyk7XG4gICAgICAgIH0pO1xuXG5cbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIGxvYWRTZWFyY2goKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwi6K6A5Y+W5LiK5qyh5pCc5bCL54uA5oWLLi5cIik7XG4gICAgICAgIGlmIChsb2NhbFN0b3JhZ2VTZXJ2aWNlLmlzU3VwcG9ydGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0TG9jYWxTdG9yZ2UoJ05UVS1JQ0FOLVBMQVlFUi1TRUFSQ0gnKTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2F2ZVNlYXJjaChtdXNpY0xpc3RzKSB7XG5cbiAgICAgICAgaWYgKGxvY2FsU3RvcmFnZVNlcnZpY2UuaXNTdXBwb3J0ZWQpIHtcblxuICAgICAgICAgICAgc2V0TG9jYWxTdG9yZ2UoJ05UVS1JQ0FOLVBMQVlFUi1TRUFSQ0gnLCBtdXNpY0xpc3RzKVxuICAgICAgICB9XG5cblxuICAgIH1cblxuXG5cbiAgICAkc2NvcGUucGxheVZpZGVvID0gZnVuY3Rpb24oZXZlbnQsIG11c2ljQ2FyZCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgY29uc29sZS5sb2cobXVzaWNDYXJkKTtcbiAgICAgICAgLy8gcGxheVZpZGVvU2V0dGluZyhtdXNpY0NhcmQpO1xuXG4gICAgICAgIHBsYXlWaWRlb0luUGxheWVyKG11c2ljQ2FyZC5faWQpO1xuICAgIH1cblxuICAgIC8vIGZ1bmN0aW9uIHBsYXlWaWRlb1NldHRpbmcobXVzaWNDYXJkKSB7XG4gICAgLy8gICAgIHZhciB0b2dnbGUgPSB0cnVlO1xuICAgIC8vICAgICBpZiAobXVzaWNDYXJkLmlzUGxheWluZ1ZpZGVvID09IHRydWUpXG4gICAgLy8gICAgICAgICB0b2dnbGUgPSBmYWxzZTtcblxuICAgIC8vICAgICBjbGVhbklzUGxheWluZygpO1xuICAgIC8vICAgICBtdXNpY0NhcmQuaXNTZWxlY3QgPSB0b2dnbGU7XG5cbiAgICAvLyB9XG5cbiAgICAvLyBmdW5jdGlvbiBjbGVhbklzUGxheWluZygpIHtcbiAgICAvLyAgICAgJHNjb3BlLm11c2ljTGlzdHMuZm9yRWFjaChmdW5jdGlvbihtdXNpY0NhcmQsIGkpIHtcbiAgICAvLyAgICAgICAgIG11c2ljQ2FyZC5pc1BsYXlpbmdWaWRlbyA9IGZhbHNlO1xuXG4gICAgLy8gICAgIH0pO1xuXG4gICAgLy8gfVxuXG4gICAgZnVuY3Rpb24gcGxheVZpZGVvSW5QbGF5ZXIoX2lkKSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50WW91dHViZVZpZGVvID0gX2lkO1xuXG4gICAgfVxuXG4gICAgJHNjb3BlLmFkZFRvTXlGYXZvcml0ZSA9IGZ1bmN0aW9uKGV2ZW50LCBtdXNpY0NhcmQpIHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIG11c2ljQ2FyZC5pc0Zhdm9yaXRlID0gIW11c2ljQ2FyZC5pc0Zhdm9yaXRlO1xuXG5cblxuICAgICAgICAvLyB2YXIgZmF2b3JpdGVMaXN0cyA9ICRzY29wZS5tdXNpY0xpc3RzLmZpbHRlcihmdW5jdGlvbihtKSB7XG4gICAgICAgIC8vICAgICBpZiAobS5pc0Zhdm9yaXRlKVxuICAgICAgICAvLyAgICAgICAgIHJldHVybiBtO1xuICAgICAgICAvLyAgICAgZWxzZVxuICAgICAgICAvLyAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAvLyB9KTtcbiAgICAgICAgaWYgKG11c2ljQ2FyZC5pc0Zhdm9yaXRlKVxuICAgICAgICAgICAgJHNjb3BlLmZhdm9yaXRlTGlzdHMucHVzaChtdXNpY0NhcmQpO1xuICAgICAgICBlbHNlIHtcblxuICAgICAgICAgICAgdmFyIGlkeCA9ICRzY29wZS5mYXZvcml0ZUxpc3RzLmluZGV4T2YobXVzaWNDYXJkKTtcbiAgICAgICAgICAgICRzY29wZS5mYXZvcml0ZUxpc3RzLnNwbGljZShpZHgsIDEpO1xuXG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgYWRkTWFycXVlZSgkc2NvcGUuZmF2b3JpdGVMaXN0cyk7XG4gICAgICAgIHNhdmVGYXZvcml0ZSgkc2NvcGUuZmF2b3JpdGVMaXN0cyk7XG5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkRmF2b3JpdGUoKSB7XG4gICAgICAgIGlmIChsb2NhbFN0b3JhZ2VTZXJ2aWNlLmlzU3VwcG9ydGVkKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0TG9jYWxTdG9yZ2UoJ05UVS1JQ0FOLVBMQVlFUi1GQVZPUklURScpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2F2ZUZhdm9yaXRlKG11c2ljTGlzdHMpIHtcblxuICAgICAgICBpZiAobG9jYWxTdG9yYWdlU2VydmljZS5pc1N1cHBvcnRlZCkge1xuXG4gICAgICAgICAgICBzZXRMb2NhbFN0b3JnZSgnTlRVLUlDQU4tUExBWUVSLUZBVk9SSVRFJywgbXVzaWNMaXN0cylcbiAgICAgICAgfVxuXG5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzZXRMb2NhbFN0b3JnZShrZXksIHZhbCkge1xuICAgICAgICByZXR1cm4gbG9jYWxTdG9yYWdlU2VydmljZS5zZXQoa2V5LCB2YWwpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldExvY2FsU3RvcmdlKGtleSkge1xuICAgICAgICByZXR1cm4gbG9jYWxTdG9yYWdlU2VydmljZS5nZXQoa2V5KTtcbiAgICB9XG5cblxuICAgICRzY29wZS5hZGRUb1BsYXllckxpc3QgPSBmdW5jdGlvbihldmVudCwgbXVzaWNDYXJkKSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cblxuICAgICAgICAvLyBjb25zb2xlLmxvZyhtdXNpY0NhcmQpO1xuXG4gICAgfVxuXG5cblxuICAgICRzY29wZS5zZWxlY3RNdXNpY0NhcmQgPSBmdW5jdGlvbihtdXNpY0NhcmQpIHtcbiAgICAgICAgdmFyIHRvZ2dsZSA9IHRydWU7XG4gICAgICAgIGlmIChtdXNpY0NhcmQuaXNTZWxlY3QgPT0gdHJ1ZSlcbiAgICAgICAgICAgIHRvZ2dsZSA9IGZhbHNlO1xuXG4gICAgICAgIGNsZWFuU2VsZWN0ZWQoKTtcblxuICAgICAgICBtdXNpY0NhcmQuaXNTZWxlY3QgPSB0b2dnbGU7XG5cbiAgICB9XG5cblxuICAgIGZ1bmN0aW9uIHNhdmVNeUZhdm9yaXRlKCkge1xuICAgICAgICAkc2NvcGUubXVzaWNMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uKG11c2ljQ2FyZCwgaSkge1xuICAgICAgICAgICAgbXVzaWNDYXJkLmlzU2VsZWN0ID0gZmFsc2U7XG5cbiAgICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjbGVhblNlbGVjdGVkKCkge1xuICAgICAgICAkc2NvcGUubXVzaWNMaXN0cy5mb3JFYWNoKGZ1bmN0aW9uKG11c2ljQ2FyZCwgaSkge1xuICAgICAgICAgICAgbXVzaWNDYXJkLmlzU2VsZWN0ID0gZmFsc2U7XG5cbiAgICAgICAgfSk7XG5cbiAgICB9XG5cbn0pO1xuXG5hcHAuZmFjdG9yeSgnUGxheWVyRmFjdG9yeScsIGZ1bmN0aW9uKCRxLCAkaHR0cCkge1xuXG4gICAgdmFyIF9mYWN0b3J5ID0ge307XG4gICAgX2ZhY3RvcnkubGlzdEludml0ZXMgPSBmdW5jdGlvbihwcm9qZWN0SWQpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldChcIi9hcGkvaW52aXRlL2xpc3QtaW52aXRlcz9wcm9qZWN0SWQ9XCIgKyBwcm9qZWN0SWQpO1xuICAgIH07XG5cbiAgICBfZmFjdG9yeS5hY2NlcHRJbml2dGUgPSBmdW5jdGlvbihpbnZpdGVJZCkge1xuICAgICAgICByZXR1cm4gJGh0dHAucG9zdChcIi9hcGkvaW52aXRlL2FjY2VwdFwiLCB7XG4gICAgICAgICAgICBpZDogaW52aXRlSWRcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiBfZmFjdG9yeTtcbn0pO1xuXG5hcHAuZmFjdG9yeSgnZ29vZ2xlU2VydmljZScsIGZ1bmN0aW9uKCRxLCAkaHR0cCkge1xuXG4gICAgdmFyIF9mYWN0b3J5ID0ge307XG4gICAgX2ZhY3RvcnkubGlzdEludml0ZXMgPSBmdW5jdGlvbihwcm9qZWN0SWQpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldChcIi9hcGkvaW52aXRlL2xpc3QtaW52aXRlcz9wcm9qZWN0SWQ9XCIgKyBwcm9qZWN0SWQpO1xuICAgIH07XG5cbiAgICBfZmFjdG9yeS5hY2NlcHRJbml2dGUgPSBmdW5jdGlvbihpbnZpdGVJZCkge1xuICAgICAgICByZXR1cm4gJGh0dHAucG9zdChcIi9hcGkvaW52aXRlL2FjY2VwdFwiLCB7XG4gICAgICAgICAgICBpZDogaW52aXRlSWRcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIF9mYWN0b3J5Lmdvb2dsZUFwaUNsaWVudFJlYWR5ID0gZnVuY3Rpb24ocXVlcnkpIHtcbiAgICAgICAgdmFyIGRlZmVycmVkID0gJHEuZGVmZXIoKTtcblxuICAgICAgICBnYXBpLmNsaWVudC5sb2FkKCd5b3V0dWJlJywgJ3YzJywgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBnYXBpLmNsaWVudC5zZXRBcGlLZXkoJ0FJemFTeUNSd011R1A1MGFPdnJwdHlYUlp0dmVFNTBmYU9MYjhSMCcpO1xuICAgICAgICAgICAgdmFyIHJlcXVlc3QgPSBnYXBpLmNsaWVudC55b3V0dWJlLnNlYXJjaC5saXN0KHtcbiAgICAgICAgICAgICAgICBwYXJ0OiAnc25pcHBldCcsXG4gICAgICAgICAgICAgICAgcTogcXVlcnksXG4gICAgICAgICAgICAgICAgbWF4UmVzdWx0czogMjRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmVxdWVzdC5leGVjdXRlKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cbiAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3BvbnNlLnJlc3VsdCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfTtcblxuICAgIHJldHVybiBfZmFjdG9yeTtcbn0pO1xuXG5cblxudmFyIGRlYm91bmNlID0gZnVuY3Rpb24oZnVuYywgd2FpdCkge1xuICAgIC8vIHdlIG5lZWQgdG8gc2F2ZSB0aGVzZSBpbiB0aGUgY2xvc3VyZVxuICAgIHZhciB0aW1lb3V0LCBhcmdzLCBjb250ZXh0LCB0aW1lc3RhbXA7XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgLy8gc2F2ZSBkZXRhaWxzIG9mIGxhdGVzdCBjYWxsXG4gICAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgICBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuICAgICAgICB0aW1lc3RhbXAgPSBuZXcgRGF0ZSgpO1xuXG4gICAgICAgIC8vIHRoaXMgaXMgd2hlcmUgdGhlIG1hZ2ljIGhhcHBlbnNcbiAgICAgICAgdmFyIGxhdGVyID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgIC8vIGhvdyBsb25nIGFnbyB3YXMgdGhlIGxhc3QgY2FsbFxuICAgICAgICAgICAgdmFyIGxhc3QgPSAobmV3IERhdGUoKSkgLSB0aW1lc3RhbXA7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBsYXRlc3QgY2FsbCB3YXMgbGVzcyB0aGF0IHRoZSB3YWl0IHBlcmlvZCBhZ29cbiAgICAgICAgICAgIC8vIHRoZW4gd2UgcmVzZXQgdGhlIHRpbWVvdXQgdG8gd2FpdCBmb3IgdGhlIGRpZmZlcmVuY2VcbiAgICAgICAgICAgIGlmIChsYXN0IDwgd2FpdCkge1xuICAgICAgICAgICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0IC0gbGFzdCk7XG5cbiAgICAgICAgICAgICAgICAvLyBvciBpZiBub3Qgd2UgY2FuIG51bGwgb3V0IHRoZSB0aW1lciBhbmQgcnVuIHRoZSBsYXRlc3RcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgZnVuYy5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICAvLyB3ZSBvbmx5IG5lZWQgdG8gc2V0IHRoZSB0aW1lciBub3cgaWYgb25lIGlzbid0IGFscmVhZHkgcnVubmluZ1xuICAgICAgICBpZiAoIXRpbWVvdXQpIHtcbiAgICAgICAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICAgICAgfVxuICAgIH1cbn07XG4iLCIvKiFcbiAqIE1pekpzIHYxLjAuMCBcbiAqIENvcHlyaWdodCBNaXpUZWNoXG4gKiBMaWNlbnNlZCBNaWtlWmhlbmdcbiAqIGh0dHA6Ly9taWtlLXpoZW5nLmdpdGh1Yi5pby9cbiAqL1xuIFxuLy8gISBqUXVlcnkgdjEuOS4xIHwgKGMpIDIwMDUsIDIwMTIgalF1ZXJ5IEZvdW5kYXRpb24sIEluYy4gfCBqcXVlcnkub3JnL2xpY2Vuc2Vcbi8vQCBzb3VyY2VNYXBwaW5nVVJMPWpxdWVyeS5taW4ubWFwXG4oZnVuY3Rpb24oZSx0KXt2YXIgbixyLGk9dHlwZW9mIHQsbz1lLmRvY3VtZW50LGE9ZS5sb2NhdGlvbixzPWUualF1ZXJ5LHU9ZS4kLGw9e30sYz1bXSxwPVwiMS45LjFcIixmPWMuY29uY2F0LGQ9Yy5wdXNoLGg9Yy5zbGljZSxnPWMuaW5kZXhPZixtPWwudG9TdHJpbmcseT1sLmhhc093blByb3BlcnR5LHY9cC50cmltLGI9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gbmV3IGIuZm4uaW5pdChlLHQscil9LHg9L1srLV0/KD86XFxkKlxcLnwpXFxkKyg/OltlRV1bKy1dP1xcZCt8KS8uc291cmNlLHc9L1xcUysvZyxUPS9eW1xcc1xcdUZFRkZcXHhBMF0rfFtcXHNcXHVGRUZGXFx4QTBdKyQvZyxOPS9eKD86KDxbXFx3XFxXXSs+KVtePl0qfCMoW1xcdy1dKikpJC8sQz0vXjwoXFx3KylcXHMqXFwvPz4oPzo8XFwvXFwxPnwpJC8saz0vXltcXF0sOnt9XFxzXSokLyxFPS8oPzpefDp8LCkoPzpcXHMqXFxbKSsvZyxTPS9cXFxcKD86W1wiXFxcXFxcL2JmbnJ0XXx1W1xcZGEtZkEtRl17NH0pL2csQT0vXCJbXlwiXFxcXFxcclxcbl0qXCJ8dHJ1ZXxmYWxzZXxudWxsfC0/KD86XFxkK1xcLnwpXFxkKyg/OltlRV1bKy1dP1xcZCt8KS9nLGo9L14tbXMtLyxEPS8tKFtcXGRhLXpdKS9naSxMPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIHQudG9VcHBlckNhc2UoKX0sSD1mdW5jdGlvbihlKXsoby5hZGRFdmVudExpc3RlbmVyfHxcImxvYWRcIj09PWUudHlwZXx8XCJjb21wbGV0ZVwiPT09by5yZWFkeVN0YXRlKSYmKHEoKSxiLnJlYWR5KCkpfSxxPWZ1bmN0aW9uKCl7by5hZGRFdmVudExpc3RlbmVyPyhvLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsSCwhMSksZS5yZW1vdmVFdmVudExpc3RlbmVyKFwibG9hZFwiLEgsITEpKTooby5kZXRhY2hFdmVudChcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiLEgpLGUuZGV0YWNoRXZlbnQoXCJvbmxvYWRcIixIKSl9O2IuZm49Yi5wcm90b3R5cGU9e2pxdWVyeTpwLGNvbnN0cnVjdG9yOmIsaW5pdDpmdW5jdGlvbihlLG4scil7dmFyIGksYTtpZighZSlyZXR1cm4gdGhpcztpZihcInN0cmluZ1wiPT10eXBlb2YgZSl7aWYoaT1cIjxcIj09PWUuY2hhckF0KDApJiZcIj5cIj09PWUuY2hhckF0KGUubGVuZ3RoLTEpJiZlLmxlbmd0aD49Mz9bbnVsbCxlLG51bGxdOk4uZXhlYyhlKSwhaXx8IWlbMV0mJm4pcmV0dXJuIW58fG4uanF1ZXJ5PyhufHxyKS5maW5kKGUpOnRoaXMuY29uc3RydWN0b3IobikuZmluZChlKTtpZihpWzFdKXtpZihuPW4gaW5zdGFuY2VvZiBiP25bMF06bixiLm1lcmdlKHRoaXMsYi5wYXJzZUhUTUwoaVsxXSxuJiZuLm5vZGVUeXBlP24ub3duZXJEb2N1bWVudHx8bjpvLCEwKSksQy50ZXN0KGlbMV0pJiZiLmlzUGxhaW5PYmplY3QobikpZm9yKGkgaW4gbiliLmlzRnVuY3Rpb24odGhpc1tpXSk/dGhpc1tpXShuW2ldKTp0aGlzLmF0dHIoaSxuW2ldKTtyZXR1cm4gdGhpc31pZihhPW8uZ2V0RWxlbWVudEJ5SWQoaVsyXSksYSYmYS5wYXJlbnROb2RlKXtpZihhLmlkIT09aVsyXSlyZXR1cm4gci5maW5kKGUpO3RoaXMubGVuZ3RoPTEsdGhpc1swXT1hfXJldHVybiB0aGlzLmNvbnRleHQ9byx0aGlzLnNlbGVjdG9yPWUsdGhpc31yZXR1cm4gZS5ub2RlVHlwZT8odGhpcy5jb250ZXh0PXRoaXNbMF09ZSx0aGlzLmxlbmd0aD0xLHRoaXMpOmIuaXNGdW5jdGlvbihlKT9yLnJlYWR5KGUpOihlLnNlbGVjdG9yIT09dCYmKHRoaXMuc2VsZWN0b3I9ZS5zZWxlY3Rvcix0aGlzLmNvbnRleHQ9ZS5jb250ZXh0KSxiLm1ha2VBcnJheShlLHRoaXMpKX0sc2VsZWN0b3I6XCJcIixsZW5ndGg6MCxzaXplOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubGVuZ3RofSx0b0FycmF5OmZ1bmN0aW9uKCl7cmV0dXJuIGguY2FsbCh0aGlzKX0sZ2V0OmZ1bmN0aW9uKGUpe3JldHVybiBudWxsPT1lP3RoaXMudG9BcnJheSgpOjA+ZT90aGlzW3RoaXMubGVuZ3RoK2VdOnRoaXNbZV19LHB1c2hTdGFjazpmdW5jdGlvbihlKXt2YXIgdD1iLm1lcmdlKHRoaXMuY29uc3RydWN0b3IoKSxlKTtyZXR1cm4gdC5wcmV2T2JqZWN0PXRoaXMsdC5jb250ZXh0PXRoaXMuY29udGV4dCx0fSxlYWNoOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGIuZWFjaCh0aGlzLGUsdCl9LHJlYWR5OmZ1bmN0aW9uKGUpe3JldHVybiBiLnJlYWR5LnByb21pc2UoKS5kb25lKGUpLHRoaXN9LHNsaWNlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMucHVzaFN0YWNrKGguYXBwbHkodGhpcyxhcmd1bWVudHMpKX0sZmlyc3Q6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5lcSgwKX0sbGFzdDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmVxKC0xKX0sZXE6ZnVuY3Rpb24oZSl7dmFyIHQ9dGhpcy5sZW5ndGgsbj0rZSsoMD5lP3Q6MCk7cmV0dXJuIHRoaXMucHVzaFN0YWNrKG4+PTAmJnQ+bj9bdGhpc1tuXV06W10pfSxtYXA6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMucHVzaFN0YWNrKGIubWFwKHRoaXMsZnVuY3Rpb24odCxuKXtyZXR1cm4gZS5jYWxsKHQsbix0KX0pKX0sZW5kOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMucHJldk9iamVjdHx8dGhpcy5jb25zdHJ1Y3RvcihudWxsKX0scHVzaDpkLHNvcnQ6W10uc29ydCxzcGxpY2U6W10uc3BsaWNlfSxiLmZuLmluaXQucHJvdG90eXBlPWIuZm4sYi5leHRlbmQ9Yi5mbi5leHRlbmQ9ZnVuY3Rpb24oKXt2YXIgZSxuLHIsaSxvLGEscz1hcmd1bWVudHNbMF18fHt9LHU9MSxsPWFyZ3VtZW50cy5sZW5ndGgsYz0hMTtmb3IoXCJib29sZWFuXCI9PXR5cGVvZiBzJiYoYz1zLHM9YXJndW1lbnRzWzFdfHx7fSx1PTIpLFwib2JqZWN0XCI9PXR5cGVvZiBzfHxiLmlzRnVuY3Rpb24ocyl8fChzPXt9KSxsPT09dSYmKHM9dGhpcywtLXUpO2w+dTt1KyspaWYobnVsbCE9KG89YXJndW1lbnRzW3VdKSlmb3IoaSBpbiBvKWU9c1tpXSxyPW9baV0scyE9PXImJihjJiZyJiYoYi5pc1BsYWluT2JqZWN0KHIpfHwobj1iLmlzQXJyYXkocikpKT8obj8obj0hMSxhPWUmJmIuaXNBcnJheShlKT9lOltdKTphPWUmJmIuaXNQbGFpbk9iamVjdChlKT9lOnt9LHNbaV09Yi5leHRlbmQoYyxhLHIpKTpyIT09dCYmKHNbaV09cikpO3JldHVybiBzfSxiLmV4dGVuZCh7bm9Db25mbGljdDpmdW5jdGlvbih0KXtyZXR1cm4gZS4kPT09YiYmKGUuJD11KSx0JiZlLmpRdWVyeT09PWImJihlLmpRdWVyeT1zKSxifSxpc1JlYWR5OiExLHJlYWR5V2FpdDoxLGhvbGRSZWFkeTpmdW5jdGlvbihlKXtlP2IucmVhZHlXYWl0Kys6Yi5yZWFkeSghMCl9LHJlYWR5OmZ1bmN0aW9uKGUpe2lmKGU9PT0hMD8hLS1iLnJlYWR5V2FpdDohYi5pc1JlYWR5KXtpZighby5ib2R5KXJldHVybiBzZXRUaW1lb3V0KGIucmVhZHkpO2IuaXNSZWFkeT0hMCxlIT09ITAmJi0tYi5yZWFkeVdhaXQ+MHx8KG4ucmVzb2x2ZVdpdGgobyxbYl0pLGIuZm4udHJpZ2dlciYmYihvKS50cmlnZ2VyKFwicmVhZHlcIikub2ZmKFwicmVhZHlcIikpfX0saXNGdW5jdGlvbjpmdW5jdGlvbihlKXtyZXR1cm5cImZ1bmN0aW9uXCI9PT1iLnR5cGUoZSl9LGlzQXJyYXk6QXJyYXkuaXNBcnJheXx8ZnVuY3Rpb24oZSl7cmV0dXJuXCJhcnJheVwiPT09Yi50eXBlKGUpfSxpc1dpbmRvdzpmdW5jdGlvbihlKXtyZXR1cm4gbnVsbCE9ZSYmZT09ZS53aW5kb3d9LGlzTnVtZXJpYzpmdW5jdGlvbihlKXtyZXR1cm4haXNOYU4ocGFyc2VGbG9hdChlKSkmJmlzRmluaXRlKGUpfSx0eXBlOmZ1bmN0aW9uKGUpe3JldHVybiBudWxsPT1lP2UrXCJcIjpcIm9iamVjdFwiPT10eXBlb2YgZXx8XCJmdW5jdGlvblwiPT10eXBlb2YgZT9sW20uY2FsbChlKV18fFwib2JqZWN0XCI6dHlwZW9mIGV9LGlzUGxhaW5PYmplY3Q6ZnVuY3Rpb24oZSl7aWYoIWV8fFwib2JqZWN0XCIhPT1iLnR5cGUoZSl8fGUubm9kZVR5cGV8fGIuaXNXaW5kb3coZSkpcmV0dXJuITE7dHJ5e2lmKGUuY29uc3RydWN0b3ImJiF5LmNhbGwoZSxcImNvbnN0cnVjdG9yXCIpJiYheS5jYWxsKGUuY29uc3RydWN0b3IucHJvdG90eXBlLFwiaXNQcm90b3R5cGVPZlwiKSlyZXR1cm4hMX1jYXRjaChuKXtyZXR1cm4hMX12YXIgcjtmb3IociBpbiBlKTtyZXR1cm4gcj09PXR8fHkuY2FsbChlLHIpfSxpc0VtcHR5T2JqZWN0OmZ1bmN0aW9uKGUpe3ZhciB0O2Zvcih0IGluIGUpcmV0dXJuITE7cmV0dXJuITB9LGVycm9yOmZ1bmN0aW9uKGUpe3Rocm93IEVycm9yKGUpfSxwYXJzZUhUTUw6ZnVuY3Rpb24oZSx0LG4pe2lmKCFlfHxcInN0cmluZ1wiIT10eXBlb2YgZSlyZXR1cm4gbnVsbDtcImJvb2xlYW5cIj09dHlwZW9mIHQmJihuPXQsdD0hMSksdD10fHxvO3ZhciByPUMuZXhlYyhlKSxpPSFuJiZbXTtyZXR1cm4gcj9bdC5jcmVhdGVFbGVtZW50KHJbMV0pXToocj1iLmJ1aWxkRnJhZ21lbnQoW2VdLHQsaSksaSYmYihpKS5yZW1vdmUoKSxiLm1lcmdlKFtdLHIuY2hpbGROb2RlcykpfSxwYXJzZUpTT046ZnVuY3Rpb24obil7cmV0dXJuIGUuSlNPTiYmZS5KU09OLnBhcnNlP2UuSlNPTi5wYXJzZShuKTpudWxsPT09bj9uOlwic3RyaW5nXCI9PXR5cGVvZiBuJiYobj1iLnRyaW0obiksbiYmay50ZXN0KG4ucmVwbGFjZShTLFwiQFwiKS5yZXBsYWNlKEEsXCJdXCIpLnJlcGxhY2UoRSxcIlwiKSkpP0Z1bmN0aW9uKFwicmV0dXJuIFwiK24pKCk6KGIuZXJyb3IoXCJJbnZhbGlkIEpTT046IFwiK24pLHQpfSxwYXJzZVhNTDpmdW5jdGlvbihuKXt2YXIgcixpO2lmKCFufHxcInN0cmluZ1wiIT10eXBlb2YgbilyZXR1cm4gbnVsbDt0cnl7ZS5ET01QYXJzZXI/KGk9bmV3IERPTVBhcnNlcixyPWkucGFyc2VGcm9tU3RyaW5nKG4sXCJ0ZXh0L3htbFwiKSk6KHI9bmV3IEFjdGl2ZVhPYmplY3QoXCJNaWNyb3NvZnQuWE1MRE9NXCIpLHIuYXN5bmM9XCJmYWxzZVwiLHIubG9hZFhNTChuKSl9Y2F0Y2gobyl7cj10fXJldHVybiByJiZyLmRvY3VtZW50RWxlbWVudCYmIXIuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJwYXJzZXJlcnJvclwiKS5sZW5ndGh8fGIuZXJyb3IoXCJJbnZhbGlkIFhNTDogXCIrbikscn0sbm9vcDpmdW5jdGlvbigpe30sZ2xvYmFsRXZhbDpmdW5jdGlvbih0KXt0JiZiLnRyaW0odCkmJihlLmV4ZWNTY3JpcHR8fGZ1bmN0aW9uKHQpe2UuZXZhbC5jYWxsKGUsdCl9KSh0KX0sY2FtZWxDYXNlOmZ1bmN0aW9uKGUpe3JldHVybiBlLnJlcGxhY2UoaixcIm1zLVwiKS5yZXBsYWNlKEQsTCl9LG5vZGVOYW1lOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGUubm9kZU5hbWUmJmUubm9kZU5hbWUudG9Mb3dlckNhc2UoKT09PXQudG9Mb3dlckNhc2UoKX0sZWFjaDpmdW5jdGlvbihlLHQsbil7dmFyIHIsaT0wLG89ZS5sZW5ndGgsYT1NKGUpO2lmKG4pe2lmKGEpe2Zvcig7bz5pO2krKylpZihyPXQuYXBwbHkoZVtpXSxuKSxyPT09ITEpYnJlYWt9ZWxzZSBmb3IoaSBpbiBlKWlmKHI9dC5hcHBseShlW2ldLG4pLHI9PT0hMSlicmVha31lbHNlIGlmKGEpe2Zvcig7bz5pO2krKylpZihyPXQuY2FsbChlW2ldLGksZVtpXSkscj09PSExKWJyZWFrfWVsc2UgZm9yKGkgaW4gZSlpZihyPXQuY2FsbChlW2ldLGksZVtpXSkscj09PSExKWJyZWFrO3JldHVybiBlfSx0cmltOnYmJiF2LmNhbGwoXCJcXHVmZWZmXFx1MDBhMFwiKT9mdW5jdGlvbihlKXtyZXR1cm4gbnVsbD09ZT9cIlwiOnYuY2FsbChlKX06ZnVuY3Rpb24oZSl7cmV0dXJuIG51bGw9PWU/XCJcIjooZStcIlwiKS5yZXBsYWNlKFQsXCJcIil9LG1ha2VBcnJheTpmdW5jdGlvbihlLHQpe3ZhciBuPXR8fFtdO3JldHVybiBudWxsIT1lJiYoTShPYmplY3QoZSkpP2IubWVyZ2UobixcInN0cmluZ1wiPT10eXBlb2YgZT9bZV06ZSk6ZC5jYWxsKG4sZSkpLG59LGluQXJyYXk6ZnVuY3Rpb24oZSx0LG4pe3ZhciByO2lmKHQpe2lmKGcpcmV0dXJuIGcuY2FsbCh0LGUsbik7Zm9yKHI9dC5sZW5ndGgsbj1uPzA+bj9NYXRoLm1heCgwLHIrbik6bjowO3I+bjtuKyspaWYobiBpbiB0JiZ0W25dPT09ZSlyZXR1cm4gbn1yZXR1cm4tMX0sbWVyZ2U6ZnVuY3Rpb24oZSxuKXt2YXIgcj1uLmxlbmd0aCxpPWUubGVuZ3RoLG89MDtpZihcIm51bWJlclwiPT10eXBlb2Ygcilmb3IoO3I+bztvKyspZVtpKytdPW5bb107ZWxzZSB3aGlsZShuW29dIT09dCllW2krK109bltvKytdO3JldHVybiBlLmxlbmd0aD1pLGV9LGdyZXA6ZnVuY3Rpb24oZSx0LG4pe3ZhciByLGk9W10sbz0wLGE9ZS5sZW5ndGg7Zm9yKG49ISFuO2E+bztvKyspcj0hIXQoZVtvXSxvKSxuIT09ciYmaS5wdXNoKGVbb10pO3JldHVybiBpfSxtYXA6ZnVuY3Rpb24oZSx0LG4pe3ZhciByLGk9MCxvPWUubGVuZ3RoLGE9TShlKSxzPVtdO2lmKGEpZm9yKDtvPmk7aSsrKXI9dChlW2ldLGksbiksbnVsbCE9ciYmKHNbcy5sZW5ndGhdPXIpO2Vsc2UgZm9yKGkgaW4gZSlyPXQoZVtpXSxpLG4pLG51bGwhPXImJihzW3MubGVuZ3RoXT1yKTtyZXR1cm4gZi5hcHBseShbXSxzKX0sZ3VpZDoxLHByb3h5OmZ1bmN0aW9uKGUsbil7dmFyIHIsaSxvO3JldHVyblwic3RyaW5nXCI9PXR5cGVvZiBuJiYobz1lW25dLG49ZSxlPW8pLGIuaXNGdW5jdGlvbihlKT8ocj1oLmNhbGwoYXJndW1lbnRzLDIpLGk9ZnVuY3Rpb24oKXtyZXR1cm4gZS5hcHBseShufHx0aGlzLHIuY29uY2F0KGguY2FsbChhcmd1bWVudHMpKSl9LGkuZ3VpZD1lLmd1aWQ9ZS5ndWlkfHxiLmd1aWQrKyxpKTp0fSxhY2Nlc3M6ZnVuY3Rpb24oZSxuLHIsaSxvLGEscyl7dmFyIHU9MCxsPWUubGVuZ3RoLGM9bnVsbD09cjtpZihcIm9iamVjdFwiPT09Yi50eXBlKHIpKXtvPSEwO2Zvcih1IGluIHIpYi5hY2Nlc3MoZSxuLHUsclt1XSwhMCxhLHMpfWVsc2UgaWYoaSE9PXQmJihvPSEwLGIuaXNGdW5jdGlvbihpKXx8KHM9ITApLGMmJihzPyhuLmNhbGwoZSxpKSxuPW51bGwpOihjPW4sbj1mdW5jdGlvbihlLHQsbil7cmV0dXJuIGMuY2FsbChiKGUpLG4pfSkpLG4pKWZvcig7bD51O3UrKyluKGVbdV0scixzP2k6aS5jYWxsKGVbdV0sdSxuKGVbdV0scikpKTtyZXR1cm4gbz9lOmM/bi5jYWxsKGUpOmw/bihlWzBdLHIpOmF9LG5vdzpmdW5jdGlvbigpe3JldHVybihuZXcgRGF0ZSkuZ2V0VGltZSgpfX0pLGIucmVhZHkucHJvbWlzZT1mdW5jdGlvbih0KXtpZighbilpZihuPWIuRGVmZXJyZWQoKSxcImNvbXBsZXRlXCI9PT1vLnJlYWR5U3RhdGUpc2V0VGltZW91dChiLnJlYWR5KTtlbHNlIGlmKG8uYWRkRXZlbnRMaXN0ZW5lcilvLmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsSCwhMSksZS5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLEgsITEpO2Vsc2V7by5hdHRhY2hFdmVudChcIm9ucmVhZHlzdGF0ZWNoYW5nZVwiLEgpLGUuYXR0YWNoRXZlbnQoXCJvbmxvYWRcIixIKTt2YXIgcj0hMTt0cnl7cj1udWxsPT1lLmZyYW1lRWxlbWVudCYmby5kb2N1bWVudEVsZW1lbnR9Y2F0Y2goaSl7fXImJnIuZG9TY3JvbGwmJmZ1bmN0aW9uIGEoKXtpZighYi5pc1JlYWR5KXt0cnl7ci5kb1Njcm9sbChcImxlZnRcIil9Y2F0Y2goZSl7cmV0dXJuIHNldFRpbWVvdXQoYSw1MCl9cSgpLGIucmVhZHkoKX19KCl9cmV0dXJuIG4ucHJvbWlzZSh0KX0sYi5lYWNoKFwiQm9vbGVhbiBOdW1iZXIgU3RyaW5nIEZ1bmN0aW9uIEFycmF5IERhdGUgUmVnRXhwIE9iamVjdCBFcnJvclwiLnNwbGl0KFwiIFwiKSxmdW5jdGlvbihlLHQpe2xbXCJbb2JqZWN0IFwiK3QrXCJdXCJdPXQudG9Mb3dlckNhc2UoKX0pO2Z1bmN0aW9uIE0oZSl7dmFyIHQ9ZS5sZW5ndGgsbj1iLnR5cGUoZSk7cmV0dXJuIGIuaXNXaW5kb3coZSk/ITE6MT09PWUubm9kZVR5cGUmJnQ/ITA6XCJhcnJheVwiPT09bnx8XCJmdW5jdGlvblwiIT09biYmKDA9PT10fHxcIm51bWJlclwiPT10eXBlb2YgdCYmdD4wJiZ0LTEgaW4gZSl9cj1iKG8pO3ZhciBfPXt9O2Z1bmN0aW9uIEYoZSl7dmFyIHQ9X1tlXT17fTtyZXR1cm4gYi5lYWNoKGUubWF0Y2godyl8fFtdLGZ1bmN0aW9uKGUsbil7dFtuXT0hMH0pLHR9Yi5DYWxsYmFja3M9ZnVuY3Rpb24oZSl7ZT1cInN0cmluZ1wiPT10eXBlb2YgZT9fW2VdfHxGKGUpOmIuZXh0ZW5kKHt9LGUpO3ZhciBuLHIsaSxvLGEscyx1PVtdLGw9IWUub25jZSYmW10sYz1mdW5jdGlvbih0KXtmb3Iocj1lLm1lbW9yeSYmdCxpPSEwLGE9c3x8MCxzPTAsbz11Lmxlbmd0aCxuPSEwO3UmJm8+YTthKyspaWYodVthXS5hcHBseSh0WzBdLHRbMV0pPT09ITEmJmUuc3RvcE9uRmFsc2Upe3I9ITE7YnJlYWt9bj0hMSx1JiYobD9sLmxlbmd0aCYmYyhsLnNoaWZ0KCkpOnI/dT1bXTpwLmRpc2FibGUoKSl9LHA9e2FkZDpmdW5jdGlvbigpe2lmKHUpe3ZhciB0PXUubGVuZ3RoOyhmdW5jdGlvbiBpKHQpe2IuZWFjaCh0LGZ1bmN0aW9uKHQsbil7dmFyIHI9Yi50eXBlKG4pO1wiZnVuY3Rpb25cIj09PXI/ZS51bmlxdWUmJnAuaGFzKG4pfHx1LnB1c2gobik6biYmbi5sZW5ndGgmJlwic3RyaW5nXCIhPT1yJiZpKG4pfSl9KShhcmd1bWVudHMpLG4/bz11Lmxlbmd0aDpyJiYocz10LGMocikpfXJldHVybiB0aGlzfSxyZW1vdmU6ZnVuY3Rpb24oKXtyZXR1cm4gdSYmYi5lYWNoKGFyZ3VtZW50cyxmdW5jdGlvbihlLHQpe3ZhciByO3doaWxlKChyPWIuaW5BcnJheSh0LHUscikpPi0xKXUuc3BsaWNlKHIsMSksbiYmKG8+PXImJm8tLSxhPj1yJiZhLS0pfSksdGhpc30saGFzOmZ1bmN0aW9uKGUpe3JldHVybiBlP2IuaW5BcnJheShlLHUpPi0xOiEoIXV8fCF1Lmxlbmd0aCl9LGVtcHR5OmZ1bmN0aW9uKCl7cmV0dXJuIHU9W10sdGhpc30sZGlzYWJsZTpmdW5jdGlvbigpe3JldHVybiB1PWw9cj10LHRoaXN9LGRpc2FibGVkOmZ1bmN0aW9uKCl7cmV0dXJuIXV9LGxvY2s6ZnVuY3Rpb24oKXtyZXR1cm4gbD10LHJ8fHAuZGlzYWJsZSgpLHRoaXN9LGxvY2tlZDpmdW5jdGlvbigpe3JldHVybiFsfSxmaXJlV2l0aDpmdW5jdGlvbihlLHQpe3JldHVybiB0PXR8fFtdLHQ9W2UsdC5zbGljZT90LnNsaWNlKCk6dF0sIXV8fGkmJiFsfHwobj9sLnB1c2godCk6Yyh0KSksdGhpc30sZmlyZTpmdW5jdGlvbigpe3JldHVybiBwLmZpcmVXaXRoKHRoaXMsYXJndW1lbnRzKSx0aGlzfSxmaXJlZDpmdW5jdGlvbigpe3JldHVybiEhaX19O3JldHVybiBwfSxiLmV4dGVuZCh7RGVmZXJyZWQ6ZnVuY3Rpb24oZSl7dmFyIHQ9W1tcInJlc29sdmVcIixcImRvbmVcIixiLkNhbGxiYWNrcyhcIm9uY2UgbWVtb3J5XCIpLFwicmVzb2x2ZWRcIl0sW1wicmVqZWN0XCIsXCJmYWlsXCIsYi5DYWxsYmFja3MoXCJvbmNlIG1lbW9yeVwiKSxcInJlamVjdGVkXCJdLFtcIm5vdGlmeVwiLFwicHJvZ3Jlc3NcIixiLkNhbGxiYWNrcyhcIm1lbW9yeVwiKV1dLG49XCJwZW5kaW5nXCIscj17c3RhdGU6ZnVuY3Rpb24oKXtyZXR1cm4gbn0sYWx3YXlzOmZ1bmN0aW9uKCl7cmV0dXJuIGkuZG9uZShhcmd1bWVudHMpLmZhaWwoYXJndW1lbnRzKSx0aGlzfSx0aGVuOmZ1bmN0aW9uKCl7dmFyIGU9YXJndW1lbnRzO3JldHVybiBiLkRlZmVycmVkKGZ1bmN0aW9uKG4pe2IuZWFjaCh0LGZ1bmN0aW9uKHQsbyl7dmFyIGE9b1swXSxzPWIuaXNGdW5jdGlvbihlW3RdKSYmZVt0XTtpW29bMV1dKGZ1bmN0aW9uKCl7dmFyIGU9cyYmcy5hcHBseSh0aGlzLGFyZ3VtZW50cyk7ZSYmYi5pc0Z1bmN0aW9uKGUucHJvbWlzZSk/ZS5wcm9taXNlKCkuZG9uZShuLnJlc29sdmUpLmZhaWwobi5yZWplY3QpLnByb2dyZXNzKG4ubm90aWZ5KTpuW2ErXCJXaXRoXCJdKHRoaXM9PT1yP24ucHJvbWlzZSgpOnRoaXMscz9bZV06YXJndW1lbnRzKX0pfSksZT1udWxsfSkucHJvbWlzZSgpfSxwcm9taXNlOmZ1bmN0aW9uKGUpe3JldHVybiBudWxsIT1lP2IuZXh0ZW5kKGUscik6cn19LGk9e307cmV0dXJuIHIucGlwZT1yLnRoZW4sYi5lYWNoKHQsZnVuY3Rpb24oZSxvKXt2YXIgYT1vWzJdLHM9b1szXTtyW29bMV1dPWEuYWRkLHMmJmEuYWRkKGZ1bmN0aW9uKCl7bj1zfSx0WzFeZV1bMl0uZGlzYWJsZSx0WzJdWzJdLmxvY2spLGlbb1swXV09ZnVuY3Rpb24oKXtyZXR1cm4gaVtvWzBdK1wiV2l0aFwiXSh0aGlzPT09aT9yOnRoaXMsYXJndW1lbnRzKSx0aGlzfSxpW29bMF0rXCJXaXRoXCJdPWEuZmlyZVdpdGh9KSxyLnByb21pc2UoaSksZSYmZS5jYWxsKGksaSksaX0sd2hlbjpmdW5jdGlvbihlKXt2YXIgdD0wLG49aC5jYWxsKGFyZ3VtZW50cykscj1uLmxlbmd0aCxpPTEhPT1yfHxlJiZiLmlzRnVuY3Rpb24oZS5wcm9taXNlKT9yOjAsbz0xPT09aT9lOmIuRGVmZXJyZWQoKSxhPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZnVuY3Rpb24ocil7dFtlXT10aGlzLG5bZV09YXJndW1lbnRzLmxlbmd0aD4xP2guY2FsbChhcmd1bWVudHMpOnIsbj09PXM/by5ub3RpZnlXaXRoKHQsbik6LS1pfHxvLnJlc29sdmVXaXRoKHQsbil9fSxzLHUsbDtpZihyPjEpZm9yKHM9QXJyYXkociksdT1BcnJheShyKSxsPUFycmF5KHIpO3I+dDt0Kyspblt0XSYmYi5pc0Z1bmN0aW9uKG5bdF0ucHJvbWlzZSk/blt0XS5wcm9taXNlKCkuZG9uZShhKHQsbCxuKSkuZmFpbChvLnJlamVjdCkucHJvZ3Jlc3MoYSh0LHUscykpOi0taTtyZXR1cm4gaXx8by5yZXNvbHZlV2l0aChsLG4pLG8ucHJvbWlzZSgpfX0pLGIuc3VwcG9ydD1mdW5jdGlvbigpe3ZhciB0LG4scixhLHMsdSxsLGMscCxmLGQ9by5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO2lmKGQuc2V0QXR0cmlidXRlKFwiY2xhc3NOYW1lXCIsXCJ0XCIpLGQuaW5uZXJIVE1MPVwiICA8bGluay8+PHRhYmxlPjwvdGFibGU+PGEgaHJlZj0nL2EnPmE8L2E+PGlucHV0IHR5cGU9J2NoZWNrYm94Jy8+XCIsbj1kLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiKlwiKSxyPWQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJhXCIpWzBdLCFufHwhcnx8IW4ubGVuZ3RoKXJldHVybnt9O3M9by5jcmVhdGVFbGVtZW50KFwic2VsZWN0XCIpLGw9cy5hcHBlbmRDaGlsZChvLmNyZWF0ZUVsZW1lbnQoXCJvcHRpb25cIikpLGE9ZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImlucHV0XCIpWzBdLHIuc3R5bGUuY3NzVGV4dD1cInRvcDoxcHg7ZmxvYXQ6bGVmdDtvcGFjaXR5Oi41XCIsdD17Z2V0U2V0QXR0cmlidXRlOlwidFwiIT09ZC5jbGFzc05hbWUsbGVhZGluZ1doaXRlc3BhY2U6Mz09PWQuZmlyc3RDaGlsZC5ub2RlVHlwZSx0Ym9keTohZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInRib2R5XCIpLmxlbmd0aCxodG1sU2VyaWFsaXplOiEhZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImxpbmtcIikubGVuZ3RoLHN0eWxlOi90b3AvLnRlc3Qoci5nZXRBdHRyaWJ1dGUoXCJzdHlsZVwiKSksaHJlZk5vcm1hbGl6ZWQ6XCIvYVwiPT09ci5nZXRBdHRyaWJ1dGUoXCJocmVmXCIpLG9wYWNpdHk6L14wLjUvLnRlc3Qoci5zdHlsZS5vcGFjaXR5KSxjc3NGbG9hdDohIXIuc3R5bGUuY3NzRmxvYXQsY2hlY2tPbjohIWEudmFsdWUsb3B0U2VsZWN0ZWQ6bC5zZWxlY3RlZCxlbmN0eXBlOiEhby5jcmVhdGVFbGVtZW50KFwiZm9ybVwiKS5lbmN0eXBlLGh0bWw1Q2xvbmU6XCI8Om5hdj48LzpuYXY+XCIhPT1vLmNyZWF0ZUVsZW1lbnQoXCJuYXZcIikuY2xvbmVOb2RlKCEwKS5vdXRlckhUTUwsYm94TW9kZWw6XCJDU1MxQ29tcGF0XCI9PT1vLmNvbXBhdE1vZGUsZGVsZXRlRXhwYW5kbzohMCxub0Nsb25lRXZlbnQ6ITAsaW5saW5lQmxvY2tOZWVkc0xheW91dDohMSxzaHJpbmtXcmFwQmxvY2tzOiExLHJlbGlhYmxlTWFyZ2luUmlnaHQ6ITAsYm94U2l6aW5nUmVsaWFibGU6ITAscGl4ZWxQb3NpdGlvbjohMX0sYS5jaGVja2VkPSEwLHQubm9DbG9uZUNoZWNrZWQ9YS5jbG9uZU5vZGUoITApLmNoZWNrZWQscy5kaXNhYmxlZD0hMCx0Lm9wdERpc2FibGVkPSFsLmRpc2FibGVkO3RyeXtkZWxldGUgZC50ZXN0fWNhdGNoKGgpe3QuZGVsZXRlRXhwYW5kbz0hMX1hPW8uY3JlYXRlRWxlbWVudChcImlucHV0XCIpLGEuc2V0QXR0cmlidXRlKFwidmFsdWVcIixcIlwiKSx0LmlucHV0PVwiXCI9PT1hLmdldEF0dHJpYnV0ZShcInZhbHVlXCIpLGEudmFsdWU9XCJ0XCIsYS5zZXRBdHRyaWJ1dGUoXCJ0eXBlXCIsXCJyYWRpb1wiKSx0LnJhZGlvVmFsdWU9XCJ0XCI9PT1hLnZhbHVlLGEuc2V0QXR0cmlidXRlKFwiY2hlY2tlZFwiLFwidFwiKSxhLnNldEF0dHJpYnV0ZShcIm5hbWVcIixcInRcIiksdT1vLmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSx1LmFwcGVuZENoaWxkKGEpLHQuYXBwZW5kQ2hlY2tlZD1hLmNoZWNrZWQsdC5jaGVja0Nsb25lPXUuY2xvbmVOb2RlKCEwKS5jbG9uZU5vZGUoITApLmxhc3RDaGlsZC5jaGVja2VkLGQuYXR0YWNoRXZlbnQmJihkLmF0dGFjaEV2ZW50KFwib25jbGlja1wiLGZ1bmN0aW9uKCl7dC5ub0Nsb25lRXZlbnQ9ITF9KSxkLmNsb25lTm9kZSghMCkuY2xpY2soKSk7Zm9yKGYgaW57c3VibWl0OiEwLGNoYW5nZTohMCxmb2N1c2luOiEwfSlkLnNldEF0dHJpYnV0ZShjPVwib25cIitmLFwidFwiKSx0W2YrXCJCdWJibGVzXCJdPWMgaW4gZXx8ZC5hdHRyaWJ1dGVzW2NdLmV4cGFuZG89PT0hMTtyZXR1cm4gZC5zdHlsZS5iYWNrZ3JvdW5kQ2xpcD1cImNvbnRlbnQtYm94XCIsZC5jbG9uZU5vZGUoITApLnN0eWxlLmJhY2tncm91bmRDbGlwPVwiXCIsdC5jbGVhckNsb25lU3R5bGU9XCJjb250ZW50LWJveFwiPT09ZC5zdHlsZS5iYWNrZ3JvdW5kQ2xpcCxiKGZ1bmN0aW9uKCl7dmFyIG4scixhLHM9XCJwYWRkaW5nOjA7bWFyZ2luOjA7Ym9yZGVyOjA7ZGlzcGxheTpibG9jaztib3gtc2l6aW5nOmNvbnRlbnQtYm94Oy1tb3otYm94LXNpemluZzpjb250ZW50LWJveDstd2Via2l0LWJveC1zaXppbmc6Y29udGVudC1ib3g7XCIsdT1vLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiYm9keVwiKVswXTt1JiYobj1vLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiksbi5zdHlsZS5jc3NUZXh0PVwiYm9yZGVyOjA7d2lkdGg6MDtoZWlnaHQ6MDtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MDtsZWZ0Oi05OTk5cHg7bWFyZ2luLXRvcDoxcHhcIix1LmFwcGVuZENoaWxkKG4pLmFwcGVuZENoaWxkKGQpLGQuaW5uZXJIVE1MPVwiPHRhYmxlPjx0cj48dGQ+PC90ZD48dGQ+dDwvdGQ+PC90cj48L3RhYmxlPlwiLGE9ZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInRkXCIpLGFbMF0uc3R5bGUuY3NzVGV4dD1cInBhZGRpbmc6MDttYXJnaW46MDtib3JkZXI6MDtkaXNwbGF5Om5vbmVcIixwPTA9PT1hWzBdLm9mZnNldEhlaWdodCxhWzBdLnN0eWxlLmRpc3BsYXk9XCJcIixhWzFdLnN0eWxlLmRpc3BsYXk9XCJub25lXCIsdC5yZWxpYWJsZUhpZGRlbk9mZnNldHM9cCYmMD09PWFbMF0ub2Zmc2V0SGVpZ2h0LGQuaW5uZXJIVE1MPVwiXCIsZC5zdHlsZS5jc3NUZXh0PVwiYm94LXNpemluZzpib3JkZXItYm94Oy1tb3otYm94LXNpemluZzpib3JkZXItYm94Oy13ZWJraXQtYm94LXNpemluZzpib3JkZXItYm94O3BhZGRpbmc6MXB4O2JvcmRlcjoxcHg7ZGlzcGxheTpibG9jazt3aWR0aDo0cHg7bWFyZ2luLXRvcDoxJTtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6MSU7XCIsdC5ib3hTaXppbmc9ND09PWQub2Zmc2V0V2lkdGgsdC5kb2VzTm90SW5jbHVkZU1hcmdpbkluQm9keU9mZnNldD0xIT09dS5vZmZzZXRUb3AsZS5nZXRDb21wdXRlZFN0eWxlJiYodC5waXhlbFBvc2l0aW9uPVwiMSVcIiE9PShlLmdldENvbXB1dGVkU3R5bGUoZCxudWxsKXx8e30pLnRvcCx0LmJveFNpemluZ1JlbGlhYmxlPVwiNHB4XCI9PT0oZS5nZXRDb21wdXRlZFN0eWxlKGQsbnVsbCl8fHt3aWR0aDpcIjRweFwifSkud2lkdGgscj1kLmFwcGVuZENoaWxkKG8uY3JlYXRlRWxlbWVudChcImRpdlwiKSksci5zdHlsZS5jc3NUZXh0PWQuc3R5bGUuY3NzVGV4dD1zLHIuc3R5bGUubWFyZ2luUmlnaHQ9ci5zdHlsZS53aWR0aD1cIjBcIixkLnN0eWxlLndpZHRoPVwiMXB4XCIsdC5yZWxpYWJsZU1hcmdpblJpZ2h0PSFwYXJzZUZsb2F0KChlLmdldENvbXB1dGVkU3R5bGUocixudWxsKXx8e30pLm1hcmdpblJpZ2h0KSksdHlwZW9mIGQuc3R5bGUuem9vbSE9PWkmJihkLmlubmVySFRNTD1cIlwiLGQuc3R5bGUuY3NzVGV4dD1zK1wid2lkdGg6MXB4O3BhZGRpbmc6MXB4O2Rpc3BsYXk6aW5saW5lO3pvb206MVwiLHQuaW5saW5lQmxvY2tOZWVkc0xheW91dD0zPT09ZC5vZmZzZXRXaWR0aCxkLnN0eWxlLmRpc3BsYXk9XCJibG9ja1wiLGQuaW5uZXJIVE1MPVwiPGRpdj48L2Rpdj5cIixkLmZpcnN0Q2hpbGQuc3R5bGUud2lkdGg9XCI1cHhcIix0LnNocmlua1dyYXBCbG9ja3M9MyE9PWQub2Zmc2V0V2lkdGgsdC5pbmxpbmVCbG9ja05lZWRzTGF5b3V0JiYodS5zdHlsZS56b29tPTEpKSx1LnJlbW92ZUNoaWxkKG4pLG49ZD1hPXI9bnVsbCl9KSxuPXM9dT1sPXI9YT1udWxsLHR9KCk7dmFyIE89Lyg/Olxce1tcXHNcXFNdKlxcfXxcXFtbXFxzXFxTXSpcXF0pJC8sQj0vKFtBLVpdKS9nO2Z1bmN0aW9uIFAoZSxuLHIsaSl7aWYoYi5hY2NlcHREYXRhKGUpKXt2YXIgbyxhLHM9Yi5leHBhbmRvLHU9XCJzdHJpbmdcIj09dHlwZW9mIG4sbD1lLm5vZGVUeXBlLHA9bD9iLmNhY2hlOmUsZj1sP2Vbc106ZVtzXSYmcztpZihmJiZwW2ZdJiYoaXx8cFtmXS5kYXRhKXx8IXV8fHIhPT10KXJldHVybiBmfHwobD9lW3NdPWY9Yy5wb3AoKXx8Yi5ndWlkKys6Zj1zKSxwW2ZdfHwocFtmXT17fSxsfHwocFtmXS50b0pTT049Yi5ub29wKSksKFwib2JqZWN0XCI9PXR5cGVvZiBufHxcImZ1bmN0aW9uXCI9PXR5cGVvZiBuKSYmKGk/cFtmXT1iLmV4dGVuZChwW2ZdLG4pOnBbZl0uZGF0YT1iLmV4dGVuZChwW2ZdLmRhdGEsbikpLG89cFtmXSxpfHwoby5kYXRhfHwoby5kYXRhPXt9KSxvPW8uZGF0YSksciE9PXQmJihvW2IuY2FtZWxDYXNlKG4pXT1yKSx1PyhhPW9bbl0sbnVsbD09YSYmKGE9b1tiLmNhbWVsQ2FzZShuKV0pKTphPW8sYX19ZnVuY3Rpb24gUihlLHQsbil7aWYoYi5hY2NlcHREYXRhKGUpKXt2YXIgcixpLG8sYT1lLm5vZGVUeXBlLHM9YT9iLmNhY2hlOmUsdT1hP2VbYi5leHBhbmRvXTpiLmV4cGFuZG87aWYoc1t1XSl7aWYodCYmKG89bj9zW3VdOnNbdV0uZGF0YSkpe2IuaXNBcnJheSh0KT90PXQuY29uY2F0KGIubWFwKHQsYi5jYW1lbENhc2UpKTp0IGluIG8/dD1bdF06KHQ9Yi5jYW1lbENhc2UodCksdD10IGluIG8/W3RdOnQuc3BsaXQoXCIgXCIpKTtmb3Iocj0wLGk9dC5sZW5ndGg7aT5yO3IrKylkZWxldGUgb1t0W3JdXTtpZighKG4/JDpiLmlzRW1wdHlPYmplY3QpKG8pKXJldHVybn0obnx8KGRlbGV0ZSBzW3VdLmRhdGEsJChzW3VdKSkpJiYoYT9iLmNsZWFuRGF0YShbZV0sITApOmIuc3VwcG9ydC5kZWxldGVFeHBhbmRvfHxzIT1zLndpbmRvdz9kZWxldGUgc1t1XTpzW3VdPW51bGwpfX19Yi5leHRlbmQoe2NhY2hlOnt9LGV4cGFuZG86XCJqUXVlcnlcIisocCtNYXRoLnJhbmRvbSgpKS5yZXBsYWNlKC9cXEQvZyxcIlwiKSxub0RhdGE6e2VtYmVkOiEwLG9iamVjdDpcImNsc2lkOkQyN0NEQjZFLUFFNkQtMTFjZi05NkI4LTQ0NDU1MzU0MDAwMFwiLGFwcGxldDohMH0saGFzRGF0YTpmdW5jdGlvbihlKXtyZXR1cm4gZT1lLm5vZGVUeXBlP2IuY2FjaGVbZVtiLmV4cGFuZG9dXTplW2IuZXhwYW5kb10sISFlJiYhJChlKX0sZGF0YTpmdW5jdGlvbihlLHQsbil7cmV0dXJuIFAoZSx0LG4pfSxyZW1vdmVEYXRhOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIFIoZSx0KX0sX2RhdGE6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBQKGUsdCxuLCEwKX0sX3JlbW92ZURhdGE6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gUihlLHQsITApfSxhY2NlcHREYXRhOmZ1bmN0aW9uKGUpe2lmKGUubm9kZVR5cGUmJjEhPT1lLm5vZGVUeXBlJiY5IT09ZS5ub2RlVHlwZSlyZXR1cm4hMTt2YXIgdD1lLm5vZGVOYW1lJiZiLm5vRGF0YVtlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCldO3JldHVybiF0fHx0IT09ITAmJmUuZ2V0QXR0cmlidXRlKFwiY2xhc3NpZFwiKT09PXR9fSksYi5mbi5leHRlbmQoe2RhdGE6ZnVuY3Rpb24oZSxuKXt2YXIgcixpLG89dGhpc1swXSxhPTAscz1udWxsO2lmKGU9PT10KXtpZih0aGlzLmxlbmd0aCYmKHM9Yi5kYXRhKG8pLDE9PT1vLm5vZGVUeXBlJiYhYi5fZGF0YShvLFwicGFyc2VkQXR0cnNcIikpKXtmb3Iocj1vLmF0dHJpYnV0ZXM7ci5sZW5ndGg+YTthKyspaT1yW2FdLm5hbWUsaS5pbmRleE9mKFwiZGF0YS1cIil8fChpPWIuY2FtZWxDYXNlKGkuc2xpY2UoNSkpLFcobyxpLHNbaV0pKTtiLl9kYXRhKG8sXCJwYXJzZWRBdHRyc1wiLCEwKX1yZXR1cm4gc31yZXR1cm5cIm9iamVjdFwiPT10eXBlb2YgZT90aGlzLmVhY2goZnVuY3Rpb24oKXtiLmRhdGEodGhpcyxlKX0pOmIuYWNjZXNzKHRoaXMsZnVuY3Rpb24obil7cmV0dXJuIG49PT10P28/VyhvLGUsYi5kYXRhKG8sZSkpOm51bGw6KHRoaXMuZWFjaChmdW5jdGlvbigpe2IuZGF0YSh0aGlzLGUsbil9KSx0KX0sbnVsbCxuLGFyZ3VtZW50cy5sZW5ndGg+MSxudWxsLCEwKX0scmVtb3ZlRGF0YTpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5yZW1vdmVEYXRhKHRoaXMsZSl9KX19KTtmdW5jdGlvbiBXKGUsbixyKXtpZihyPT09dCYmMT09PWUubm9kZVR5cGUpe3ZhciBpPVwiZGF0YS1cIituLnJlcGxhY2UoQixcIi0kMVwiKS50b0xvd2VyQ2FzZSgpO2lmKHI9ZS5nZXRBdHRyaWJ1dGUoaSksXCJzdHJpbmdcIj09dHlwZW9mIHIpe3RyeXtyPVwidHJ1ZVwiPT09cj8hMDpcImZhbHNlXCI9PT1yPyExOlwibnVsbFwiPT09cj9udWxsOityK1wiXCI9PT1yPytyOk8udGVzdChyKT9iLnBhcnNlSlNPTihyKTpyfWNhdGNoKG8pe31iLmRhdGEoZSxuLHIpfWVsc2Ugcj10fXJldHVybiByfWZ1bmN0aW9uICQoZSl7dmFyIHQ7Zm9yKHQgaW4gZSlpZigoXCJkYXRhXCIhPT10fHwhYi5pc0VtcHR5T2JqZWN0KGVbdF0pKSYmXCJ0b0pTT05cIiE9PXQpcmV0dXJuITE7cmV0dXJuITB9Yi5leHRlbmQoe3F1ZXVlOmZ1bmN0aW9uKGUsbixyKXt2YXIgaTtyZXR1cm4gZT8obj0obnx8XCJmeFwiKStcInF1ZXVlXCIsaT1iLl9kYXRhKGUsbiksciYmKCFpfHxiLmlzQXJyYXkocik/aT1iLl9kYXRhKGUsbixiLm1ha2VBcnJheShyKSk6aS5wdXNoKHIpKSxpfHxbXSk6dH0sZGVxdWV1ZTpmdW5jdGlvbihlLHQpe3Q9dHx8XCJmeFwiO3ZhciBuPWIucXVldWUoZSx0KSxyPW4ubGVuZ3RoLGk9bi5zaGlmdCgpLG89Yi5fcXVldWVIb29rcyhlLHQpLGE9ZnVuY3Rpb24oKXtiLmRlcXVldWUoZSx0KX07XCJpbnByb2dyZXNzXCI9PT1pJiYoaT1uLnNoaWZ0KCksci0tKSxvLmN1cj1pLGkmJihcImZ4XCI9PT10JiZuLnVuc2hpZnQoXCJpbnByb2dyZXNzXCIpLGRlbGV0ZSBvLnN0b3AsaS5jYWxsKGUsYSxvKSksIXImJm8mJm8uZW1wdHkuZmlyZSgpfSxfcXVldWVIb29rczpmdW5jdGlvbihlLHQpe3ZhciBuPXQrXCJxdWV1ZUhvb2tzXCI7cmV0dXJuIGIuX2RhdGEoZSxuKXx8Yi5fZGF0YShlLG4se2VtcHR5OmIuQ2FsbGJhY2tzKFwib25jZSBtZW1vcnlcIikuYWRkKGZ1bmN0aW9uKCl7Yi5fcmVtb3ZlRGF0YShlLHQrXCJxdWV1ZVwiKSxiLl9yZW1vdmVEYXRhKGUsbil9KX0pfX0pLGIuZm4uZXh0ZW5kKHtxdWV1ZTpmdW5jdGlvbihlLG4pe3ZhciByPTI7cmV0dXJuXCJzdHJpbmdcIiE9dHlwZW9mIGUmJihuPWUsZT1cImZ4XCIsci0tKSxyPmFyZ3VtZW50cy5sZW5ndGg/Yi5xdWV1ZSh0aGlzWzBdLGUpOm49PT10P3RoaXM6dGhpcy5lYWNoKGZ1bmN0aW9uKCl7dmFyIHQ9Yi5xdWV1ZSh0aGlzLGUsbik7Yi5fcXVldWVIb29rcyh0aGlzLGUpLFwiZnhcIj09PWUmJlwiaW5wcm9ncmVzc1wiIT09dFswXSYmYi5kZXF1ZXVlKHRoaXMsZSl9KX0sZGVxdWV1ZTpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5kZXF1ZXVlKHRoaXMsZSl9KX0sZGVsYXk6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZT1iLmZ4P2IuZnguc3BlZWRzW2VdfHxlOmUsdD10fHxcImZ4XCIsdGhpcy5xdWV1ZSh0LGZ1bmN0aW9uKHQsbil7dmFyIHI9c2V0VGltZW91dCh0LGUpO24uc3RvcD1mdW5jdGlvbigpe2NsZWFyVGltZW91dChyKX19KX0sY2xlYXJRdWV1ZTpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5xdWV1ZShlfHxcImZ4XCIsW10pfSxwcm9taXNlOmZ1bmN0aW9uKGUsbil7dmFyIHIsaT0xLG89Yi5EZWZlcnJlZCgpLGE9dGhpcyxzPXRoaXMubGVuZ3RoLHU9ZnVuY3Rpb24oKXstLWl8fG8ucmVzb2x2ZVdpdGgoYSxbYV0pfTtcInN0cmluZ1wiIT10eXBlb2YgZSYmKG49ZSxlPXQpLGU9ZXx8XCJmeFwiO3doaWxlKHMtLSlyPWIuX2RhdGEoYVtzXSxlK1wicXVldWVIb29rc1wiKSxyJiZyLmVtcHR5JiYoaSsrLHIuZW1wdHkuYWRkKHUpKTtyZXR1cm4gdSgpLG8ucHJvbWlzZShuKX19KTt2YXIgSSx6LFg9L1tcXHRcXHJcXG5dL2csVT0vXFxyL2csVj0vXig/OmlucHV0fHNlbGVjdHx0ZXh0YXJlYXxidXR0b258b2JqZWN0KSQvaSxZPS9eKD86YXxhcmVhKSQvaSxKPS9eKD86Y2hlY2tlZHxzZWxlY3RlZHxhdXRvZm9jdXN8YXV0b3BsYXl8YXN5bmN8Y29udHJvbHN8ZGVmZXJ8ZGlzYWJsZWR8aGlkZGVufGxvb3B8bXVsdGlwbGV8b3BlbnxyZWFkb25seXxyZXF1aXJlZHxzY29wZWQpJC9pLEc9L14oPzpjaGVja2VkfHNlbGVjdGVkKSQvaSxRPWIuc3VwcG9ydC5nZXRTZXRBdHRyaWJ1dGUsSz1iLnN1cHBvcnQuaW5wdXQ7Yi5mbi5leHRlbmQoe2F0dHI6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxiLmF0dHIsZSx0LGFyZ3VtZW50cy5sZW5ndGg+MSl9LHJlbW92ZUF0dHI6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpe2IucmVtb3ZlQXR0cih0aGlzLGUpfSl9LHByb3A6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxiLnByb3AsZSx0LGFyZ3VtZW50cy5sZW5ndGg+MSl9LHJlbW92ZVByb3A6ZnVuY3Rpb24oZSl7cmV0dXJuIGU9Yi5wcm9wRml4W2VdfHxlLHRoaXMuZWFjaChmdW5jdGlvbigpe3RyeXt0aGlzW2VdPXQsZGVsZXRlIHRoaXNbZV19Y2F0Y2gobil7fX0pfSxhZGRDbGFzczpmdW5jdGlvbihlKXt2YXIgdCxuLHIsaSxvLGE9MCxzPXRoaXMubGVuZ3RoLHU9XCJzdHJpbmdcIj09dHlwZW9mIGUmJmU7aWYoYi5pc0Z1bmN0aW9uKGUpKXJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24odCl7Yih0aGlzKS5hZGRDbGFzcyhlLmNhbGwodGhpcyx0LHRoaXMuY2xhc3NOYW1lKSl9KTtpZih1KWZvcih0PShlfHxcIlwiKS5tYXRjaCh3KXx8W107cz5hO2ErKylpZihuPXRoaXNbYV0scj0xPT09bi5ub2RlVHlwZSYmKG4uY2xhc3NOYW1lPyhcIiBcIituLmNsYXNzTmFtZStcIiBcIikucmVwbGFjZShYLFwiIFwiKTpcIiBcIikpe289MDt3aGlsZShpPXRbbysrXSkwPnIuaW5kZXhPZihcIiBcIitpK1wiIFwiKSYmKHIrPWkrXCIgXCIpO24uY2xhc3NOYW1lPWIudHJpbShyKX1yZXR1cm4gdGhpc30scmVtb3ZlQ2xhc3M6ZnVuY3Rpb24oZSl7dmFyIHQsbixyLGksbyxhPTAscz10aGlzLmxlbmd0aCx1PTA9PT1hcmd1bWVudHMubGVuZ3RofHxcInN0cmluZ1wiPT10eXBlb2YgZSYmZTtpZihiLmlzRnVuY3Rpb24oZSkpcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbih0KXtiKHRoaXMpLnJlbW92ZUNsYXNzKGUuY2FsbCh0aGlzLHQsdGhpcy5jbGFzc05hbWUpKX0pO2lmKHUpZm9yKHQ9KGV8fFwiXCIpLm1hdGNoKHcpfHxbXTtzPmE7YSsrKWlmKG49dGhpc1thXSxyPTE9PT1uLm5vZGVUeXBlJiYobi5jbGFzc05hbWU/KFwiIFwiK24uY2xhc3NOYW1lK1wiIFwiKS5yZXBsYWNlKFgsXCIgXCIpOlwiXCIpKXtvPTA7d2hpbGUoaT10W28rK10pd2hpbGUoci5pbmRleE9mKFwiIFwiK2krXCIgXCIpPj0wKXI9ci5yZXBsYWNlKFwiIFwiK2krXCIgXCIsXCIgXCIpO24uY2xhc3NOYW1lPWU/Yi50cmltKHIpOlwiXCJ9cmV0dXJuIHRoaXN9LHRvZ2dsZUNsYXNzOmZ1bmN0aW9uKGUsdCl7dmFyIG49dHlwZW9mIGUscj1cImJvb2xlYW5cIj09dHlwZW9mIHQ7cmV0dXJuIGIuaXNGdW5jdGlvbihlKT90aGlzLmVhY2goZnVuY3Rpb24obil7Yih0aGlzKS50b2dnbGVDbGFzcyhlLmNhbGwodGhpcyxuLHRoaXMuY2xhc3NOYW1lLHQpLHQpfSk6dGhpcy5lYWNoKGZ1bmN0aW9uKCl7aWYoXCJzdHJpbmdcIj09PW4pe3ZhciBvLGE9MCxzPWIodGhpcyksdT10LGw9ZS5tYXRjaCh3KXx8W107d2hpbGUobz1sW2ErK10pdT1yP3U6IXMuaGFzQ2xhc3Mobyksc1t1P1wiYWRkQ2xhc3NcIjpcInJlbW92ZUNsYXNzXCJdKG8pfWVsc2Uobj09PWl8fFwiYm9vbGVhblwiPT09bikmJih0aGlzLmNsYXNzTmFtZSYmYi5fZGF0YSh0aGlzLFwiX19jbGFzc05hbWVfX1wiLHRoaXMuY2xhc3NOYW1lKSx0aGlzLmNsYXNzTmFtZT10aGlzLmNsYXNzTmFtZXx8ZT09PSExP1wiXCI6Yi5fZGF0YSh0aGlzLFwiX19jbGFzc05hbWVfX1wiKXx8XCJcIil9KX0saGFzQ2xhc3M6ZnVuY3Rpb24oZSl7dmFyIHQ9XCIgXCIrZStcIiBcIixuPTAscj10aGlzLmxlbmd0aDtmb3IoO3I+bjtuKyspaWYoMT09PXRoaXNbbl0ubm9kZVR5cGUmJihcIiBcIit0aGlzW25dLmNsYXNzTmFtZStcIiBcIikucmVwbGFjZShYLFwiIFwiKS5pbmRleE9mKHQpPj0wKXJldHVybiEwO3JldHVybiExfSx2YWw6ZnVuY3Rpb24oZSl7dmFyIG4scixpLG89dGhpc1swXTt7aWYoYXJndW1lbnRzLmxlbmd0aClyZXR1cm4gaT1iLmlzRnVuY3Rpb24oZSksdGhpcy5lYWNoKGZ1bmN0aW9uKG4pe3ZhciBvLGE9Yih0aGlzKTsxPT09dGhpcy5ub2RlVHlwZSYmKG89aT9lLmNhbGwodGhpcyxuLGEudmFsKCkpOmUsbnVsbD09bz9vPVwiXCI6XCJudW1iZXJcIj09dHlwZW9mIG8/bys9XCJcIjpiLmlzQXJyYXkobykmJihvPWIubWFwKG8sZnVuY3Rpb24oZSl7cmV0dXJuIG51bGw9PWU/XCJcIjplK1wiXCJ9KSkscj1iLnZhbEhvb2tzW3RoaXMudHlwZV18fGIudmFsSG9va3NbdGhpcy5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpXSxyJiZcInNldFwiaW4gciYmci5zZXQodGhpcyxvLFwidmFsdWVcIikhPT10fHwodGhpcy52YWx1ZT1vKSl9KTtpZihvKXJldHVybiByPWIudmFsSG9va3Nbby50eXBlXXx8Yi52YWxIb29rc1tvLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCldLHImJlwiZ2V0XCJpbiByJiYobj1yLmdldChvLFwidmFsdWVcIikpIT09dD9uOihuPW8udmFsdWUsXCJzdHJpbmdcIj09dHlwZW9mIG4/bi5yZXBsYWNlKFUsXCJcIik6bnVsbD09bj9cIlwiOm4pfX19KSxiLmV4dGVuZCh7dmFsSG9va3M6e29wdGlvbjp7Z2V0OmZ1bmN0aW9uKGUpe3ZhciB0PWUuYXR0cmlidXRlcy52YWx1ZTtyZXR1cm4hdHx8dC5zcGVjaWZpZWQ/ZS52YWx1ZTplLnRleHR9fSxzZWxlY3Q6e2dldDpmdW5jdGlvbihlKXt2YXIgdCxuLHI9ZS5vcHRpb25zLGk9ZS5zZWxlY3RlZEluZGV4LG89XCJzZWxlY3Qtb25lXCI9PT1lLnR5cGV8fDA+aSxhPW8/bnVsbDpbXSxzPW8/aSsxOnIubGVuZ3RoLHU9MD5pP3M6bz9pOjA7Zm9yKDtzPnU7dSsrKWlmKG49clt1XSwhKCFuLnNlbGVjdGVkJiZ1IT09aXx8KGIuc3VwcG9ydC5vcHREaXNhYmxlZD9uLmRpc2FibGVkOm51bGwhPT1uLmdldEF0dHJpYnV0ZShcImRpc2FibGVkXCIpKXx8bi5wYXJlbnROb2RlLmRpc2FibGVkJiZiLm5vZGVOYW1lKG4ucGFyZW50Tm9kZSxcIm9wdGdyb3VwXCIpKSl7aWYodD1iKG4pLnZhbCgpLG8pcmV0dXJuIHQ7YS5wdXNoKHQpfXJldHVybiBhfSxzZXQ6ZnVuY3Rpb24oZSx0KXt2YXIgbj1iLm1ha2VBcnJheSh0KTtyZXR1cm4gYihlKS5maW5kKFwib3B0aW9uXCIpLmVhY2goZnVuY3Rpb24oKXt0aGlzLnNlbGVjdGVkPWIuaW5BcnJheShiKHRoaXMpLnZhbCgpLG4pPj0wfSksbi5sZW5ndGh8fChlLnNlbGVjdGVkSW5kZXg9LTEpLG59fX0sYXR0cjpmdW5jdGlvbihlLG4scil7dmFyIG8sYSxzLHU9ZS5ub2RlVHlwZTtpZihlJiYzIT09dSYmOCE9PXUmJjIhPT11KXJldHVybiB0eXBlb2YgZS5nZXRBdHRyaWJ1dGU9PT1pP2IucHJvcChlLG4scik6KGE9MSE9PXV8fCFiLmlzWE1MRG9jKGUpLGEmJihuPW4udG9Mb3dlckNhc2UoKSxvPWIuYXR0ckhvb2tzW25dfHwoSi50ZXN0KG4pP3o6SSkpLHI9PT10P28mJmEmJlwiZ2V0XCJpbiBvJiZudWxsIT09KHM9by5nZXQoZSxuKSk/czoodHlwZW9mIGUuZ2V0QXR0cmlidXRlIT09aSYmKHM9ZS5nZXRBdHRyaWJ1dGUobikpLG51bGw9PXM/dDpzKTpudWxsIT09cj9vJiZhJiZcInNldFwiaW4gbyYmKHM9by5zZXQoZSxyLG4pKSE9PXQ/czooZS5zZXRBdHRyaWJ1dGUobixyK1wiXCIpLHIpOihiLnJlbW92ZUF0dHIoZSxuKSx0KSl9LHJlbW92ZUF0dHI6ZnVuY3Rpb24oZSx0KXt2YXIgbixyLGk9MCxvPXQmJnQubWF0Y2godyk7aWYobyYmMT09PWUubm9kZVR5cGUpd2hpbGUobj1vW2krK10pcj1iLnByb3BGaXhbbl18fG4sSi50ZXN0KG4pPyFRJiZHLnRlc3Qobik/ZVtiLmNhbWVsQ2FzZShcImRlZmF1bHQtXCIrbildPWVbcl09ITE6ZVtyXT0hMTpiLmF0dHIoZSxuLFwiXCIpLGUucmVtb3ZlQXR0cmlidXRlKFE/bjpyKX0sYXR0ckhvb2tzOnt0eXBlOntzZXQ6ZnVuY3Rpb24oZSx0KXtpZighYi5zdXBwb3J0LnJhZGlvVmFsdWUmJlwicmFkaW9cIj09PXQmJmIubm9kZU5hbWUoZSxcImlucHV0XCIpKXt2YXIgbj1lLnZhbHVlO3JldHVybiBlLnNldEF0dHJpYnV0ZShcInR5cGVcIix0KSxuJiYoZS52YWx1ZT1uKSx0fX19fSxwcm9wRml4Ont0YWJpbmRleDpcInRhYkluZGV4XCIscmVhZG9ubHk6XCJyZWFkT25seVwiLFwiZm9yXCI6XCJodG1sRm9yXCIsXCJjbGFzc1wiOlwiY2xhc3NOYW1lXCIsbWF4bGVuZ3RoOlwibWF4TGVuZ3RoXCIsY2VsbHNwYWNpbmc6XCJjZWxsU3BhY2luZ1wiLGNlbGxwYWRkaW5nOlwiY2VsbFBhZGRpbmdcIixyb3dzcGFuOlwicm93U3BhblwiLGNvbHNwYW46XCJjb2xTcGFuXCIsdXNlbWFwOlwidXNlTWFwXCIsZnJhbWVib3JkZXI6XCJmcmFtZUJvcmRlclwiLGNvbnRlbnRlZGl0YWJsZTpcImNvbnRlbnRFZGl0YWJsZVwifSxwcm9wOmZ1bmN0aW9uKGUsbixyKXt2YXIgaSxvLGEscz1lLm5vZGVUeXBlO2lmKGUmJjMhPT1zJiY4IT09cyYmMiE9PXMpcmV0dXJuIGE9MSE9PXN8fCFiLmlzWE1MRG9jKGUpLGEmJihuPWIucHJvcEZpeFtuXXx8bixvPWIucHJvcEhvb2tzW25dKSxyIT09dD9vJiZcInNldFwiaW4gbyYmKGk9by5zZXQoZSxyLG4pKSE9PXQ/aTplW25dPXI6byYmXCJnZXRcImluIG8mJm51bGwhPT0oaT1vLmdldChlLG4pKT9pOmVbbl19LHByb3BIb29rczp7dGFiSW5kZXg6e2dldDpmdW5jdGlvbihlKXt2YXIgbj1lLmdldEF0dHJpYnV0ZU5vZGUoXCJ0YWJpbmRleFwiKTtyZXR1cm4gbiYmbi5zcGVjaWZpZWQ/cGFyc2VJbnQobi52YWx1ZSwxMCk6Vi50ZXN0KGUubm9kZU5hbWUpfHxZLnRlc3QoZS5ub2RlTmFtZSkmJmUuaHJlZj8wOnR9fX19KSx6PXtnZXQ6ZnVuY3Rpb24oZSxuKXt2YXIgcj1iLnByb3AoZSxuKSxpPVwiYm9vbGVhblwiPT10eXBlb2YgciYmZS5nZXRBdHRyaWJ1dGUobiksbz1cImJvb2xlYW5cIj09dHlwZW9mIHI/SyYmUT9udWxsIT1pOkcudGVzdChuKT9lW2IuY2FtZWxDYXNlKFwiZGVmYXVsdC1cIituKV06ISFpOmUuZ2V0QXR0cmlidXRlTm9kZShuKTtyZXR1cm4gbyYmby52YWx1ZSE9PSExP24udG9Mb3dlckNhc2UoKTp0fSxzZXQ6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiB0PT09ITE/Yi5yZW1vdmVBdHRyKGUsbik6SyYmUXx8IUcudGVzdChuKT9lLnNldEF0dHJpYnV0ZSghUSYmYi5wcm9wRml4W25dfHxuLG4pOmVbYi5jYW1lbENhc2UoXCJkZWZhdWx0LVwiK24pXT1lW25dPSEwLG59fSxLJiZRfHwoYi5hdHRySG9va3MudmFsdWU9e2dldDpmdW5jdGlvbihlLG4pe3ZhciByPWUuZ2V0QXR0cmlidXRlTm9kZShuKTtyZXR1cm4gYi5ub2RlTmFtZShlLFwiaW5wdXRcIik/ZS5kZWZhdWx0VmFsdWU6ciYmci5zcGVjaWZpZWQ/ci52YWx1ZTp0fSxzZXQ6ZnVuY3Rpb24oZSxuLHIpe3JldHVybiBiLm5vZGVOYW1lKGUsXCJpbnB1dFwiKT8oZS5kZWZhdWx0VmFsdWU9bix0KTpJJiZJLnNldChlLG4scil9fSksUXx8KEk9Yi52YWxIb29rcy5idXR0b249e2dldDpmdW5jdGlvbihlLG4pe3ZhciByPWUuZ2V0QXR0cmlidXRlTm9kZShuKTtyZXR1cm4gciYmKFwiaWRcIj09PW58fFwibmFtZVwiPT09bnx8XCJjb29yZHNcIj09PW4/XCJcIiE9PXIudmFsdWU6ci5zcGVjaWZpZWQpP3IudmFsdWU6dH0sc2V0OmZ1bmN0aW9uKGUsbixyKXt2YXIgaT1lLmdldEF0dHJpYnV0ZU5vZGUocik7cmV0dXJuIGl8fGUuc2V0QXR0cmlidXRlTm9kZShpPWUub3duZXJEb2N1bWVudC5jcmVhdGVBdHRyaWJ1dGUocikpLGkudmFsdWU9bis9XCJcIixcInZhbHVlXCI9PT1yfHxuPT09ZS5nZXRBdHRyaWJ1dGUocik/bjp0fX0sYi5hdHRySG9va3MuY29udGVudGVkaXRhYmxlPXtnZXQ6SS5nZXQsc2V0OmZ1bmN0aW9uKGUsdCxuKXtJLnNldChlLFwiXCI9PT10PyExOnQsbil9fSxiLmVhY2goW1wid2lkdGhcIixcImhlaWdodFwiXSxmdW5jdGlvbihlLG4pe2IuYXR0ckhvb2tzW25dPWIuZXh0ZW5kKGIuYXR0ckhvb2tzW25dLHtzZXQ6ZnVuY3Rpb24oZSxyKXtyZXR1cm5cIlwiPT09cj8oZS5zZXRBdHRyaWJ1dGUobixcImF1dG9cIikscik6dH19KX0pKSxiLnN1cHBvcnQuaHJlZk5vcm1hbGl6ZWR8fChiLmVhY2goW1wiaHJlZlwiLFwic3JjXCIsXCJ3aWR0aFwiLFwiaGVpZ2h0XCJdLGZ1bmN0aW9uKGUsbil7Yi5hdHRySG9va3Nbbl09Yi5leHRlbmQoYi5hdHRySG9va3Nbbl0se2dldDpmdW5jdGlvbihlKXt2YXIgcj1lLmdldEF0dHJpYnV0ZShuLDIpO3JldHVybiBudWxsPT1yP3Q6cn19KX0pLGIuZWFjaChbXCJocmVmXCIsXCJzcmNcIl0sZnVuY3Rpb24oZSx0KXtiLnByb3BIb29rc1t0XT17Z2V0OmZ1bmN0aW9uKGUpe3JldHVybiBlLmdldEF0dHJpYnV0ZSh0LDQpfX19KSksYi5zdXBwb3J0LnN0eWxlfHwoYi5hdHRySG9va3Muc3R5bGU9e2dldDpmdW5jdGlvbihlKXtyZXR1cm4gZS5zdHlsZS5jc3NUZXh0fHx0fSxzZXQ6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZS5zdHlsZS5jc3NUZXh0PXQrXCJcIn19KSxiLnN1cHBvcnQub3B0U2VsZWN0ZWR8fChiLnByb3BIb29rcy5zZWxlY3RlZD1iLmV4dGVuZChiLnByb3BIb29rcy5zZWxlY3RlZCx7Z2V0OmZ1bmN0aW9uKGUpe3ZhciB0PWUucGFyZW50Tm9kZTtyZXR1cm4gdCYmKHQuc2VsZWN0ZWRJbmRleCx0LnBhcmVudE5vZGUmJnQucGFyZW50Tm9kZS5zZWxlY3RlZEluZGV4KSxudWxsfX0pKSxiLnN1cHBvcnQuZW5jdHlwZXx8KGIucHJvcEZpeC5lbmN0eXBlPVwiZW5jb2RpbmdcIiksYi5zdXBwb3J0LmNoZWNrT258fGIuZWFjaChbXCJyYWRpb1wiLFwiY2hlY2tib3hcIl0sZnVuY3Rpb24oKXtiLnZhbEhvb2tzW3RoaXNdPXtnZXQ6ZnVuY3Rpb24oZSl7cmV0dXJuIG51bGw9PT1lLmdldEF0dHJpYnV0ZShcInZhbHVlXCIpP1wib25cIjplLnZhbHVlfX19KSxiLmVhY2goW1wicmFkaW9cIixcImNoZWNrYm94XCJdLGZ1bmN0aW9uKCl7Yi52YWxIb29rc1t0aGlzXT1iLmV4dGVuZChiLnZhbEhvb2tzW3RoaXNdLHtzZXQ6ZnVuY3Rpb24oZSxuKXtyZXR1cm4gYi5pc0FycmF5KG4pP2UuY2hlY2tlZD1iLmluQXJyYXkoYihlKS52YWwoKSxuKT49MDp0fX0pfSk7dmFyIFo9L14oPzppbnB1dHxzZWxlY3R8dGV4dGFyZWEpJC9pLGV0PS9ea2V5Lyx0dD0vXig/Om1vdXNlfGNvbnRleHRtZW51KXxjbGljay8sbnQ9L14oPzpmb2N1c2luZm9jdXN8Zm9jdXNvdXRibHVyKSQvLHJ0PS9eKFteLl0qKSg/OlxcLiguKyl8KSQvO2Z1bmN0aW9uIGl0KCl7cmV0dXJuITB9ZnVuY3Rpb24gb3QoKXtyZXR1cm4hMX1iLmV2ZW50PXtnbG9iYWw6e30sYWRkOmZ1bmN0aW9uKGUsbixyLG8sYSl7dmFyIHMsdSxsLGMscCxmLGQsaCxnLG0seSx2PWIuX2RhdGEoZSk7aWYodil7ci5oYW5kbGVyJiYoYz1yLHI9Yy5oYW5kbGVyLGE9Yy5zZWxlY3Rvciksci5ndWlkfHwoci5ndWlkPWIuZ3VpZCsrKSwodT12LmV2ZW50cyl8fCh1PXYuZXZlbnRzPXt9KSwoZj12LmhhbmRsZSl8fChmPXYuaGFuZGxlPWZ1bmN0aW9uKGUpe3JldHVybiB0eXBlb2YgYj09PWl8fGUmJmIuZXZlbnQudHJpZ2dlcmVkPT09ZS50eXBlP3Q6Yi5ldmVudC5kaXNwYXRjaC5hcHBseShmLmVsZW0sYXJndW1lbnRzKX0sZi5lbGVtPWUpLG49KG58fFwiXCIpLm1hdGNoKHcpfHxbXCJcIl0sbD1uLmxlbmd0aDt3aGlsZShsLS0pcz1ydC5leGVjKG5bbF0pfHxbXSxnPXk9c1sxXSxtPShzWzJdfHxcIlwiKS5zcGxpdChcIi5cIikuc29ydCgpLHA9Yi5ldmVudC5zcGVjaWFsW2ddfHx7fSxnPShhP3AuZGVsZWdhdGVUeXBlOnAuYmluZFR5cGUpfHxnLHA9Yi5ldmVudC5zcGVjaWFsW2ddfHx7fSxkPWIuZXh0ZW5kKHt0eXBlOmcsb3JpZ1R5cGU6eSxkYXRhOm8saGFuZGxlcjpyLGd1aWQ6ci5ndWlkLHNlbGVjdG9yOmEsbmVlZHNDb250ZXh0OmEmJmIuZXhwci5tYXRjaC5uZWVkc0NvbnRleHQudGVzdChhKSxuYW1lc3BhY2U6bS5qb2luKFwiLlwiKX0sYyksKGg9dVtnXSl8fChoPXVbZ109W10saC5kZWxlZ2F0ZUNvdW50PTAscC5zZXR1cCYmcC5zZXR1cC5jYWxsKGUsbyxtLGYpIT09ITF8fChlLmFkZEV2ZW50TGlzdGVuZXI/ZS5hZGRFdmVudExpc3RlbmVyKGcsZiwhMSk6ZS5hdHRhY2hFdmVudCYmZS5hdHRhY2hFdmVudChcIm9uXCIrZyxmKSkpLHAuYWRkJiYocC5hZGQuY2FsbChlLGQpLGQuaGFuZGxlci5ndWlkfHwoZC5oYW5kbGVyLmd1aWQ9ci5ndWlkKSksYT9oLnNwbGljZShoLmRlbGVnYXRlQ291bnQrKywwLGQpOmgucHVzaChkKSxiLmV2ZW50Lmdsb2JhbFtnXT0hMDtlPW51bGx9fSxyZW1vdmU6ZnVuY3Rpb24oZSx0LG4scixpKXt2YXIgbyxhLHMsdSxsLGMscCxmLGQsaCxnLG09Yi5oYXNEYXRhKGUpJiZiLl9kYXRhKGUpO2lmKG0mJihjPW0uZXZlbnRzKSl7dD0odHx8XCJcIikubWF0Y2godyl8fFtcIlwiXSxsPXQubGVuZ3RoO3doaWxlKGwtLSlpZihzPXJ0LmV4ZWModFtsXSl8fFtdLGQ9Zz1zWzFdLGg9KHNbMl18fFwiXCIpLnNwbGl0KFwiLlwiKS5zb3J0KCksZCl7cD1iLmV2ZW50LnNwZWNpYWxbZF18fHt9LGQ9KHI/cC5kZWxlZ2F0ZVR5cGU6cC5iaW5kVHlwZSl8fGQsZj1jW2RdfHxbXSxzPXNbMl0mJlJlZ0V4cChcIihefFxcXFwuKVwiK2guam9pbihcIlxcXFwuKD86LipcXFxcLnwpXCIpK1wiKFxcXFwufCQpXCIpLHU9bz1mLmxlbmd0aDt3aGlsZShvLS0pYT1mW29dLCFpJiZnIT09YS5vcmlnVHlwZXx8biYmbi5ndWlkIT09YS5ndWlkfHxzJiYhcy50ZXN0KGEubmFtZXNwYWNlKXx8ciYmciE9PWEuc2VsZWN0b3ImJihcIioqXCIhPT1yfHwhYS5zZWxlY3Rvcil8fChmLnNwbGljZShvLDEpLGEuc2VsZWN0b3ImJmYuZGVsZWdhdGVDb3VudC0tLHAucmVtb3ZlJiZwLnJlbW92ZS5jYWxsKGUsYSkpO3UmJiFmLmxlbmd0aCYmKHAudGVhcmRvd24mJnAudGVhcmRvd24uY2FsbChlLGgsbS5oYW5kbGUpIT09ITF8fGIucmVtb3ZlRXZlbnQoZSxkLG0uaGFuZGxlKSxkZWxldGUgY1tkXSl9ZWxzZSBmb3IoZCBpbiBjKWIuZXZlbnQucmVtb3ZlKGUsZCt0W2xdLG4sciwhMCk7Yi5pc0VtcHR5T2JqZWN0KGMpJiYoZGVsZXRlIG0uaGFuZGxlLGIuX3JlbW92ZURhdGEoZSxcImV2ZW50c1wiKSl9fSx0cmlnZ2VyOmZ1bmN0aW9uKG4scixpLGEpe3ZhciBzLHUsbCxjLHAsZixkLGg9W2l8fG9dLGc9eS5jYWxsKG4sXCJ0eXBlXCIpP24udHlwZTpuLG09eS5jYWxsKG4sXCJuYW1lc3BhY2VcIik/bi5uYW1lc3BhY2Uuc3BsaXQoXCIuXCIpOltdO2lmKGw9Zj1pPWl8fG8sMyE9PWkubm9kZVR5cGUmJjghPT1pLm5vZGVUeXBlJiYhbnQudGVzdChnK2IuZXZlbnQudHJpZ2dlcmVkKSYmKGcuaW5kZXhPZihcIi5cIik+PTAmJihtPWcuc3BsaXQoXCIuXCIpLGc9bS5zaGlmdCgpLG0uc29ydCgpKSx1PTA+Zy5pbmRleE9mKFwiOlwiKSYmXCJvblwiK2csbj1uW2IuZXhwYW5kb10/bjpuZXcgYi5FdmVudChnLFwib2JqZWN0XCI9PXR5cGVvZiBuJiZuKSxuLmlzVHJpZ2dlcj0hMCxuLm5hbWVzcGFjZT1tLmpvaW4oXCIuXCIpLG4ubmFtZXNwYWNlX3JlPW4ubmFtZXNwYWNlP1JlZ0V4cChcIihefFxcXFwuKVwiK20uam9pbihcIlxcXFwuKD86LipcXFxcLnwpXCIpK1wiKFxcXFwufCQpXCIpOm51bGwsbi5yZXN1bHQ9dCxuLnRhcmdldHx8KG4udGFyZ2V0PWkpLHI9bnVsbD09cj9bbl06Yi5tYWtlQXJyYXkocixbbl0pLHA9Yi5ldmVudC5zcGVjaWFsW2ddfHx7fSxhfHwhcC50cmlnZ2VyfHxwLnRyaWdnZXIuYXBwbHkoaSxyKSE9PSExKSl7aWYoIWEmJiFwLm5vQnViYmxlJiYhYi5pc1dpbmRvdyhpKSl7Zm9yKGM9cC5kZWxlZ2F0ZVR5cGV8fGcsbnQudGVzdChjK2cpfHwobD1sLnBhcmVudE5vZGUpO2w7bD1sLnBhcmVudE5vZGUpaC5wdXNoKGwpLGY9bDtmPT09KGkub3duZXJEb2N1bWVudHx8bykmJmgucHVzaChmLmRlZmF1bHRWaWV3fHxmLnBhcmVudFdpbmRvd3x8ZSl9ZD0wO3doaWxlKChsPWhbZCsrXSkmJiFuLmlzUHJvcGFnYXRpb25TdG9wcGVkKCkpbi50eXBlPWQ+MT9jOnAuYmluZFR5cGV8fGcscz0oYi5fZGF0YShsLFwiZXZlbnRzXCIpfHx7fSlbbi50eXBlXSYmYi5fZGF0YShsLFwiaGFuZGxlXCIpLHMmJnMuYXBwbHkobCxyKSxzPXUmJmxbdV0scyYmYi5hY2NlcHREYXRhKGwpJiZzLmFwcGx5JiZzLmFwcGx5KGwscik9PT0hMSYmbi5wcmV2ZW50RGVmYXVsdCgpO2lmKG4udHlwZT1nLCEoYXx8bi5pc0RlZmF1bHRQcmV2ZW50ZWQoKXx8cC5fZGVmYXVsdCYmcC5fZGVmYXVsdC5hcHBseShpLm93bmVyRG9jdW1lbnQscikhPT0hMXx8XCJjbGlja1wiPT09ZyYmYi5ub2RlTmFtZShpLFwiYVwiKXx8IWIuYWNjZXB0RGF0YShpKXx8IXV8fCFpW2ddfHxiLmlzV2luZG93KGkpKSl7Zj1pW3VdLGYmJihpW3VdPW51bGwpLGIuZXZlbnQudHJpZ2dlcmVkPWc7dHJ5e2lbZ10oKX1jYXRjaCh2KXt9Yi5ldmVudC50cmlnZ2VyZWQ9dCxmJiYoaVt1XT1mKX1yZXR1cm4gbi5yZXN1bHR9fSxkaXNwYXRjaDpmdW5jdGlvbihlKXtlPWIuZXZlbnQuZml4KGUpO3ZhciBuLHIsaSxvLGEscz1bXSx1PWguY2FsbChhcmd1bWVudHMpLGw9KGIuX2RhdGEodGhpcyxcImV2ZW50c1wiKXx8e30pW2UudHlwZV18fFtdLGM9Yi5ldmVudC5zcGVjaWFsW2UudHlwZV18fHt9O2lmKHVbMF09ZSxlLmRlbGVnYXRlVGFyZ2V0PXRoaXMsIWMucHJlRGlzcGF0Y2h8fGMucHJlRGlzcGF0Y2guY2FsbCh0aGlzLGUpIT09ITEpe3M9Yi5ldmVudC5oYW5kbGVycy5jYWxsKHRoaXMsZSxsKSxuPTA7d2hpbGUoKG89c1tuKytdKSYmIWUuaXNQcm9wYWdhdGlvblN0b3BwZWQoKSl7ZS5jdXJyZW50VGFyZ2V0PW8uZWxlbSxhPTA7d2hpbGUoKGk9by5oYW5kbGVyc1thKytdKSYmIWUuaXNJbW1lZGlhdGVQcm9wYWdhdGlvblN0b3BwZWQoKSkoIWUubmFtZXNwYWNlX3JlfHxlLm5hbWVzcGFjZV9yZS50ZXN0KGkubmFtZXNwYWNlKSkmJihlLmhhbmRsZU9iaj1pLGUuZGF0YT1pLmRhdGEscj0oKGIuZXZlbnQuc3BlY2lhbFtpLm9yaWdUeXBlXXx8e30pLmhhbmRsZXx8aS5oYW5kbGVyKS5hcHBseShvLmVsZW0sdSksciE9PXQmJihlLnJlc3VsdD1yKT09PSExJiYoZS5wcmV2ZW50RGVmYXVsdCgpLGUuc3RvcFByb3BhZ2F0aW9uKCkpKX1yZXR1cm4gYy5wb3N0RGlzcGF0Y2gmJmMucG9zdERpc3BhdGNoLmNhbGwodGhpcyxlKSxlLnJlc3VsdH19LGhhbmRsZXJzOmZ1bmN0aW9uKGUsbil7dmFyIHIsaSxvLGEscz1bXSx1PW4uZGVsZWdhdGVDb3VudCxsPWUudGFyZ2V0O2lmKHUmJmwubm9kZVR5cGUmJighZS5idXR0b258fFwiY2xpY2tcIiE9PWUudHlwZSkpZm9yKDtsIT10aGlzO2w9bC5wYXJlbnROb2RlfHx0aGlzKWlmKDE9PT1sLm5vZGVUeXBlJiYobC5kaXNhYmxlZCE9PSEwfHxcImNsaWNrXCIhPT1lLnR5cGUpKXtmb3Iobz1bXSxhPTA7dT5hO2ErKylpPW5bYV0scj1pLnNlbGVjdG9yK1wiIFwiLG9bcl09PT10JiYob1tyXT1pLm5lZWRzQ29udGV4dD9iKHIsdGhpcykuaW5kZXgobCk+PTA6Yi5maW5kKHIsdGhpcyxudWxsLFtsXSkubGVuZ3RoKSxvW3JdJiZvLnB1c2goaSk7by5sZW5ndGgmJnMucHVzaCh7ZWxlbTpsLGhhbmRsZXJzOm99KX1yZXR1cm4gbi5sZW5ndGg+dSYmcy5wdXNoKHtlbGVtOnRoaXMsaGFuZGxlcnM6bi5zbGljZSh1KX0pLHN9LGZpeDpmdW5jdGlvbihlKXtpZihlW2IuZXhwYW5kb10pcmV0dXJuIGU7dmFyIHQsbixyLGk9ZS50eXBlLGE9ZSxzPXRoaXMuZml4SG9va3NbaV07c3x8KHRoaXMuZml4SG9va3NbaV09cz10dC50ZXN0KGkpP3RoaXMubW91c2VIb29rczpldC50ZXN0KGkpP3RoaXMua2V5SG9va3M6e30pLHI9cy5wcm9wcz90aGlzLnByb3BzLmNvbmNhdChzLnByb3BzKTp0aGlzLnByb3BzLGU9bmV3IGIuRXZlbnQoYSksdD1yLmxlbmd0aDt3aGlsZSh0LS0pbj1yW3RdLGVbbl09YVtuXTtyZXR1cm4gZS50YXJnZXR8fChlLnRhcmdldD1hLnNyY0VsZW1lbnR8fG8pLDM9PT1lLnRhcmdldC5ub2RlVHlwZSYmKGUudGFyZ2V0PWUudGFyZ2V0LnBhcmVudE5vZGUpLGUubWV0YUtleT0hIWUubWV0YUtleSxzLmZpbHRlcj9zLmZpbHRlcihlLGEpOmV9LHByb3BzOlwiYWx0S2V5IGJ1YmJsZXMgY2FuY2VsYWJsZSBjdHJsS2V5IGN1cnJlbnRUYXJnZXQgZXZlbnRQaGFzZSBtZXRhS2V5IHJlbGF0ZWRUYXJnZXQgc2hpZnRLZXkgdGFyZ2V0IHRpbWVTdGFtcCB2aWV3IHdoaWNoXCIuc3BsaXQoXCIgXCIpLGZpeEhvb2tzOnt9LGtleUhvb2tzOntwcm9wczpcImNoYXIgY2hhckNvZGUga2V5IGtleUNvZGVcIi5zcGxpdChcIiBcIiksZmlsdGVyOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIG51bGw9PWUud2hpY2gmJihlLndoaWNoPW51bGwhPXQuY2hhckNvZGU/dC5jaGFyQ29kZTp0LmtleUNvZGUpLGV9fSxtb3VzZUhvb2tzOntwcm9wczpcImJ1dHRvbiBidXR0b25zIGNsaWVudFggY2xpZW50WSBmcm9tRWxlbWVudCBvZmZzZXRYIG9mZnNldFkgcGFnZVggcGFnZVkgc2NyZWVuWCBzY3JlZW5ZIHRvRWxlbWVudFwiLnNwbGl0KFwiIFwiKSxmaWx0ZXI6ZnVuY3Rpb24oZSxuKXt2YXIgcixpLGEscz1uLmJ1dHRvbix1PW4uZnJvbUVsZW1lbnQ7cmV0dXJuIG51bGw9PWUucGFnZVgmJm51bGwhPW4uY2xpZW50WCYmKGk9ZS50YXJnZXQub3duZXJEb2N1bWVudHx8byxhPWkuZG9jdW1lbnRFbGVtZW50LHI9aS5ib2R5LGUucGFnZVg9bi5jbGllbnRYKyhhJiZhLnNjcm9sbExlZnR8fHImJnIuc2Nyb2xsTGVmdHx8MCktKGEmJmEuY2xpZW50TGVmdHx8ciYmci5jbGllbnRMZWZ0fHwwKSxlLnBhZ2VZPW4uY2xpZW50WSsoYSYmYS5zY3JvbGxUb3B8fHImJnIuc2Nyb2xsVG9wfHwwKS0oYSYmYS5jbGllbnRUb3B8fHImJnIuY2xpZW50VG9wfHwwKSksIWUucmVsYXRlZFRhcmdldCYmdSYmKGUucmVsYXRlZFRhcmdldD11PT09ZS50YXJnZXQ/bi50b0VsZW1lbnQ6dSksZS53aGljaHx8cz09PXR8fChlLndoaWNoPTEmcz8xOjImcz8zOjQmcz8yOjApLGV9fSxzcGVjaWFsOntsb2FkOntub0J1YmJsZTohMH0sY2xpY2s6e3RyaWdnZXI6ZnVuY3Rpb24oKXtyZXR1cm4gYi5ub2RlTmFtZSh0aGlzLFwiaW5wdXRcIikmJlwiY2hlY2tib3hcIj09PXRoaXMudHlwZSYmdGhpcy5jbGljaz8odGhpcy5jbGljaygpLCExKTp0fX0sZm9jdXM6e3RyaWdnZXI6ZnVuY3Rpb24oKXtpZih0aGlzIT09by5hY3RpdmVFbGVtZW50JiZ0aGlzLmZvY3VzKXRyeXtyZXR1cm4gdGhpcy5mb2N1cygpLCExfWNhdGNoKGUpe319LGRlbGVnYXRlVHlwZTpcImZvY3VzaW5cIn0sYmx1cjp7dHJpZ2dlcjpmdW5jdGlvbigpe3JldHVybiB0aGlzPT09by5hY3RpdmVFbGVtZW50JiZ0aGlzLmJsdXI/KHRoaXMuYmx1cigpLCExKTp0fSxkZWxlZ2F0ZVR5cGU6XCJmb2N1c291dFwifSxiZWZvcmV1bmxvYWQ6e3Bvc3REaXNwYXRjaDpmdW5jdGlvbihlKXtlLnJlc3VsdCE9PXQmJihlLm9yaWdpbmFsRXZlbnQucmV0dXJuVmFsdWU9ZS5yZXN1bHQpfX19LHNpbXVsYXRlOmZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPWIuZXh0ZW5kKG5ldyBiLkV2ZW50LG4se3R5cGU6ZSxpc1NpbXVsYXRlZDohMCxvcmlnaW5hbEV2ZW50Ont9fSk7cj9iLmV2ZW50LnRyaWdnZXIoaSxudWxsLHQpOmIuZXZlbnQuZGlzcGF0Y2guY2FsbCh0LGkpLGkuaXNEZWZhdWx0UHJldmVudGVkKCkmJm4ucHJldmVudERlZmF1bHQoKX19LGIucmVtb3ZlRXZlbnQ9by5yZW1vdmVFdmVudExpc3RlbmVyP2Z1bmN0aW9uKGUsdCxuKXtlLnJlbW92ZUV2ZW50TGlzdGVuZXImJmUucmVtb3ZlRXZlbnRMaXN0ZW5lcih0LG4sITEpfTpmdW5jdGlvbihlLHQsbil7dmFyIHI9XCJvblwiK3Q7ZS5kZXRhY2hFdmVudCYmKHR5cGVvZiBlW3JdPT09aSYmKGVbcl09bnVsbCksZS5kZXRhY2hFdmVudChyLG4pKX0sYi5FdmVudD1mdW5jdGlvbihlLG4pe3JldHVybiB0aGlzIGluc3RhbmNlb2YgYi5FdmVudD8oZSYmZS50eXBlPyh0aGlzLm9yaWdpbmFsRXZlbnQ9ZSx0aGlzLnR5cGU9ZS50eXBlLHRoaXMuaXNEZWZhdWx0UHJldmVudGVkPWUuZGVmYXVsdFByZXZlbnRlZHx8ZS5yZXR1cm5WYWx1ZT09PSExfHxlLmdldFByZXZlbnREZWZhdWx0JiZlLmdldFByZXZlbnREZWZhdWx0KCk/aXQ6b3QpOnRoaXMudHlwZT1lLG4mJmIuZXh0ZW5kKHRoaXMsbiksdGhpcy50aW1lU3RhbXA9ZSYmZS50aW1lU3RhbXB8fGIubm93KCksdGhpc1tiLmV4cGFuZG9dPSEwLHQpOm5ldyBiLkV2ZW50KGUsbil9LGIuRXZlbnQucHJvdG90eXBlPXtpc0RlZmF1bHRQcmV2ZW50ZWQ6b3QsaXNQcm9wYWdhdGlvblN0b3BwZWQ6b3QsaXNJbW1lZGlhdGVQcm9wYWdhdGlvblN0b3BwZWQ6b3QscHJldmVudERlZmF1bHQ6ZnVuY3Rpb24oKXt2YXIgZT10aGlzLm9yaWdpbmFsRXZlbnQ7dGhpcy5pc0RlZmF1bHRQcmV2ZW50ZWQ9aXQsZSYmKGUucHJldmVudERlZmF1bHQ/ZS5wcmV2ZW50RGVmYXVsdCgpOmUucmV0dXJuVmFsdWU9ITEpfSxzdG9wUHJvcGFnYXRpb246ZnVuY3Rpb24oKXt2YXIgZT10aGlzLm9yaWdpbmFsRXZlbnQ7dGhpcy5pc1Byb3BhZ2F0aW9uU3RvcHBlZD1pdCxlJiYoZS5zdG9wUHJvcGFnYXRpb24mJmUuc3RvcFByb3BhZ2F0aW9uKCksZS5jYW5jZWxCdWJibGU9ITApfSxzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb246ZnVuY3Rpb24oKXt0aGlzLmlzSW1tZWRpYXRlUHJvcGFnYXRpb25TdG9wcGVkPWl0LHRoaXMuc3RvcFByb3BhZ2F0aW9uKCl9fSxiLmVhY2goe21vdXNlZW50ZXI6XCJtb3VzZW92ZXJcIixtb3VzZWxlYXZlOlwibW91c2VvdXRcIn0sZnVuY3Rpb24oZSx0KXtiLmV2ZW50LnNwZWNpYWxbZV09e2RlbGVnYXRlVHlwZTp0LGJpbmRUeXBlOnQsaGFuZGxlOmZ1bmN0aW9uKGUpe3ZhciBuLHI9dGhpcyxpPWUucmVsYXRlZFRhcmdldCxvPWUuaGFuZGxlT2JqO1xucmV0dXJuKCFpfHxpIT09ciYmIWIuY29udGFpbnMocixpKSkmJihlLnR5cGU9by5vcmlnVHlwZSxuPW8uaGFuZGxlci5hcHBseSh0aGlzLGFyZ3VtZW50cyksZS50eXBlPXQpLG59fX0pLGIuc3VwcG9ydC5zdWJtaXRCdWJibGVzfHwoYi5ldmVudC5zcGVjaWFsLnN1Ym1pdD17c2V0dXA6ZnVuY3Rpb24oKXtyZXR1cm4gYi5ub2RlTmFtZSh0aGlzLFwiZm9ybVwiKT8hMTooYi5ldmVudC5hZGQodGhpcyxcImNsaWNrLl9zdWJtaXQga2V5cHJlc3MuX3N1Ym1pdFwiLGZ1bmN0aW9uKGUpe3ZhciBuPWUudGFyZ2V0LHI9Yi5ub2RlTmFtZShuLFwiaW5wdXRcIil8fGIubm9kZU5hbWUobixcImJ1dHRvblwiKT9uLmZvcm06dDtyJiYhYi5fZGF0YShyLFwic3VibWl0QnViYmxlc1wiKSYmKGIuZXZlbnQuYWRkKHIsXCJzdWJtaXQuX3N1Ym1pdFwiLGZ1bmN0aW9uKGUpe2UuX3N1Ym1pdF9idWJibGU9ITB9KSxiLl9kYXRhKHIsXCJzdWJtaXRCdWJibGVzXCIsITApKX0pLHQpfSxwb3N0RGlzcGF0Y2g6ZnVuY3Rpb24oZSl7ZS5fc3VibWl0X2J1YmJsZSYmKGRlbGV0ZSBlLl9zdWJtaXRfYnViYmxlLHRoaXMucGFyZW50Tm9kZSYmIWUuaXNUcmlnZ2VyJiZiLmV2ZW50LnNpbXVsYXRlKFwic3VibWl0XCIsdGhpcy5wYXJlbnROb2RlLGUsITApKX0sdGVhcmRvd246ZnVuY3Rpb24oKXtyZXR1cm4gYi5ub2RlTmFtZSh0aGlzLFwiZm9ybVwiKT8hMTooYi5ldmVudC5yZW1vdmUodGhpcyxcIi5fc3VibWl0XCIpLHQpfX0pLGIuc3VwcG9ydC5jaGFuZ2VCdWJibGVzfHwoYi5ldmVudC5zcGVjaWFsLmNoYW5nZT17c2V0dXA6ZnVuY3Rpb24oKXtyZXR1cm4gWi50ZXN0KHRoaXMubm9kZU5hbWUpPygoXCJjaGVja2JveFwiPT09dGhpcy50eXBlfHxcInJhZGlvXCI9PT10aGlzLnR5cGUpJiYoYi5ldmVudC5hZGQodGhpcyxcInByb3BlcnR5Y2hhbmdlLl9jaGFuZ2VcIixmdW5jdGlvbihlKXtcImNoZWNrZWRcIj09PWUub3JpZ2luYWxFdmVudC5wcm9wZXJ0eU5hbWUmJih0aGlzLl9qdXN0X2NoYW5nZWQ9ITApfSksYi5ldmVudC5hZGQodGhpcyxcImNsaWNrLl9jaGFuZ2VcIixmdW5jdGlvbihlKXt0aGlzLl9qdXN0X2NoYW5nZWQmJiFlLmlzVHJpZ2dlciYmKHRoaXMuX2p1c3RfY2hhbmdlZD0hMSksYi5ldmVudC5zaW11bGF0ZShcImNoYW5nZVwiLHRoaXMsZSwhMCl9KSksITEpOihiLmV2ZW50LmFkZCh0aGlzLFwiYmVmb3JlYWN0aXZhdGUuX2NoYW5nZVwiLGZ1bmN0aW9uKGUpe3ZhciB0PWUudGFyZ2V0O1oudGVzdCh0Lm5vZGVOYW1lKSYmIWIuX2RhdGEodCxcImNoYW5nZUJ1YmJsZXNcIikmJihiLmV2ZW50LmFkZCh0LFwiY2hhbmdlLl9jaGFuZ2VcIixmdW5jdGlvbihlKXshdGhpcy5wYXJlbnROb2RlfHxlLmlzU2ltdWxhdGVkfHxlLmlzVHJpZ2dlcnx8Yi5ldmVudC5zaW11bGF0ZShcImNoYW5nZVwiLHRoaXMucGFyZW50Tm9kZSxlLCEwKX0pLGIuX2RhdGEodCxcImNoYW5nZUJ1YmJsZXNcIiwhMCkpfSksdCl9LGhhbmRsZTpmdW5jdGlvbihlKXt2YXIgbj1lLnRhcmdldDtyZXR1cm4gdGhpcyE9PW58fGUuaXNTaW11bGF0ZWR8fGUuaXNUcmlnZ2VyfHxcInJhZGlvXCIhPT1uLnR5cGUmJlwiY2hlY2tib3hcIiE9PW4udHlwZT9lLmhhbmRsZU9iai5oYW5kbGVyLmFwcGx5KHRoaXMsYXJndW1lbnRzKTp0fSx0ZWFyZG93bjpmdW5jdGlvbigpe3JldHVybiBiLmV2ZW50LnJlbW92ZSh0aGlzLFwiLl9jaGFuZ2VcIiksIVoudGVzdCh0aGlzLm5vZGVOYW1lKX19KSxiLnN1cHBvcnQuZm9jdXNpbkJ1YmJsZXN8fGIuZWFjaCh7Zm9jdXM6XCJmb2N1c2luXCIsYmx1cjpcImZvY3Vzb3V0XCJ9LGZ1bmN0aW9uKGUsdCl7dmFyIG49MCxyPWZ1bmN0aW9uKGUpe2IuZXZlbnQuc2ltdWxhdGUodCxlLnRhcmdldCxiLmV2ZW50LmZpeChlKSwhMCl9O2IuZXZlbnQuc3BlY2lhbFt0XT17c2V0dXA6ZnVuY3Rpb24oKXswPT09bisrJiZvLmFkZEV2ZW50TGlzdGVuZXIoZSxyLCEwKX0sdGVhcmRvd246ZnVuY3Rpb24oKXswPT09LS1uJiZvLnJlbW92ZUV2ZW50TGlzdGVuZXIoZSxyLCEwKX19fSksYi5mbi5leHRlbmQoe29uOmZ1bmN0aW9uKGUsbixyLGksbyl7dmFyIGEscztpZihcIm9iamVjdFwiPT10eXBlb2YgZSl7XCJzdHJpbmdcIiE9dHlwZW9mIG4mJihyPXJ8fG4sbj10KTtmb3IoYSBpbiBlKXRoaXMub24oYSxuLHIsZVthXSxvKTtyZXR1cm4gdGhpc31pZihudWxsPT1yJiZudWxsPT1pPyhpPW4scj1uPXQpOm51bGw9PWkmJihcInN0cmluZ1wiPT10eXBlb2Ygbj8oaT1yLHI9dCk6KGk9cixyPW4sbj10KSksaT09PSExKWk9b3Q7ZWxzZSBpZighaSlyZXR1cm4gdGhpcztyZXR1cm4gMT09PW8mJihzPWksaT1mdW5jdGlvbihlKXtyZXR1cm4gYigpLm9mZihlKSxzLmFwcGx5KHRoaXMsYXJndW1lbnRzKX0saS5ndWlkPXMuZ3VpZHx8KHMuZ3VpZD1iLmd1aWQrKykpLHRoaXMuZWFjaChmdW5jdGlvbigpe2IuZXZlbnQuYWRkKHRoaXMsZSxpLHIsbil9KX0sb25lOmZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiB0aGlzLm9uKGUsdCxuLHIsMSl9LG9mZjpmdW5jdGlvbihlLG4scil7dmFyIGksbztpZihlJiZlLnByZXZlbnREZWZhdWx0JiZlLmhhbmRsZU9iailyZXR1cm4gaT1lLmhhbmRsZU9iaixiKGUuZGVsZWdhdGVUYXJnZXQpLm9mZihpLm5hbWVzcGFjZT9pLm9yaWdUeXBlK1wiLlwiK2kubmFtZXNwYWNlOmkub3JpZ1R5cGUsaS5zZWxlY3RvcixpLmhhbmRsZXIpLHRoaXM7aWYoXCJvYmplY3RcIj09dHlwZW9mIGUpe2ZvcihvIGluIGUpdGhpcy5vZmYobyxuLGVbb10pO3JldHVybiB0aGlzfXJldHVybihuPT09ITF8fFwiZnVuY3Rpb25cIj09dHlwZW9mIG4pJiYocj1uLG49dCkscj09PSExJiYocj1vdCksdGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5ldmVudC5yZW1vdmUodGhpcyxlLHIsbil9KX0sYmluZDpmdW5jdGlvbihlLHQsbil7cmV0dXJuIHRoaXMub24oZSxudWxsLHQsbil9LHVuYmluZDpmdW5jdGlvbihlLHQpe3JldHVybiB0aGlzLm9mZihlLG51bGwsdCl9LGRlbGVnYXRlOmZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiB0aGlzLm9uKHQsZSxuLHIpfSx1bmRlbGVnYXRlOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gMT09PWFyZ3VtZW50cy5sZW5ndGg/dGhpcy5vZmYoZSxcIioqXCIpOnRoaXMub2ZmKHQsZXx8XCIqKlwiLG4pfSx0cmlnZ2VyOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpe2IuZXZlbnQudHJpZ2dlcihlLHQsdGhpcyl9KX0sdHJpZ2dlckhhbmRsZXI6ZnVuY3Rpb24oZSxuKXt2YXIgcj10aGlzWzBdO3JldHVybiByP2IuZXZlbnQudHJpZ2dlcihlLG4sciwhMCk6dH19KSxmdW5jdGlvbihlLHQpe3ZhciBuLHIsaSxvLGEscyx1LGwsYyxwLGYsZCxoLGcsbSx5LHYseD1cInNpenpsZVwiKy1uZXcgRGF0ZSx3PWUuZG9jdW1lbnQsVD17fSxOPTAsQz0wLGs9aXQoKSxFPWl0KCksUz1pdCgpLEE9dHlwZW9mIHQsaj0xPDwzMSxEPVtdLEw9RC5wb3AsSD1ELnB1c2gscT1ELnNsaWNlLE09RC5pbmRleE9mfHxmdW5jdGlvbihlKXt2YXIgdD0wLG49dGhpcy5sZW5ndGg7Zm9yKDtuPnQ7dCsrKWlmKHRoaXNbdF09PT1lKXJldHVybiB0O3JldHVybi0xfSxfPVwiW1xcXFx4MjBcXFxcdFxcXFxyXFxcXG5cXFxcZl1cIixGPVwiKD86XFxcXFxcXFwufFtcXFxcdy1dfFteXFxcXHgwMC1cXFxceGEwXSkrXCIsTz1GLnJlcGxhY2UoXCJ3XCIsXCJ3I1wiKSxCPVwiKFsqXiR8IX5dPz0pXCIsUD1cIlxcXFxbXCIrXytcIiooXCIrRitcIilcIitfK1wiKig/OlwiK0IrXytcIiooPzooWydcXFwiXSkoKD86XFxcXFxcXFwufFteXFxcXFxcXFxdKSo/KVxcXFwzfChcIitPK1wiKXwpfClcIitfK1wiKlxcXFxdXCIsUj1cIjooXCIrRitcIikoPzpcXFxcKCgoWydcXFwiXSkoKD86XFxcXFxcXFwufFteXFxcXFxcXFxdKSo/KVxcXFwzfCgoPzpcXFxcXFxcXC58W15cXFxcXFxcXCgpW1xcXFxdXXxcIitQLnJlcGxhY2UoMyw4KStcIikqKXwuKilcXFxcKXwpXCIsVz1SZWdFeHAoXCJeXCIrXytcIit8KCg/Ol58W15cXFxcXFxcXF0pKD86XFxcXFxcXFwuKSopXCIrXytcIiskXCIsXCJnXCIpLCQ9UmVnRXhwKFwiXlwiK18rXCIqLFwiK18rXCIqXCIpLEk9UmVnRXhwKFwiXlwiK18rXCIqKFtcXFxceDIwXFxcXHRcXFxcclxcXFxuXFxcXGY+K35dKVwiK18rXCIqXCIpLHo9UmVnRXhwKFIpLFg9UmVnRXhwKFwiXlwiK08rXCIkXCIpLFU9e0lEOlJlZ0V4cChcIl4jKFwiK0YrXCIpXCIpLENMQVNTOlJlZ0V4cChcIl5cXFxcLihcIitGK1wiKVwiKSxOQU1FOlJlZ0V4cChcIl5cXFxcW25hbWU9WydcXFwiXT8oXCIrRitcIilbJ1xcXCJdP1xcXFxdXCIpLFRBRzpSZWdFeHAoXCJeKFwiK0YucmVwbGFjZShcIndcIixcIncqXCIpK1wiKVwiKSxBVFRSOlJlZ0V4cChcIl5cIitQKSxQU0VVRE86UmVnRXhwKFwiXlwiK1IpLENISUxEOlJlZ0V4cChcIl46KG9ubHl8Zmlyc3R8bGFzdHxudGh8bnRoLWxhc3QpLShjaGlsZHxvZi10eXBlKSg/OlxcXFwoXCIrXytcIiooZXZlbnxvZGR8KChbKy1dfCkoXFxcXGQqKW58KVwiK18rXCIqKD86KFsrLV18KVwiK18rXCIqKFxcXFxkKyl8KSlcIitfK1wiKlxcXFwpfClcIixcImlcIiksbmVlZHNDb250ZXh0OlJlZ0V4cChcIl5cIitfK1wiKls+K35dfDooZXZlbnxvZGR8ZXF8Z3R8bHR8bnRofGZpcnN0fGxhc3QpKD86XFxcXChcIitfK1wiKigoPzotXFxcXGQpP1xcXFxkKilcIitfK1wiKlxcXFwpfCkoPz1bXi1dfCQpXCIsXCJpXCIpfSxWPS9bXFx4MjBcXHRcXHJcXG5cXGZdKlsrfl0vLFk9L15bXntdK1xce1xccypcXFtuYXRpdmUgY29kZS8sSj0vXig/OiMoW1xcdy1dKyl8KFxcdyspfFxcLihbXFx3LV0rKSkkLyxHPS9eKD86aW5wdXR8c2VsZWN0fHRleHRhcmVhfGJ1dHRvbikkL2ksUT0vXmhcXGQkL2ksSz0vJ3xcXFxcL2csWj0vXFw9W1xceDIwXFx0XFxyXFxuXFxmXSooW14nXCJcXF1dKilbXFx4MjBcXHRcXHJcXG5cXGZdKlxcXS9nLGV0PS9cXFxcKFtcXGRhLWZBLUZdezEsNn1bXFx4MjBcXHRcXHJcXG5cXGZdP3wuKS9nLHR0PWZ1bmN0aW9uKGUsdCl7dmFyIG49XCIweFwiK3QtNjU1MzY7cmV0dXJuIG4hPT1uP3Q6MD5uP1N0cmluZy5mcm9tQ2hhckNvZGUobis2NTUzNik6U3RyaW5nLmZyb21DaGFyQ29kZSg1NTI5NnxuPj4xMCw1NjMyMHwxMDIzJm4pfTt0cnl7cS5jYWxsKHcuZG9jdW1lbnRFbGVtZW50LmNoaWxkTm9kZXMsMClbMF0ubm9kZVR5cGV9Y2F0Y2gobnQpe3E9ZnVuY3Rpb24oZSl7dmFyIHQsbj1bXTt3aGlsZSh0PXRoaXNbZSsrXSluLnB1c2godCk7cmV0dXJuIG59fWZ1bmN0aW9uIHJ0KGUpe3JldHVybiBZLnRlc3QoZStcIlwiKX1mdW5jdGlvbiBpdCgpe3ZhciBlLHQ9W107cmV0dXJuIGU9ZnVuY3Rpb24obixyKXtyZXR1cm4gdC5wdXNoKG4rPVwiIFwiKT5pLmNhY2hlTGVuZ3RoJiZkZWxldGUgZVt0LnNoaWZ0KCldLGVbbl09cn19ZnVuY3Rpb24gb3QoZSl7cmV0dXJuIGVbeF09ITAsZX1mdW5jdGlvbiBhdChlKXt2YXIgdD1wLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7dHJ5e3JldHVybiBlKHQpfWNhdGNoKG4pe3JldHVybiExfWZpbmFsbHl7dD1udWxsfX1mdW5jdGlvbiBzdChlLHQsbixyKXt2YXIgaSxvLGEscyx1LGwsZixnLG0sdjtpZigodD90Lm93bmVyRG9jdW1lbnR8fHQ6dykhPT1wJiZjKHQpLHQ9dHx8cCxuPW58fFtdLCFlfHxcInN0cmluZ1wiIT10eXBlb2YgZSlyZXR1cm4gbjtpZigxIT09KHM9dC5ub2RlVHlwZSkmJjkhPT1zKXJldHVybltdO2lmKCFkJiYhcil7aWYoaT1KLmV4ZWMoZSkpaWYoYT1pWzFdKXtpZig5PT09cyl7aWYobz10LmdldEVsZW1lbnRCeUlkKGEpLCFvfHwhby5wYXJlbnROb2RlKXJldHVybiBuO2lmKG8uaWQ9PT1hKXJldHVybiBuLnB1c2gobyksbn1lbHNlIGlmKHQub3duZXJEb2N1bWVudCYmKG89dC5vd25lckRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGEpKSYmeSh0LG8pJiZvLmlkPT09YSlyZXR1cm4gbi5wdXNoKG8pLG59ZWxzZXtpZihpWzJdKXJldHVybiBILmFwcGx5KG4scS5jYWxsKHQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoZSksMCkpLG47aWYoKGE9aVszXSkmJlQuZ2V0QnlDbGFzc05hbWUmJnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSlyZXR1cm4gSC5hcHBseShuLHEuY2FsbCh0LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoYSksMCkpLG59aWYoVC5xc2EmJiFoLnRlc3QoZSkpe2lmKGY9ITAsZz14LG09dCx2PTk9PT1zJiZlLDE9PT1zJiZcIm9iamVjdFwiIT09dC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKXtsPWZ0KGUpLChmPXQuZ2V0QXR0cmlidXRlKFwiaWRcIikpP2c9Zi5yZXBsYWNlKEssXCJcXFxcJCZcIik6dC5zZXRBdHRyaWJ1dGUoXCJpZFwiLGcpLGc9XCJbaWQ9J1wiK2crXCInXSBcIix1PWwubGVuZ3RoO3doaWxlKHUtLSlsW3VdPWcrZHQobFt1XSk7bT1WLnRlc3QoZSkmJnQucGFyZW50Tm9kZXx8dCx2PWwuam9pbihcIixcIil9aWYodil0cnl7cmV0dXJuIEguYXBwbHkobixxLmNhbGwobS5xdWVyeVNlbGVjdG9yQWxsKHYpLDApKSxufWNhdGNoKGIpe31maW5hbGx5e2Z8fHQucmVtb3ZlQXR0cmlidXRlKFwiaWRcIil9fX1yZXR1cm4gd3QoZS5yZXBsYWNlKFcsXCIkMVwiKSx0LG4scil9YT1zdC5pc1hNTD1mdW5jdGlvbihlKXt2YXIgdD1lJiYoZS5vd25lckRvY3VtZW50fHxlKS5kb2N1bWVudEVsZW1lbnQ7cmV0dXJuIHQ/XCJIVE1MXCIhPT10Lm5vZGVOYW1lOiExfSxjPXN0LnNldERvY3VtZW50PWZ1bmN0aW9uKGUpe3ZhciBuPWU/ZS5vd25lckRvY3VtZW50fHxlOnc7cmV0dXJuIG4hPT1wJiY5PT09bi5ub2RlVHlwZSYmbi5kb2N1bWVudEVsZW1lbnQ/KHA9bixmPW4uZG9jdW1lbnRFbGVtZW50LGQ9YShuKSxULnRhZ05hbWVOb0NvbW1lbnRzPWF0KGZ1bmN0aW9uKGUpe3JldHVybiBlLmFwcGVuZENoaWxkKG4uY3JlYXRlQ29tbWVudChcIlwiKSksIWUuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCIqXCIpLmxlbmd0aH0pLFQuYXR0cmlidXRlcz1hdChmdW5jdGlvbihlKXtlLmlubmVySFRNTD1cIjxzZWxlY3Q+PC9zZWxlY3Q+XCI7dmFyIHQ9dHlwZW9mIGUubGFzdENoaWxkLmdldEF0dHJpYnV0ZShcIm11bHRpcGxlXCIpO3JldHVyblwiYm9vbGVhblwiIT09dCYmXCJzdHJpbmdcIiE9PXR9KSxULmdldEJ5Q2xhc3NOYW1lPWF0KGZ1bmN0aW9uKGUpe3JldHVybiBlLmlubmVySFRNTD1cIjxkaXYgY2xhc3M9J2hpZGRlbiBlJz48L2Rpdj48ZGl2IGNsYXNzPSdoaWRkZW4nPjwvZGl2PlwiLGUuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSYmZS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZVwiKS5sZW5ndGg/KGUubGFzdENoaWxkLmNsYXNzTmFtZT1cImVcIiwyPT09ZS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwiZVwiKS5sZW5ndGgpOiExfSksVC5nZXRCeU5hbWU9YXQoZnVuY3Rpb24oZSl7ZS5pZD14KzAsZS5pbm5lckhUTUw9XCI8YSBuYW1lPSdcIit4K1wiJz48L2E+PGRpdiBuYW1lPSdcIit4K1wiJz48L2Rpdj5cIixmLmluc2VydEJlZm9yZShlLGYuZmlyc3RDaGlsZCk7dmFyIHQ9bi5nZXRFbGVtZW50c0J5TmFtZSYmbi5nZXRFbGVtZW50c0J5TmFtZSh4KS5sZW5ndGg9PT0yK24uZ2V0RWxlbWVudHNCeU5hbWUoeCswKS5sZW5ndGg7cmV0dXJuIFQuZ2V0SWROb3ROYW1lPSFuLmdldEVsZW1lbnRCeUlkKHgpLGYucmVtb3ZlQ2hpbGQoZSksdH0pLGkuYXR0ckhhbmRsZT1hdChmdW5jdGlvbihlKXtyZXR1cm4gZS5pbm5lckhUTUw9XCI8YSBocmVmPScjJz48L2E+XCIsZS5maXJzdENoaWxkJiZ0eXBlb2YgZS5maXJzdENoaWxkLmdldEF0dHJpYnV0ZSE9PUEmJlwiI1wiPT09ZS5maXJzdENoaWxkLmdldEF0dHJpYnV0ZShcImhyZWZcIil9KT97fTp7aHJlZjpmdW5jdGlvbihlKXtyZXR1cm4gZS5nZXRBdHRyaWJ1dGUoXCJocmVmXCIsMil9LHR5cGU6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuZ2V0QXR0cmlidXRlKFwidHlwZVwiKX19LFQuZ2V0SWROb3ROYW1lPyhpLmZpbmQuSUQ9ZnVuY3Rpb24oZSx0KXtpZih0eXBlb2YgdC5nZXRFbGVtZW50QnlJZCE9PUEmJiFkKXt2YXIgbj10LmdldEVsZW1lbnRCeUlkKGUpO3JldHVybiBuJiZuLnBhcmVudE5vZGU/W25dOltdfX0saS5maWx0ZXIuSUQ9ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5yZXBsYWNlKGV0LHR0KTtyZXR1cm4gZnVuY3Rpb24oZSl7cmV0dXJuIGUuZ2V0QXR0cmlidXRlKFwiaWRcIik9PT10fX0pOihpLmZpbmQuSUQ9ZnVuY3Rpb24oZSxuKXtpZih0eXBlb2Ygbi5nZXRFbGVtZW50QnlJZCE9PUEmJiFkKXt2YXIgcj1uLmdldEVsZW1lbnRCeUlkKGUpO3JldHVybiByP3IuaWQ9PT1lfHx0eXBlb2Ygci5nZXRBdHRyaWJ1dGVOb2RlIT09QSYmci5nZXRBdHRyaWJ1dGVOb2RlKFwiaWRcIikudmFsdWU9PT1lP1tyXTp0OltdfX0saS5maWx0ZXIuSUQ9ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5yZXBsYWNlKGV0LHR0KTtyZXR1cm4gZnVuY3Rpb24oZSl7dmFyIG49dHlwZW9mIGUuZ2V0QXR0cmlidXRlTm9kZSE9PUEmJmUuZ2V0QXR0cmlidXRlTm9kZShcImlkXCIpO3JldHVybiBuJiZuLnZhbHVlPT09dH19KSxpLmZpbmQuVEFHPVQudGFnTmFtZU5vQ29tbWVudHM/ZnVuY3Rpb24oZSxuKXtyZXR1cm4gdHlwZW9mIG4uZ2V0RWxlbWVudHNCeVRhZ05hbWUhPT1BP24uZ2V0RWxlbWVudHNCeVRhZ05hbWUoZSk6dH06ZnVuY3Rpb24oZSx0KXt2YXIgbixyPVtdLGk9MCxvPXQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoZSk7aWYoXCIqXCI9PT1lKXt3aGlsZShuPW9baSsrXSkxPT09bi5ub2RlVHlwZSYmci5wdXNoKG4pO3JldHVybiByfXJldHVybiBvfSxpLmZpbmQuTkFNRT1ULmdldEJ5TmFtZSYmZnVuY3Rpb24oZSxuKXtyZXR1cm4gdHlwZW9mIG4uZ2V0RWxlbWVudHNCeU5hbWUhPT1BP24uZ2V0RWxlbWVudHNCeU5hbWUobmFtZSk6dH0saS5maW5kLkNMQVNTPVQuZ2V0QnlDbGFzc05hbWUmJmZ1bmN0aW9uKGUsbil7cmV0dXJuIHR5cGVvZiBuLmdldEVsZW1lbnRzQnlDbGFzc05hbWU9PT1BfHxkP3Q6bi5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKGUpfSxnPVtdLGg9W1wiOmZvY3VzXCJdLChULnFzYT1ydChuLnF1ZXJ5U2VsZWN0b3JBbGwpKSYmKGF0KGZ1bmN0aW9uKGUpe2UuaW5uZXJIVE1MPVwiPHNlbGVjdD48b3B0aW9uIHNlbGVjdGVkPScnPjwvb3B0aW9uPjwvc2VsZWN0PlwiLGUucXVlcnlTZWxlY3RvckFsbChcIltzZWxlY3RlZF1cIikubGVuZ3RofHxoLnB1c2goXCJcXFxcW1wiK18rXCIqKD86Y2hlY2tlZHxkaXNhYmxlZHxpc21hcHxtdWx0aXBsZXxyZWFkb25seXxzZWxlY3RlZHx2YWx1ZSlcIiksZS5xdWVyeVNlbGVjdG9yQWxsKFwiOmNoZWNrZWRcIikubGVuZ3RofHxoLnB1c2goXCI6Y2hlY2tlZFwiKX0pLGF0KGZ1bmN0aW9uKGUpe2UuaW5uZXJIVE1MPVwiPGlucHV0IHR5cGU9J2hpZGRlbicgaT0nJy8+XCIsZS5xdWVyeVNlbGVjdG9yQWxsKFwiW2lePScnXVwiKS5sZW5ndGgmJmgucHVzaChcIlsqXiRdPVwiK18rXCIqKD86XFxcIlxcXCJ8JycpXCIpLGUucXVlcnlTZWxlY3RvckFsbChcIjplbmFibGVkXCIpLmxlbmd0aHx8aC5wdXNoKFwiOmVuYWJsZWRcIixcIjpkaXNhYmxlZFwiKSxlLnF1ZXJ5U2VsZWN0b3JBbGwoXCIqLDp4XCIpLGgucHVzaChcIiwuKjpcIil9KSksKFQubWF0Y2hlc1NlbGVjdG9yPXJ0KG09Zi5tYXRjaGVzU2VsZWN0b3J8fGYubW96TWF0Y2hlc1NlbGVjdG9yfHxmLndlYmtpdE1hdGNoZXNTZWxlY3Rvcnx8Zi5vTWF0Y2hlc1NlbGVjdG9yfHxmLm1zTWF0Y2hlc1NlbGVjdG9yKSkmJmF0KGZ1bmN0aW9uKGUpe1QuZGlzY29ubmVjdGVkTWF0Y2g9bS5jYWxsKGUsXCJkaXZcIiksbS5jYWxsKGUsXCJbcyE9JyddOnhcIiksZy5wdXNoKFwiIT1cIixSKX0pLGg9UmVnRXhwKGguam9pbihcInxcIikpLGc9UmVnRXhwKGcuam9pbihcInxcIikpLHk9cnQoZi5jb250YWlucyl8fGYuY29tcGFyZURvY3VtZW50UG9zaXRpb24/ZnVuY3Rpb24oZSx0KXt2YXIgbj05PT09ZS5ub2RlVHlwZT9lLmRvY3VtZW50RWxlbWVudDplLHI9dCYmdC5wYXJlbnROb2RlO3JldHVybiBlPT09cnx8ISghcnx8MSE9PXIubm9kZVR5cGV8fCEobi5jb250YWlucz9uLmNvbnRhaW5zKHIpOmUuY29tcGFyZURvY3VtZW50UG9zaXRpb24mJjE2JmUuY29tcGFyZURvY3VtZW50UG9zaXRpb24ocikpKX06ZnVuY3Rpb24oZSx0KXtpZih0KXdoaWxlKHQ9dC5wYXJlbnROb2RlKWlmKHQ9PT1lKXJldHVybiEwO3JldHVybiExfSx2PWYuY29tcGFyZURvY3VtZW50UG9zaXRpb24/ZnVuY3Rpb24oZSx0KXt2YXIgcjtyZXR1cm4gZT09PXQ/KHU9ITAsMCk6KHI9dC5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbiYmZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbiYmZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbih0KSk/MSZyfHxlLnBhcmVudE5vZGUmJjExPT09ZS5wYXJlbnROb2RlLm5vZGVUeXBlP2U9PT1ufHx5KHcsZSk/LTE6dD09PW58fHkodyx0KT8xOjA6NCZyPy0xOjE6ZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbj8tMToxfTpmdW5jdGlvbihlLHQpe3ZhciByLGk9MCxvPWUucGFyZW50Tm9kZSxhPXQucGFyZW50Tm9kZSxzPVtlXSxsPVt0XTtpZihlPT09dClyZXR1cm4gdT0hMCwwO2lmKCFvfHwhYSlyZXR1cm4gZT09PW4/LTE6dD09PW4/MTpvPy0xOmE/MTowO2lmKG89PT1hKXJldHVybiB1dChlLHQpO3I9ZTt3aGlsZShyPXIucGFyZW50Tm9kZSlzLnVuc2hpZnQocik7cj10O3doaWxlKHI9ci5wYXJlbnROb2RlKWwudW5zaGlmdChyKTt3aGlsZShzW2ldPT09bFtpXSlpKys7cmV0dXJuIGk/dXQoc1tpXSxsW2ldKTpzW2ldPT09dz8tMTpsW2ldPT09dz8xOjB9LHU9ITEsWzAsMF0uc29ydCh2KSxULmRldGVjdER1cGxpY2F0ZXM9dSxwKTpwfSxzdC5tYXRjaGVzPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIHN0KGUsbnVsbCxudWxsLHQpfSxzdC5tYXRjaGVzU2VsZWN0b3I9ZnVuY3Rpb24oZSx0KXtpZigoZS5vd25lckRvY3VtZW50fHxlKSE9PXAmJmMoZSksdD10LnJlcGxhY2UoWixcIj0nJDEnXVwiKSwhKCFULm1hdGNoZXNTZWxlY3Rvcnx8ZHx8ZyYmZy50ZXN0KHQpfHxoLnRlc3QodCkpKXRyeXt2YXIgbj1tLmNhbGwoZSx0KTtpZihufHxULmRpc2Nvbm5lY3RlZE1hdGNofHxlLmRvY3VtZW50JiYxMSE9PWUuZG9jdW1lbnQubm9kZVR5cGUpcmV0dXJuIG59Y2F0Y2gocil7fXJldHVybiBzdCh0LHAsbnVsbCxbZV0pLmxlbmd0aD4wfSxzdC5jb250YWlucz1mdW5jdGlvbihlLHQpe3JldHVybihlLm93bmVyRG9jdW1lbnR8fGUpIT09cCYmYyhlKSx5KGUsdCl9LHN0LmF0dHI9ZnVuY3Rpb24oZSx0KXt2YXIgbjtyZXR1cm4oZS5vd25lckRvY3VtZW50fHxlKSE9PXAmJmMoZSksZHx8KHQ9dC50b0xvd2VyQ2FzZSgpKSwobj1pLmF0dHJIYW5kbGVbdF0pP24oZSk6ZHx8VC5hdHRyaWJ1dGVzP2UuZ2V0QXR0cmlidXRlKHQpOigobj1lLmdldEF0dHJpYnV0ZU5vZGUodCkpfHxlLmdldEF0dHJpYnV0ZSh0KSkmJmVbdF09PT0hMD90Om4mJm4uc3BlY2lmaWVkP24udmFsdWU6bnVsbH0sc3QuZXJyb3I9ZnVuY3Rpb24oZSl7dGhyb3cgRXJyb3IoXCJTeW50YXggZXJyb3IsIHVucmVjb2duaXplZCBleHByZXNzaW9uOiBcIitlKX0sc3QudW5pcXVlU29ydD1mdW5jdGlvbihlKXt2YXIgdCxuPVtdLHI9MSxpPTA7aWYodT0hVC5kZXRlY3REdXBsaWNhdGVzLGUuc29ydCh2KSx1KXtmb3IoO3Q9ZVtyXTtyKyspdD09PWVbci0xXSYmKGk9bi5wdXNoKHIpKTt3aGlsZShpLS0pZS5zcGxpY2UobltpXSwxKX1yZXR1cm4gZX07ZnVuY3Rpb24gdXQoZSx0KXt2YXIgbj10JiZlLHI9biYmKH50LnNvdXJjZUluZGV4fHxqKS0ofmUuc291cmNlSW5kZXh8fGopO2lmKHIpcmV0dXJuIHI7aWYobil3aGlsZShuPW4ubmV4dFNpYmxpbmcpaWYobj09PXQpcmV0dXJuLTE7cmV0dXJuIGU/MTotMX1mdW5jdGlvbiBsdChlKXtyZXR1cm4gZnVuY3Rpb24odCl7dmFyIG49dC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO3JldHVyblwiaW5wdXRcIj09PW4mJnQudHlwZT09PWV9fWZ1bmN0aW9uIGN0KGUpe3JldHVybiBmdW5jdGlvbih0KXt2YXIgbj10Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7cmV0dXJuKFwiaW5wdXRcIj09PW58fFwiYnV0dG9uXCI9PT1uKSYmdC50eXBlPT09ZX19ZnVuY3Rpb24gcHQoZSl7cmV0dXJuIG90KGZ1bmN0aW9uKHQpe3JldHVybiB0PSt0LG90KGZ1bmN0aW9uKG4scil7dmFyIGksbz1lKFtdLG4ubGVuZ3RoLHQpLGE9by5sZW5ndGg7d2hpbGUoYS0tKW5baT1vW2FdXSYmKG5baV09IShyW2ldPW5baV0pKX0pfSl9bz1zdC5nZXRUZXh0PWZ1bmN0aW9uKGUpe3ZhciB0LG49XCJcIixyPTAsaT1lLm5vZGVUeXBlO2lmKGkpe2lmKDE9PT1pfHw5PT09aXx8MTE9PT1pKXtpZihcInN0cmluZ1wiPT10eXBlb2YgZS50ZXh0Q29udGVudClyZXR1cm4gZS50ZXh0Q29udGVudDtmb3IoZT1lLmZpcnN0Q2hpbGQ7ZTtlPWUubmV4dFNpYmxpbmcpbis9byhlKX1lbHNlIGlmKDM9PT1pfHw0PT09aSlyZXR1cm4gZS5ub2RlVmFsdWV9ZWxzZSBmb3IoO3Q9ZVtyXTtyKyspbis9byh0KTtyZXR1cm4gbn0saT1zdC5zZWxlY3RvcnM9e2NhY2hlTGVuZ3RoOjUwLGNyZWF0ZVBzZXVkbzpvdCxtYXRjaDpVLGZpbmQ6e30scmVsYXRpdmU6e1wiPlwiOntkaXI6XCJwYXJlbnROb2RlXCIsZmlyc3Q6ITB9LFwiIFwiOntkaXI6XCJwYXJlbnROb2RlXCJ9LFwiK1wiOntkaXI6XCJwcmV2aW91c1NpYmxpbmdcIixmaXJzdDohMH0sXCJ+XCI6e2RpcjpcInByZXZpb3VzU2libGluZ1wifX0scHJlRmlsdGVyOntBVFRSOmZ1bmN0aW9uKGUpe3JldHVybiBlWzFdPWVbMV0ucmVwbGFjZShldCx0dCksZVszXT0oZVs0XXx8ZVs1XXx8XCJcIikucmVwbGFjZShldCx0dCksXCJ+PVwiPT09ZVsyXSYmKGVbM109XCIgXCIrZVszXStcIiBcIiksZS5zbGljZSgwLDQpfSxDSElMRDpmdW5jdGlvbihlKXtyZXR1cm4gZVsxXT1lWzFdLnRvTG93ZXJDYXNlKCksXCJudGhcIj09PWVbMV0uc2xpY2UoMCwzKT8oZVszXXx8c3QuZXJyb3IoZVswXSksZVs0XT0rKGVbNF0/ZVs1XSsoZVs2XXx8MSk6MiooXCJldmVuXCI9PT1lWzNdfHxcIm9kZFwiPT09ZVszXSkpLGVbNV09KyhlWzddK2VbOF18fFwib2RkXCI9PT1lWzNdKSk6ZVszXSYmc3QuZXJyb3IoZVswXSksZX0sUFNFVURPOmZ1bmN0aW9uKGUpe3ZhciB0LG49IWVbNV0mJmVbMl07cmV0dXJuIFUuQ0hJTEQudGVzdChlWzBdKT9udWxsOihlWzRdP2VbMl09ZVs0XTpuJiZ6LnRlc3QobikmJih0PWZ0KG4sITApKSYmKHQ9bi5pbmRleE9mKFwiKVwiLG4ubGVuZ3RoLXQpLW4ubGVuZ3RoKSYmKGVbMF09ZVswXS5zbGljZSgwLHQpLGVbMl09bi5zbGljZSgwLHQpKSxlLnNsaWNlKDAsMykpfX0sZmlsdGVyOntUQUc6ZnVuY3Rpb24oZSl7cmV0dXJuXCIqXCI9PT1lP2Z1bmN0aW9uKCl7cmV0dXJuITB9OihlPWUucmVwbGFjZShldCx0dCkudG9Mb3dlckNhc2UoKSxmdW5jdGlvbih0KXtyZXR1cm4gdC5ub2RlTmFtZSYmdC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09ZX0pfSxDTEFTUzpmdW5jdGlvbihlKXt2YXIgdD1rW2UrXCIgXCJdO3JldHVybiB0fHwodD1SZWdFeHAoXCIoXnxcIitfK1wiKVwiK2UrXCIoXCIrXytcInwkKVwiKSkmJmsoZSxmdW5jdGlvbihlKXtyZXR1cm4gdC50ZXN0KGUuY2xhc3NOYW1lfHx0eXBlb2YgZS5nZXRBdHRyaWJ1dGUhPT1BJiZlLmdldEF0dHJpYnV0ZShcImNsYXNzXCIpfHxcIlwiKX0pfSxBVFRSOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gZnVuY3Rpb24ocil7dmFyIGk9c3QuYXR0cihyLGUpO3JldHVybiBudWxsPT1pP1wiIT1cIj09PXQ6dD8oaSs9XCJcIixcIj1cIj09PXQ/aT09PW46XCIhPVwiPT09dD9pIT09bjpcIl49XCI9PT10P24mJjA9PT1pLmluZGV4T2Yobik6XCIqPVwiPT09dD9uJiZpLmluZGV4T2Yobik+LTE6XCIkPVwiPT09dD9uJiZpLnNsaWNlKC1uLmxlbmd0aCk9PT1uOlwifj1cIj09PXQ/KFwiIFwiK2krXCIgXCIpLmluZGV4T2Yobik+LTE6XCJ8PVwiPT09dD9pPT09bnx8aS5zbGljZSgwLG4ubGVuZ3RoKzEpPT09bitcIi1cIjohMSk6ITB9fSxDSElMRDpmdW5jdGlvbihlLHQsbixyLGkpe3ZhciBvPVwibnRoXCIhPT1lLnNsaWNlKDAsMyksYT1cImxhc3RcIiE9PWUuc2xpY2UoLTQpLHM9XCJvZi10eXBlXCI9PT10O3JldHVybiAxPT09ciYmMD09PWk/ZnVuY3Rpb24oZSl7cmV0dXJuISFlLnBhcmVudE5vZGV9OmZ1bmN0aW9uKHQsbix1KXt2YXIgbCxjLHAsZixkLGgsZz1vIT09YT9cIm5leHRTaWJsaW5nXCI6XCJwcmV2aW91c1NpYmxpbmdcIixtPXQucGFyZW50Tm9kZSx5PXMmJnQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSx2PSF1JiYhcztpZihtKXtpZihvKXt3aGlsZShnKXtwPXQ7d2hpbGUocD1wW2ddKWlmKHM/cC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09eToxPT09cC5ub2RlVHlwZSlyZXR1cm4hMTtoPWc9XCJvbmx5XCI9PT1lJiYhaCYmXCJuZXh0U2libGluZ1wifXJldHVybiEwfWlmKGg9W2E/bS5maXJzdENoaWxkOm0ubGFzdENoaWxkXSxhJiZ2KXtjPW1beF18fChtW3hdPXt9KSxsPWNbZV18fFtdLGQ9bFswXT09PU4mJmxbMV0sZj1sWzBdPT09TiYmbFsyXSxwPWQmJm0uY2hpbGROb2Rlc1tkXTt3aGlsZShwPSsrZCYmcCYmcFtnXXx8KGY9ZD0wKXx8aC5wb3AoKSlpZigxPT09cC5ub2RlVHlwZSYmKytmJiZwPT09dCl7Y1tlXT1bTixkLGZdO2JyZWFrfX1lbHNlIGlmKHYmJihsPSh0W3hdfHwodFt4XT17fSkpW2VdKSYmbFswXT09PU4pZj1sWzFdO2Vsc2Ugd2hpbGUocD0rK2QmJnAmJnBbZ118fChmPWQ9MCl8fGgucG9wKCkpaWYoKHM/cC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09eToxPT09cC5ub2RlVHlwZSkmJisrZiYmKHYmJigocFt4XXx8KHBbeF09e30pKVtlXT1bTixmXSkscD09PXQpKWJyZWFrO3JldHVybiBmLT1pLGY9PT1yfHwwPT09ZiVyJiZmL3I+PTB9fX0sUFNFVURPOmZ1bmN0aW9uKGUsdCl7dmFyIG4scj1pLnBzZXVkb3NbZV18fGkuc2V0RmlsdGVyc1tlLnRvTG93ZXJDYXNlKCldfHxzdC5lcnJvcihcInVuc3VwcG9ydGVkIHBzZXVkbzogXCIrZSk7cmV0dXJuIHJbeF0/cih0KTpyLmxlbmd0aD4xPyhuPVtlLGUsXCJcIix0XSxpLnNldEZpbHRlcnMuaGFzT3duUHJvcGVydHkoZS50b0xvd2VyQ2FzZSgpKT9vdChmdW5jdGlvbihlLG4pe3ZhciBpLG89cihlLHQpLGE9by5sZW5ndGg7d2hpbGUoYS0tKWk9TS5jYWxsKGUsb1thXSksZVtpXT0hKG5baV09b1thXSl9KTpmdW5jdGlvbihlKXtyZXR1cm4gcihlLDAsbil9KTpyfX0scHNldWRvczp7bm90Om90KGZ1bmN0aW9uKGUpe3ZhciB0PVtdLG49W10scj1zKGUucmVwbGFjZShXLFwiJDFcIikpO3JldHVybiByW3hdP290KGZ1bmN0aW9uKGUsdCxuLGkpe3ZhciBvLGE9cihlLG51bGwsaSxbXSkscz1lLmxlbmd0aDt3aGlsZShzLS0pKG89YVtzXSkmJihlW3NdPSEodFtzXT1vKSl9KTpmdW5jdGlvbihlLGksbyl7cmV0dXJuIHRbMF09ZSxyKHQsbnVsbCxvLG4pLCFuLnBvcCgpfX0pLGhhczpvdChmdW5jdGlvbihlKXtyZXR1cm4gZnVuY3Rpb24odCl7cmV0dXJuIHN0KGUsdCkubGVuZ3RoPjB9fSksY29udGFpbnM6b3QoZnVuY3Rpb24oZSl7cmV0dXJuIGZ1bmN0aW9uKHQpe3JldHVybih0LnRleHRDb250ZW50fHx0LmlubmVyVGV4dHx8byh0KSkuaW5kZXhPZihlKT4tMX19KSxsYW5nOm90KGZ1bmN0aW9uKGUpe3JldHVybiBYLnRlc3QoZXx8XCJcIil8fHN0LmVycm9yKFwidW5zdXBwb3J0ZWQgbGFuZzogXCIrZSksZT1lLnJlcGxhY2UoZXQsdHQpLnRvTG93ZXJDYXNlKCksZnVuY3Rpb24odCl7dmFyIG47ZG8gaWYobj1kP3QuZ2V0QXR0cmlidXRlKFwieG1sOmxhbmdcIil8fHQuZ2V0QXR0cmlidXRlKFwibGFuZ1wiKTp0LmxhbmcpcmV0dXJuIG49bi50b0xvd2VyQ2FzZSgpLG49PT1lfHwwPT09bi5pbmRleE9mKGUrXCItXCIpO3doaWxlKCh0PXQucGFyZW50Tm9kZSkmJjE9PT10Lm5vZGVUeXBlKTtyZXR1cm4hMX19KSx0YXJnZXQ6ZnVuY3Rpb24odCl7dmFyIG49ZS5sb2NhdGlvbiYmZS5sb2NhdGlvbi5oYXNoO3JldHVybiBuJiZuLnNsaWNlKDEpPT09dC5pZH0scm9vdDpmdW5jdGlvbihlKXtyZXR1cm4gZT09PWZ9LGZvY3VzOmZ1bmN0aW9uKGUpe3JldHVybiBlPT09cC5hY3RpdmVFbGVtZW50JiYoIXAuaGFzRm9jdXN8fHAuaGFzRm9jdXMoKSkmJiEhKGUudHlwZXx8ZS5ocmVmfHx+ZS50YWJJbmRleCl9LGVuYWJsZWQ6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuZGlzYWJsZWQ9PT0hMX0sZGlzYWJsZWQ6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuZGlzYWJsZWQ9PT0hMH0sY2hlY2tlZDpmdW5jdGlvbihlKXt2YXIgdD1lLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7cmV0dXJuXCJpbnB1dFwiPT09dCYmISFlLmNoZWNrZWR8fFwib3B0aW9uXCI9PT10JiYhIWUuc2VsZWN0ZWR9LHNlbGVjdGVkOmZ1bmN0aW9uKGUpe3JldHVybiBlLnBhcmVudE5vZGUmJmUucGFyZW50Tm9kZS5zZWxlY3RlZEluZGV4LGUuc2VsZWN0ZWQ9PT0hMH0sZW1wdHk6ZnVuY3Rpb24oZSl7Zm9yKGU9ZS5maXJzdENoaWxkO2U7ZT1lLm5leHRTaWJsaW5nKWlmKGUubm9kZU5hbWU+XCJAXCJ8fDM9PT1lLm5vZGVUeXBlfHw0PT09ZS5ub2RlVHlwZSlyZXR1cm4hMTtyZXR1cm4hMH0scGFyZW50OmZ1bmN0aW9uKGUpe3JldHVybiFpLnBzZXVkb3MuZW1wdHkoZSl9LGhlYWRlcjpmdW5jdGlvbihlKXtyZXR1cm4gUS50ZXN0KGUubm9kZU5hbWUpfSxpbnB1dDpmdW5jdGlvbihlKXtyZXR1cm4gRy50ZXN0KGUubm9kZU5hbWUpfSxidXR0b246ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO3JldHVyblwiaW5wdXRcIj09PXQmJlwiYnV0dG9uXCI9PT1lLnR5cGV8fFwiYnV0dG9uXCI9PT10fSx0ZXh0OmZ1bmN0aW9uKGUpe3ZhciB0O3JldHVyblwiaW5wdXRcIj09PWUubm9kZU5hbWUudG9Mb3dlckNhc2UoKSYmXCJ0ZXh0XCI9PT1lLnR5cGUmJihudWxsPT0odD1lLmdldEF0dHJpYnV0ZShcInR5cGVcIikpfHx0LnRvTG93ZXJDYXNlKCk9PT1lLnR5cGUpfSxmaXJzdDpwdChmdW5jdGlvbigpe3JldHVyblswXX0pLGxhc3Q6cHQoZnVuY3Rpb24oZSx0KXtyZXR1cm5bdC0xXX0pLGVxOnB0KGZ1bmN0aW9uKGUsdCxuKXtyZXR1cm5bMD5uP24rdDpuXX0pLGV2ZW46cHQoZnVuY3Rpb24oZSx0KXt2YXIgbj0wO2Zvcig7dD5uO24rPTIpZS5wdXNoKG4pO3JldHVybiBlfSksb2RkOnB0KGZ1bmN0aW9uKGUsdCl7dmFyIG49MTtmb3IoO3Q+bjtuKz0yKWUucHVzaChuKTtyZXR1cm4gZX0pLGx0OnB0KGZ1bmN0aW9uKGUsdCxuKXt2YXIgcj0wPm4/bit0Om47Zm9yKDstLXI+PTA7KWUucHVzaChyKTtyZXR1cm4gZX0pLGd0OnB0KGZ1bmN0aW9uKGUsdCxuKXt2YXIgcj0wPm4/bit0Om47Zm9yKDt0PisrcjspZS5wdXNoKHIpO3JldHVybiBlfSl9fTtmb3IobiBpbntyYWRpbzohMCxjaGVja2JveDohMCxmaWxlOiEwLHBhc3N3b3JkOiEwLGltYWdlOiEwfSlpLnBzZXVkb3Nbbl09bHQobik7Zm9yKG4gaW57c3VibWl0OiEwLHJlc2V0OiEwfSlpLnBzZXVkb3Nbbl09Y3Qobik7ZnVuY3Rpb24gZnQoZSx0KXt2YXIgbixyLG8sYSxzLHUsbCxjPUVbZStcIiBcIl07aWYoYylyZXR1cm4gdD8wOmMuc2xpY2UoMCk7cz1lLHU9W10sbD1pLnByZUZpbHRlcjt3aGlsZShzKXsoIW58fChyPSQuZXhlYyhzKSkpJiYociYmKHM9cy5zbGljZShyWzBdLmxlbmd0aCl8fHMpLHUucHVzaChvPVtdKSksbj0hMSwocj1JLmV4ZWMocykpJiYobj1yLnNoaWZ0KCksby5wdXNoKHt2YWx1ZTpuLHR5cGU6clswXS5yZXBsYWNlKFcsXCIgXCIpfSkscz1zLnNsaWNlKG4ubGVuZ3RoKSk7Zm9yKGEgaW4gaS5maWx0ZXIpIShyPVVbYV0uZXhlYyhzKSl8fGxbYV0mJiEocj1sW2FdKHIpKXx8KG49ci5zaGlmdCgpLG8ucHVzaCh7dmFsdWU6bix0eXBlOmEsbWF0Y2hlczpyfSkscz1zLnNsaWNlKG4ubGVuZ3RoKSk7aWYoIW4pYnJlYWt9cmV0dXJuIHQ/cy5sZW5ndGg6cz9zdC5lcnJvcihlKTpFKGUsdSkuc2xpY2UoMCl9ZnVuY3Rpb24gZHQoZSl7dmFyIHQ9MCxuPWUubGVuZ3RoLHI9XCJcIjtmb3IoO24+dDt0Kyspcis9ZVt0XS52YWx1ZTtyZXR1cm4gcn1mdW5jdGlvbiBodChlLHQsbil7dmFyIGk9dC5kaXIsbz1uJiZcInBhcmVudE5vZGVcIj09PWksYT1DKys7cmV0dXJuIHQuZmlyc3Q/ZnVuY3Rpb24odCxuLHIpe3doaWxlKHQ9dFtpXSlpZigxPT09dC5ub2RlVHlwZXx8bylyZXR1cm4gZSh0LG4scil9OmZ1bmN0aW9uKHQsbixzKXt2YXIgdSxsLGMscD1OK1wiIFwiK2E7aWYocyl7d2hpbGUodD10W2ldKWlmKCgxPT09dC5ub2RlVHlwZXx8bykmJmUodCxuLHMpKXJldHVybiEwfWVsc2Ugd2hpbGUodD10W2ldKWlmKDE9PT10Lm5vZGVUeXBlfHxvKWlmKGM9dFt4XXx8KHRbeF09e30pLChsPWNbaV0pJiZsWzBdPT09cCl7aWYoKHU9bFsxXSk9PT0hMHx8dT09PXIpcmV0dXJuIHU9PT0hMH1lbHNlIGlmKGw9Y1tpXT1bcF0sbFsxXT1lKHQsbixzKXx8cixsWzFdPT09ITApcmV0dXJuITB9fWZ1bmN0aW9uIGd0KGUpe3JldHVybiBlLmxlbmd0aD4xP2Z1bmN0aW9uKHQsbixyKXt2YXIgaT1lLmxlbmd0aDt3aGlsZShpLS0paWYoIWVbaV0odCxuLHIpKXJldHVybiExO3JldHVybiEwfTplWzBdfWZ1bmN0aW9uIG10KGUsdCxuLHIsaSl7dmFyIG8sYT1bXSxzPTAsdT1lLmxlbmd0aCxsPW51bGwhPXQ7Zm9yKDt1PnM7cysrKShvPWVbc10pJiYoIW58fG4obyxyLGkpKSYmKGEucHVzaChvKSxsJiZ0LnB1c2gocykpO3JldHVybiBhfWZ1bmN0aW9uIHl0KGUsdCxuLHIsaSxvKXtyZXR1cm4gciYmIXJbeF0mJihyPXl0KHIpKSxpJiYhaVt4XSYmKGk9eXQoaSxvKSksb3QoZnVuY3Rpb24obyxhLHMsdSl7dmFyIGwsYyxwLGY9W10sZD1bXSxoPWEubGVuZ3RoLGc9b3x8eHQodHx8XCIqXCIscy5ub2RlVHlwZT9bc106cyxbXSksbT0hZXx8IW8mJnQ/ZzptdChnLGYsZSxzLHUpLHk9bj9pfHwobz9lOmh8fHIpP1tdOmE6bTtpZihuJiZuKG0seSxzLHUpLHIpe2w9bXQoeSxkKSxyKGwsW10scyx1KSxjPWwubGVuZ3RoO3doaWxlKGMtLSkocD1sW2NdKSYmKHlbZFtjXV09IShtW2RbY11dPXApKX1pZihvKXtpZihpfHxlKXtpZihpKXtsPVtdLGM9eS5sZW5ndGg7d2hpbGUoYy0tKShwPXlbY10pJiZsLnB1c2gobVtjXT1wKTtpKG51bGwseT1bXSxsLHUpfWM9eS5sZW5ndGg7d2hpbGUoYy0tKShwPXlbY10pJiYobD1pP00uY2FsbChvLHApOmZbY10pPi0xJiYob1tsXT0hKGFbbF09cCkpfX1lbHNlIHk9bXQoeT09PWE/eS5zcGxpY2UoaCx5Lmxlbmd0aCk6eSksaT9pKG51bGwsYSx5LHUpOkguYXBwbHkoYSx5KX0pfWZ1bmN0aW9uIHZ0KGUpe3ZhciB0LG4scixvPWUubGVuZ3RoLGE9aS5yZWxhdGl2ZVtlWzBdLnR5cGVdLHM9YXx8aS5yZWxhdGl2ZVtcIiBcIl0sdT1hPzE6MCxjPWh0KGZ1bmN0aW9uKGUpe3JldHVybiBlPT09dH0scywhMCkscD1odChmdW5jdGlvbihlKXtyZXR1cm4gTS5jYWxsKHQsZSk+LTF9LHMsITApLGY9W2Z1bmN0aW9uKGUsbixyKXtyZXR1cm4hYSYmKHJ8fG4hPT1sKXx8KCh0PW4pLm5vZGVUeXBlP2MoZSxuLHIpOnAoZSxuLHIpKX1dO2Zvcig7bz51O3UrKylpZihuPWkucmVsYXRpdmVbZVt1XS50eXBlXSlmPVtodChndChmKSxuKV07ZWxzZXtpZihuPWkuZmlsdGVyW2VbdV0udHlwZV0uYXBwbHkobnVsbCxlW3VdLm1hdGNoZXMpLG5beF0pe2ZvcihyPSsrdTtvPnI7cisrKWlmKGkucmVsYXRpdmVbZVtyXS50eXBlXSlicmVhaztyZXR1cm4geXQodT4xJiZndChmKSx1PjEmJmR0KGUuc2xpY2UoMCx1LTEpKS5yZXBsYWNlKFcsXCIkMVwiKSxuLHI+dSYmdnQoZS5zbGljZSh1LHIpKSxvPnImJnZ0KGU9ZS5zbGljZShyKSksbz5yJiZkdChlKSl9Zi5wdXNoKG4pfXJldHVybiBndChmKX1mdW5jdGlvbiBidChlLHQpe3ZhciBuPTAsbz10Lmxlbmd0aD4wLGE9ZS5sZW5ndGg+MCxzPWZ1bmN0aW9uKHMsdSxjLGYsZCl7dmFyIGgsZyxtLHk9W10sdj0wLGI9XCIwXCIseD1zJiZbXSx3PW51bGwhPWQsVD1sLEM9c3x8YSYmaS5maW5kLlRBRyhcIipcIixkJiZ1LnBhcmVudE5vZGV8fHUpLGs9Tis9bnVsbD09VD8xOk1hdGgucmFuZG9tKCl8fC4xO2Zvcih3JiYobD11IT09cCYmdSxyPW4pO251bGwhPShoPUNbYl0pO2IrKyl7aWYoYSYmaCl7Zz0wO3doaWxlKG09ZVtnKytdKWlmKG0oaCx1LGMpKXtmLnB1c2goaCk7YnJlYWt9dyYmKE49ayxyPSsrbil9byYmKChoPSFtJiZoKSYmdi0tLHMmJngucHVzaChoKSl9aWYodis9YixvJiZiIT09dil7Zz0wO3doaWxlKG09dFtnKytdKW0oeCx5LHUsYyk7aWYocyl7aWYodj4wKXdoaWxlKGItLSl4W2JdfHx5W2JdfHwoeVtiXT1MLmNhbGwoZikpO3k9bXQoeSl9SC5hcHBseShmLHkpLHcmJiFzJiZ5Lmxlbmd0aD4wJiZ2K3QubGVuZ3RoPjEmJnN0LnVuaXF1ZVNvcnQoZil9cmV0dXJuIHcmJihOPWssbD1UKSx4fTtyZXR1cm4gbz9vdChzKTpzfXM9c3QuY29tcGlsZT1mdW5jdGlvbihlLHQpe3ZhciBuLHI9W10saT1bXSxvPVNbZStcIiBcIl07aWYoIW8pe3R8fCh0PWZ0KGUpKSxuPXQubGVuZ3RoO3doaWxlKG4tLSlvPXZ0KHRbbl0pLG9beF0/ci5wdXNoKG8pOmkucHVzaChvKTtvPVMoZSxidChpLHIpKX1yZXR1cm4gb307ZnVuY3Rpb24geHQoZSx0LG4pe3ZhciByPTAsaT10Lmxlbmd0aDtmb3IoO2k+cjtyKyspc3QoZSx0W3JdLG4pO3JldHVybiBufWZ1bmN0aW9uIHd0KGUsdCxuLHIpe3ZhciBvLGEsdSxsLGMscD1mdChlKTtpZighciYmMT09PXAubGVuZ3RoKXtpZihhPXBbMF09cFswXS5zbGljZSgwKSxhLmxlbmd0aD4yJiZcIklEXCI9PT0odT1hWzBdKS50eXBlJiY5PT09dC5ub2RlVHlwZSYmIWQmJmkucmVsYXRpdmVbYVsxXS50eXBlXSl7aWYodD1pLmZpbmQuSUQodS5tYXRjaGVzWzBdLnJlcGxhY2UoZXQsdHQpLHQpWzBdLCF0KXJldHVybiBuO2U9ZS5zbGljZShhLnNoaWZ0KCkudmFsdWUubGVuZ3RoKX1vPVUubmVlZHNDb250ZXh0LnRlc3QoZSk/MDphLmxlbmd0aDt3aGlsZShvLS0pe2lmKHU9YVtvXSxpLnJlbGF0aXZlW2w9dS50eXBlXSlicmVhaztpZigoYz1pLmZpbmRbbF0pJiYocj1jKHUubWF0Y2hlc1swXS5yZXBsYWNlKGV0LHR0KSxWLnRlc3QoYVswXS50eXBlKSYmdC5wYXJlbnROb2RlfHx0KSkpe2lmKGEuc3BsaWNlKG8sMSksZT1yLmxlbmd0aCYmZHQoYSksIWUpcmV0dXJuIEguYXBwbHkobixxLmNhbGwociwwKSksbjticmVha319fXJldHVybiBzKGUscCkocix0LGQsbixWLnRlc3QoZSkpLG59aS5wc2V1ZG9zLm50aD1pLnBzZXVkb3MuZXE7ZnVuY3Rpb24gVHQoKXt9aS5maWx0ZXJzPVR0LnByb3RvdHlwZT1pLnBzZXVkb3MsaS5zZXRGaWx0ZXJzPW5ldyBUdCxjKCksc3QuYXR0cj1iLmF0dHIsYi5maW5kPXN0LGIuZXhwcj1zdC5zZWxlY3RvcnMsYi5leHByW1wiOlwiXT1iLmV4cHIucHNldWRvcyxiLnVuaXF1ZT1zdC51bmlxdWVTb3J0LGIudGV4dD1zdC5nZXRUZXh0LGIuaXNYTUxEb2M9c3QuaXNYTUwsYi5jb250YWlucz1zdC5jb250YWluc30oZSk7dmFyIGF0PS9VbnRpbCQvLHN0PS9eKD86cGFyZW50c3xwcmV2KD86VW50aWx8QWxsKSkvLHV0PS9eLlteOiNcXFtcXC4sXSokLyxsdD1iLmV4cHIubWF0Y2gubmVlZHNDb250ZXh0LGN0PXtjaGlsZHJlbjohMCxjb250ZW50czohMCxuZXh0OiEwLHByZXY6ITB9O2IuZm4uZXh0ZW5kKHtmaW5kOmZ1bmN0aW9uKGUpe3ZhciB0LG4scixpPXRoaXMubGVuZ3RoO2lmKFwic3RyaW5nXCIhPXR5cGVvZiBlKXJldHVybiByPXRoaXMsdGhpcy5wdXNoU3RhY2soYihlKS5maWx0ZXIoZnVuY3Rpb24oKXtmb3IodD0wO2k+dDt0KyspaWYoYi5jb250YWlucyhyW3RdLHRoaXMpKXJldHVybiEwfSkpO2ZvcihuPVtdLHQ9MDtpPnQ7dCsrKWIuZmluZChlLHRoaXNbdF0sbik7cmV0dXJuIG49dGhpcy5wdXNoU3RhY2soaT4xP2IudW5pcXVlKG4pOm4pLG4uc2VsZWN0b3I9KHRoaXMuc2VsZWN0b3I/dGhpcy5zZWxlY3RvcitcIiBcIjpcIlwiKStlLG59LGhhczpmdW5jdGlvbihlKXt2YXIgdCxuPWIoZSx0aGlzKSxyPW4ubGVuZ3RoO3JldHVybiB0aGlzLmZpbHRlcihmdW5jdGlvbigpe2Zvcih0PTA7cj50O3QrKylpZihiLmNvbnRhaW5zKHRoaXMsblt0XSkpcmV0dXJuITB9KX0sbm90OmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLnB1c2hTdGFjayhmdCh0aGlzLGUsITEpKX0sZmlsdGVyOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLnB1c2hTdGFjayhmdCh0aGlzLGUsITApKX0saXM6ZnVuY3Rpb24oZSl7cmV0dXJuISFlJiYoXCJzdHJpbmdcIj09dHlwZW9mIGU/bHQudGVzdChlKT9iKGUsdGhpcy5jb250ZXh0KS5pbmRleCh0aGlzWzBdKT49MDpiLmZpbHRlcihlLHRoaXMpLmxlbmd0aD4wOnRoaXMuZmlsdGVyKGUpLmxlbmd0aD4wKX0sY2xvc2VzdDpmdW5jdGlvbihlLHQpe3ZhciBuLHI9MCxpPXRoaXMubGVuZ3RoLG89W10sYT1sdC50ZXN0KGUpfHxcInN0cmluZ1wiIT10eXBlb2YgZT9iKGUsdHx8dGhpcy5jb250ZXh0KTowO2Zvcig7aT5yO3IrKyl7bj10aGlzW3JdO3doaWxlKG4mJm4ub3duZXJEb2N1bWVudCYmbiE9PXQmJjExIT09bi5ub2RlVHlwZSl7aWYoYT9hLmluZGV4KG4pPi0xOmIuZmluZC5tYXRjaGVzU2VsZWN0b3IobixlKSl7by5wdXNoKG4pO2JyZWFrfW49bi5wYXJlbnROb2RlfX1yZXR1cm4gdGhpcy5wdXNoU3RhY2soby5sZW5ndGg+MT9iLnVuaXF1ZShvKTpvKX0saW5kZXg6ZnVuY3Rpb24oZSl7cmV0dXJuIGU/XCJzdHJpbmdcIj09dHlwZW9mIGU/Yi5pbkFycmF5KHRoaXNbMF0sYihlKSk6Yi5pbkFycmF5KGUuanF1ZXJ5P2VbMF06ZSx0aGlzKTp0aGlzWzBdJiZ0aGlzWzBdLnBhcmVudE5vZGU/dGhpcy5maXJzdCgpLnByZXZBbGwoKS5sZW5ndGg6LTF9LGFkZDpmdW5jdGlvbihlLHQpe3ZhciBuPVwic3RyaW5nXCI9PXR5cGVvZiBlP2IoZSx0KTpiLm1ha2VBcnJheShlJiZlLm5vZGVUeXBlP1tlXTplKSxyPWIubWVyZ2UodGhpcy5nZXQoKSxuKTtyZXR1cm4gdGhpcy5wdXNoU3RhY2soYi51bmlxdWUocikpfSxhZGRCYWNrOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLmFkZChudWxsPT1lP3RoaXMucHJldk9iamVjdDp0aGlzLnByZXZPYmplY3QuZmlsdGVyKGUpKX19KSxiLmZuLmFuZFNlbGY9Yi5mbi5hZGRCYWNrO2Z1bmN0aW9uIHB0KGUsdCl7ZG8gZT1lW3RdO3doaWxlKGUmJjEhPT1lLm5vZGVUeXBlKTtyZXR1cm4gZX1iLmVhY2goe3BhcmVudDpmdW5jdGlvbihlKXt2YXIgdD1lLnBhcmVudE5vZGU7cmV0dXJuIHQmJjExIT09dC5ub2RlVHlwZT90Om51bGx9LHBhcmVudHM6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuZGlyKGUsXCJwYXJlbnROb2RlXCIpfSxwYXJlbnRzVW50aWw6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBiLmRpcihlLFwicGFyZW50Tm9kZVwiLG4pfSxuZXh0OmZ1bmN0aW9uKGUpe3JldHVybiBwdChlLFwibmV4dFNpYmxpbmdcIil9LHByZXY6ZnVuY3Rpb24oZSl7cmV0dXJuIHB0KGUsXCJwcmV2aW91c1NpYmxpbmdcIil9LG5leHRBbGw6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuZGlyKGUsXCJuZXh0U2libGluZ1wiKX0scHJldkFsbDpmdW5jdGlvbihlKXtyZXR1cm4gYi5kaXIoZSxcInByZXZpb3VzU2libGluZ1wiKX0sbmV4dFVudGlsOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gYi5kaXIoZSxcIm5leHRTaWJsaW5nXCIsbil9LHByZXZVbnRpbDpmdW5jdGlvbihlLHQsbil7cmV0dXJuIGIuZGlyKGUsXCJwcmV2aW91c1NpYmxpbmdcIixuKX0sc2libGluZ3M6ZnVuY3Rpb24oZSl7cmV0dXJuIGIuc2libGluZygoZS5wYXJlbnROb2RlfHx7fSkuZmlyc3RDaGlsZCxlKX0sY2hpbGRyZW46ZnVuY3Rpb24oZSl7cmV0dXJuIGIuc2libGluZyhlLmZpcnN0Q2hpbGQpfSxjb250ZW50czpmdW5jdGlvbihlKXtyZXR1cm4gYi5ub2RlTmFtZShlLFwiaWZyYW1lXCIpP2UuY29udGVudERvY3VtZW50fHxlLmNvbnRlbnRXaW5kb3cuZG9jdW1lbnQ6Yi5tZXJnZShbXSxlLmNoaWxkTm9kZXMpfX0sZnVuY3Rpb24oZSx0KXtiLmZuW2VdPWZ1bmN0aW9uKG4scil7dmFyIGk9Yi5tYXAodGhpcyx0LG4pO3JldHVybiBhdC50ZXN0KGUpfHwocj1uKSxyJiZcInN0cmluZ1wiPT10eXBlb2YgciYmKGk9Yi5maWx0ZXIocixpKSksaT10aGlzLmxlbmd0aD4xJiYhY3RbZV0/Yi51bmlxdWUoaSk6aSx0aGlzLmxlbmd0aD4xJiZzdC50ZXN0KGUpJiYoaT1pLnJldmVyc2UoKSksdGhpcy5wdXNoU3RhY2soaSl9fSksYi5leHRlbmQoe2ZpbHRlcjpmdW5jdGlvbihlLHQsbil7cmV0dXJuIG4mJihlPVwiOm5vdChcIitlK1wiKVwiKSwxPT09dC5sZW5ndGg/Yi5maW5kLm1hdGNoZXNTZWxlY3Rvcih0WzBdLGUpP1t0WzBdXTpbXTpiLmZpbmQubWF0Y2hlcyhlLHQpfSxkaXI6ZnVuY3Rpb24oZSxuLHIpe3ZhciBpPVtdLG89ZVtuXTt3aGlsZShvJiY5IT09by5ub2RlVHlwZSYmKHI9PT10fHwxIT09by5ub2RlVHlwZXx8IWIobykuaXMocikpKTE9PT1vLm5vZGVUeXBlJiZpLnB1c2gobyksbz1vW25dO3JldHVybiBpfSxzaWJsaW5nOmZ1bmN0aW9uKGUsdCl7dmFyIG49W107Zm9yKDtlO2U9ZS5uZXh0U2libGluZykxPT09ZS5ub2RlVHlwZSYmZSE9PXQmJm4ucHVzaChlKTtyZXR1cm4gbn19KTtmdW5jdGlvbiBmdChlLHQsbil7aWYodD10fHwwLGIuaXNGdW5jdGlvbih0KSlyZXR1cm4gYi5ncmVwKGUsZnVuY3Rpb24oZSxyKXt2YXIgaT0hIXQuY2FsbChlLHIsZSk7cmV0dXJuIGk9PT1ufSk7aWYodC5ub2RlVHlwZSlyZXR1cm4gYi5ncmVwKGUsZnVuY3Rpb24oZSl7cmV0dXJuIGU9PT10PT09bn0pO2lmKFwic3RyaW5nXCI9PXR5cGVvZiB0KXt2YXIgcj1iLmdyZXAoZSxmdW5jdGlvbihlKXtyZXR1cm4gMT09PWUubm9kZVR5cGV9KTtpZih1dC50ZXN0KHQpKXJldHVybiBiLmZpbHRlcih0LHIsIW4pO3Q9Yi5maWx0ZXIodCxyKX1yZXR1cm4gYi5ncmVwKGUsZnVuY3Rpb24oZSl7cmV0dXJuIGIuaW5BcnJheShlLHQpPj0wPT09bn0pfWZ1bmN0aW9uIGR0KGUpe3ZhciB0PWh0LnNwbGl0KFwifFwiKSxuPWUuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO2lmKG4uY3JlYXRlRWxlbWVudCl3aGlsZSh0Lmxlbmd0aCluLmNyZWF0ZUVsZW1lbnQodC5wb3AoKSk7cmV0dXJuIG59dmFyIGh0PVwiYWJicnxhcnRpY2xlfGFzaWRlfGF1ZGlvfGJkaXxjYW52YXN8ZGF0YXxkYXRhbGlzdHxkZXRhaWxzfGZpZ2NhcHRpb258ZmlndXJlfGZvb3RlcnxoZWFkZXJ8aGdyb3VwfG1hcmt8bWV0ZXJ8bmF2fG91dHB1dHxwcm9ncmVzc3xzZWN0aW9ufHN1bW1hcnl8dGltZXx2aWRlb1wiLGd0PS8galF1ZXJ5XFxkKz1cIig/Om51bGx8XFxkKylcIi9nLG10PVJlZ0V4cChcIjwoPzpcIitodCtcIilbXFxcXHMvPl1cIixcImlcIikseXQ9L15cXHMrLyx2dD0vPCg/IWFyZWF8YnJ8Y29sfGVtYmVkfGhyfGltZ3xpbnB1dHxsaW5rfG1ldGF8cGFyYW0pKChbXFx3Ol0rKVtePl0qKVxcLz4vZ2ksYnQ9LzwoW1xcdzpdKykvLHh0PS88dGJvZHkvaSx3dD0vPHwmIz9cXHcrOy8sVHQ9LzwoPzpzY3JpcHR8c3R5bGV8bGluaykvaSxOdD0vXig/OmNoZWNrYm94fHJhZGlvKSQvaSxDdD0vY2hlY2tlZFxccyooPzpbXj1dfD1cXHMqLmNoZWNrZWQuKS9pLGt0PS9eJHxcXC8oPzpqYXZhfGVjbWEpc2NyaXB0L2ksRXQ9L150cnVlXFwvKC4qKS8sU3Q9L15cXHMqPCEoPzpcXFtDREFUQVxcW3wtLSl8KD86XFxdXFxdfC0tKT5cXHMqJC9nLEF0PXtvcHRpb246WzEsXCI8c2VsZWN0IG11bHRpcGxlPSdtdWx0aXBsZSc+XCIsXCI8L3NlbGVjdD5cIl0sbGVnZW5kOlsxLFwiPGZpZWxkc2V0PlwiLFwiPC9maWVsZHNldD5cIl0sYXJlYTpbMSxcIjxtYXA+XCIsXCI8L21hcD5cIl0scGFyYW06WzEsXCI8b2JqZWN0PlwiLFwiPC9vYmplY3Q+XCJdLHRoZWFkOlsxLFwiPHRhYmxlPlwiLFwiPC90YWJsZT5cIl0sdHI6WzIsXCI8dGFibGU+PHRib2R5PlwiLFwiPC90Ym9keT48L3RhYmxlPlwiXSxjb2w6WzIsXCI8dGFibGU+PHRib2R5PjwvdGJvZHk+PGNvbGdyb3VwPlwiLFwiPC9jb2xncm91cD48L3RhYmxlPlwiXSx0ZDpbMyxcIjx0YWJsZT48dGJvZHk+PHRyPlwiLFwiPC90cj48L3Rib2R5PjwvdGFibGU+XCJdLF9kZWZhdWx0OmIuc3VwcG9ydC5odG1sU2VyaWFsaXplP1swLFwiXCIsXCJcIl06WzEsXCJYPGRpdj5cIixcIjwvZGl2PlwiXX0sanQ9ZHQobyksRHQ9anQuYXBwZW5kQ2hpbGQoby5jcmVhdGVFbGVtZW50KFwiZGl2XCIpKTtBdC5vcHRncm91cD1BdC5vcHRpb24sQXQudGJvZHk9QXQudGZvb3Q9QXQuY29sZ3JvdXA9QXQuY2FwdGlvbj1BdC50aGVhZCxBdC50aD1BdC50ZCxiLmZuLmV4dGVuZCh7dGV4dDpmdW5jdGlvbihlKXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxmdW5jdGlvbihlKXtyZXR1cm4gZT09PXQ/Yi50ZXh0KHRoaXMpOnRoaXMuZW1wdHkoKS5hcHBlbmQoKHRoaXNbMF0mJnRoaXNbMF0ub3duZXJEb2N1bWVudHx8bykuY3JlYXRlVGV4dE5vZGUoZSkpfSxudWxsLGUsYXJndW1lbnRzLmxlbmd0aCl9LHdyYXBBbGw6ZnVuY3Rpb24oZSl7aWYoYi5pc0Z1bmN0aW9uKGUpKXJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24odCl7Yih0aGlzKS53cmFwQWxsKGUuY2FsbCh0aGlzLHQpKX0pO2lmKHRoaXNbMF0pe3ZhciB0PWIoZSx0aGlzWzBdLm93bmVyRG9jdW1lbnQpLmVxKDApLmNsb25lKCEwKTt0aGlzWzBdLnBhcmVudE5vZGUmJnQuaW5zZXJ0QmVmb3JlKHRoaXNbMF0pLHQubWFwKGZ1bmN0aW9uKCl7dmFyIGU9dGhpczt3aGlsZShlLmZpcnN0Q2hpbGQmJjE9PT1lLmZpcnN0Q2hpbGQubm9kZVR5cGUpZT1lLmZpcnN0Q2hpbGQ7cmV0dXJuIGV9KS5hcHBlbmQodGhpcyl9cmV0dXJuIHRoaXN9LHdyYXBJbm5lcjpmdW5jdGlvbihlKXtyZXR1cm4gYi5pc0Z1bmN0aW9uKGUpP3RoaXMuZWFjaChmdW5jdGlvbih0KXtiKHRoaXMpLndyYXBJbm5lcihlLmNhbGwodGhpcyx0KSl9KTp0aGlzLmVhY2goZnVuY3Rpb24oKXt2YXIgdD1iKHRoaXMpLG49dC5jb250ZW50cygpO24ubGVuZ3RoP24ud3JhcEFsbChlKTp0LmFwcGVuZChlKX0pfSx3cmFwOmZ1bmN0aW9uKGUpe3ZhciB0PWIuaXNGdW5jdGlvbihlKTtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKG4pe2IodGhpcykud3JhcEFsbCh0P2UuY2FsbCh0aGlzLG4pOmUpfSl9LHVud3JhcDpmdW5jdGlvbigpe3JldHVybiB0aGlzLnBhcmVudCgpLmVhY2goZnVuY3Rpb24oKXtiLm5vZGVOYW1lKHRoaXMsXCJib2R5XCIpfHxiKHRoaXMpLnJlcGxhY2VXaXRoKHRoaXMuY2hpbGROb2Rlcyl9KS5lbmQoKX0sYXBwZW5kOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZG9tTWFuaXAoYXJndW1lbnRzLCEwLGZ1bmN0aW9uKGUpeygxPT09dGhpcy5ub2RlVHlwZXx8MTE9PT10aGlzLm5vZGVUeXBlfHw5PT09dGhpcy5ub2RlVHlwZSkmJnRoaXMuYXBwZW5kQ2hpbGQoZSl9KX0scHJlcGVuZDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRvbU1hbmlwKGFyZ3VtZW50cywhMCxmdW5jdGlvbihlKXsoMT09PXRoaXMubm9kZVR5cGV8fDExPT09dGhpcy5ub2RlVHlwZXx8OT09PXRoaXMubm9kZVR5cGUpJiZ0aGlzLmluc2VydEJlZm9yZShlLHRoaXMuZmlyc3RDaGlsZCl9KX0sYmVmb3JlOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZG9tTWFuaXAoYXJndW1lbnRzLCExLGZ1bmN0aW9uKGUpe3RoaXMucGFyZW50Tm9kZSYmdGhpcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlLHRoaXMpfSl9LGFmdGVyOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZG9tTWFuaXAoYXJndW1lbnRzLCExLGZ1bmN0aW9uKGUpe3RoaXMucGFyZW50Tm9kZSYmdGhpcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShlLHRoaXMubmV4dFNpYmxpbmcpfSl9LHJlbW92ZTpmdW5jdGlvbihlLHQpe3ZhciBuLHI9MDtmb3IoO251bGwhPShuPXRoaXNbcl0pO3IrKykoIWV8fGIuZmlsdGVyKGUsW25dKS5sZW5ndGg+MCkmJih0fHwxIT09bi5ub2RlVHlwZXx8Yi5jbGVhbkRhdGEoT3QobikpLG4ucGFyZW50Tm9kZSYmKHQmJmIuY29udGFpbnMobi5vd25lckRvY3VtZW50LG4pJiZNdChPdChuLFwic2NyaXB0XCIpKSxuLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobikpKTtyZXR1cm4gdGhpc30sZW1wdHk6ZnVuY3Rpb24oKXt2YXIgZSx0PTA7Zm9yKDtudWxsIT0oZT10aGlzW3RdKTt0KyspezE9PT1lLm5vZGVUeXBlJiZiLmNsZWFuRGF0YShPdChlLCExKSk7d2hpbGUoZS5maXJzdENoaWxkKWUucmVtb3ZlQ2hpbGQoZS5maXJzdENoaWxkKTtlLm9wdGlvbnMmJmIubm9kZU5hbWUoZSxcInNlbGVjdFwiKSYmKGUub3B0aW9ucy5sZW5ndGg9MCl9cmV0dXJuIHRoaXN9LGNsb25lOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIGU9bnVsbD09ZT8hMTplLHQ9bnVsbD09dD9lOnQsdGhpcy5tYXAoZnVuY3Rpb24oKXtyZXR1cm4gYi5jbG9uZSh0aGlzLGUsdCl9KX0saHRtbDpmdW5jdGlvbihlKXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxmdW5jdGlvbihlKXt2YXIgbj10aGlzWzBdfHx7fSxyPTAsaT10aGlzLmxlbmd0aDtpZihlPT09dClyZXR1cm4gMT09PW4ubm9kZVR5cGU/bi5pbm5lckhUTUwucmVwbGFjZShndCxcIlwiKTp0O2lmKCEoXCJzdHJpbmdcIiE9dHlwZW9mIGV8fFR0LnRlc3QoZSl8fCFiLnN1cHBvcnQuaHRtbFNlcmlhbGl6ZSYmbXQudGVzdChlKXx8IWIuc3VwcG9ydC5sZWFkaW5nV2hpdGVzcGFjZSYmeXQudGVzdChlKXx8QXRbKGJ0LmV4ZWMoZSl8fFtcIlwiLFwiXCJdKVsxXS50b0xvd2VyQ2FzZSgpXSkpe2U9ZS5yZXBsYWNlKHZ0LFwiPCQxPjwvJDI+XCIpO3RyeXtmb3IoO2k+cjtyKyspbj10aGlzW3JdfHx7fSwxPT09bi5ub2RlVHlwZSYmKGIuY2xlYW5EYXRhKE90KG4sITEpKSxuLmlubmVySFRNTD1lKTtuPTB9Y2F0Y2gobyl7fX1uJiZ0aGlzLmVtcHR5KCkuYXBwZW5kKGUpfSxudWxsLGUsYXJndW1lbnRzLmxlbmd0aCl9LHJlcGxhY2VXaXRoOmZ1bmN0aW9uKGUpe3ZhciB0PWIuaXNGdW5jdGlvbihlKTtyZXR1cm4gdHx8XCJzdHJpbmdcIj09dHlwZW9mIGV8fChlPWIoZSkubm90KHRoaXMpLmRldGFjaCgpKSx0aGlzLmRvbU1hbmlwKFtlXSwhMCxmdW5jdGlvbihlKXt2YXIgdD10aGlzLm5leHRTaWJsaW5nLG49dGhpcy5wYXJlbnROb2RlO24mJihiKHRoaXMpLnJlbW92ZSgpLG4uaW5zZXJ0QmVmb3JlKGUsdCkpfSl9LGRldGFjaDpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5yZW1vdmUoZSwhMCl9LGRvbU1hbmlwOmZ1bmN0aW9uKGUsbixyKXtlPWYuYXBwbHkoW10sZSk7dmFyIGksbyxhLHMsdSxsLGM9MCxwPXRoaXMubGVuZ3RoLGQ9dGhpcyxoPXAtMSxnPWVbMF0sbT1iLmlzRnVuY3Rpb24oZyk7aWYobXx8ISgxPj1wfHxcInN0cmluZ1wiIT10eXBlb2YgZ3x8Yi5zdXBwb3J0LmNoZWNrQ2xvbmUpJiZDdC50ZXN0KGcpKXJldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oaSl7dmFyIG89ZC5lcShpKTttJiYoZVswXT1nLmNhbGwodGhpcyxpLG4/by5odG1sKCk6dCkpLG8uZG9tTWFuaXAoZSxuLHIpfSk7aWYocCYmKGw9Yi5idWlsZEZyYWdtZW50KGUsdGhpc1swXS5vd25lckRvY3VtZW50LCExLHRoaXMpLGk9bC5maXJzdENoaWxkLDE9PT1sLmNoaWxkTm9kZXMubGVuZ3RoJiYobD1pKSxpKSl7Zm9yKG49biYmYi5ub2RlTmFtZShpLFwidHJcIikscz1iLm1hcChPdChsLFwic2NyaXB0XCIpLEh0KSxhPXMubGVuZ3RoO3A+YztjKyspbz1sLGMhPT1oJiYobz1iLmNsb25lKG8sITAsITApLGEmJmIubWVyZ2UocyxPdChvLFwic2NyaXB0XCIpKSksci5jYWxsKG4mJmIubm9kZU5hbWUodGhpc1tjXSxcInRhYmxlXCIpP0x0KHRoaXNbY10sXCJ0Ym9keVwiKTp0aGlzW2NdLG8sYyk7aWYoYSlmb3IodT1zW3MubGVuZ3RoLTFdLm93bmVyRG9jdW1lbnQsYi5tYXAocyxxdCksYz0wO2E+YztjKyspbz1zW2NdLGt0LnRlc3Qoby50eXBlfHxcIlwiKSYmIWIuX2RhdGEobyxcImdsb2JhbEV2YWxcIikmJmIuY29udGFpbnModSxvKSYmKG8uc3JjP2IuYWpheCh7dXJsOm8uc3JjLHR5cGU6XCJHRVRcIixkYXRhVHlwZTpcInNjcmlwdFwiLGFzeW5jOiExLGdsb2JhbDohMSxcInRocm93c1wiOiEwfSk6Yi5nbG9iYWxFdmFsKChvLnRleHR8fG8udGV4dENvbnRlbnR8fG8uaW5uZXJIVE1MfHxcIlwiKS5yZXBsYWNlKFN0LFwiXCIpKSk7bD1pPW51bGx9cmV0dXJuIHRoaXN9fSk7ZnVuY3Rpb24gTHQoZSx0KXtyZXR1cm4gZS5nZXRFbGVtZW50c0J5VGFnTmFtZSh0KVswXXx8ZS5hcHBlbmRDaGlsZChlLm93bmVyRG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0KSl9ZnVuY3Rpb24gSHQoZSl7dmFyIHQ9ZS5nZXRBdHRyaWJ1dGVOb2RlKFwidHlwZVwiKTtyZXR1cm4gZS50eXBlPSh0JiZ0LnNwZWNpZmllZCkrXCIvXCIrZS50eXBlLGV9ZnVuY3Rpb24gcXQoZSl7dmFyIHQ9RXQuZXhlYyhlLnR5cGUpO3JldHVybiB0P2UudHlwZT10WzFdOmUucmVtb3ZlQXR0cmlidXRlKFwidHlwZVwiKSxlfWZ1bmN0aW9uIE10KGUsdCl7dmFyIG4scj0wO2Zvcig7bnVsbCE9KG49ZVtyXSk7cisrKWIuX2RhdGEobixcImdsb2JhbEV2YWxcIiwhdHx8Yi5fZGF0YSh0W3JdLFwiZ2xvYmFsRXZhbFwiKSl9ZnVuY3Rpb24gX3QoZSx0KXtpZigxPT09dC5ub2RlVHlwZSYmYi5oYXNEYXRhKGUpKXt2YXIgbixyLGksbz1iLl9kYXRhKGUpLGE9Yi5fZGF0YSh0LG8pLHM9by5ldmVudHM7aWYocyl7ZGVsZXRlIGEuaGFuZGxlLGEuZXZlbnRzPXt9O2ZvcihuIGluIHMpZm9yKHI9MCxpPXNbbl0ubGVuZ3RoO2k+cjtyKyspYi5ldmVudC5hZGQodCxuLHNbbl1bcl0pfWEuZGF0YSYmKGEuZGF0YT1iLmV4dGVuZCh7fSxhLmRhdGEpKX19ZnVuY3Rpb24gRnQoZSx0KXt2YXIgbixyLGk7aWYoMT09PXQubm9kZVR5cGUpe2lmKG49dC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpLCFiLnN1cHBvcnQubm9DbG9uZUV2ZW50JiZ0W2IuZXhwYW5kb10pe2k9Yi5fZGF0YSh0KTtmb3IociBpbiBpLmV2ZW50cyliLnJlbW92ZUV2ZW50KHQscixpLmhhbmRsZSk7dC5yZW1vdmVBdHRyaWJ1dGUoYi5leHBhbmRvKX1cInNjcmlwdFwiPT09biYmdC50ZXh0IT09ZS50ZXh0PyhIdCh0KS50ZXh0PWUudGV4dCxxdCh0KSk6XCJvYmplY3RcIj09PW4/KHQucGFyZW50Tm9kZSYmKHQub3V0ZXJIVE1MPWUub3V0ZXJIVE1MKSxiLnN1cHBvcnQuaHRtbDVDbG9uZSYmZS5pbm5lckhUTUwmJiFiLnRyaW0odC5pbm5lckhUTUwpJiYodC5pbm5lckhUTUw9ZS5pbm5lckhUTUwpKTpcImlucHV0XCI9PT1uJiZOdC50ZXN0KGUudHlwZSk/KHQuZGVmYXVsdENoZWNrZWQ9dC5jaGVja2VkPWUuY2hlY2tlZCx0LnZhbHVlIT09ZS52YWx1ZSYmKHQudmFsdWU9ZS52YWx1ZSkpOlwib3B0aW9uXCI9PT1uP3QuZGVmYXVsdFNlbGVjdGVkPXQuc2VsZWN0ZWQ9ZS5kZWZhdWx0U2VsZWN0ZWQ6KFwiaW5wdXRcIj09PW58fFwidGV4dGFyZWFcIj09PW4pJiYodC5kZWZhdWx0VmFsdWU9ZS5kZWZhdWx0VmFsdWUpfX1iLmVhY2goe2FwcGVuZFRvOlwiYXBwZW5kXCIscHJlcGVuZFRvOlwicHJlcGVuZFwiLGluc2VydEJlZm9yZTpcImJlZm9yZVwiLGluc2VydEFmdGVyOlwiYWZ0ZXJcIixyZXBsYWNlQWxsOlwicmVwbGFjZVdpdGhcIn0sZnVuY3Rpb24oZSx0KXtiLmZuW2VdPWZ1bmN0aW9uKGUpe3ZhciBuLHI9MCxpPVtdLG89YihlKSxhPW8ubGVuZ3RoLTE7Zm9yKDthPj1yO3IrKyluPXI9PT1hP3RoaXM6dGhpcy5jbG9uZSghMCksYihvW3JdKVt0XShuKSxkLmFwcGx5KGksbi5nZXQoKSk7cmV0dXJuIHRoaXMucHVzaFN0YWNrKGkpfX0pO2Z1bmN0aW9uIE90KGUsbil7dmFyIHIsbyxhPTAscz10eXBlb2YgZS5nZXRFbGVtZW50c0J5VGFnTmFtZSE9PWk/ZS5nZXRFbGVtZW50c0J5VGFnTmFtZShufHxcIipcIik6dHlwZW9mIGUucXVlcnlTZWxlY3RvckFsbCE9PWk/ZS5xdWVyeVNlbGVjdG9yQWxsKG58fFwiKlwiKTp0O2lmKCFzKWZvcihzPVtdLHI9ZS5jaGlsZE5vZGVzfHxlO251bGwhPShvPXJbYV0pO2ErKykhbnx8Yi5ub2RlTmFtZShvLG4pP3MucHVzaChvKTpiLm1lcmdlKHMsT3QobyxuKSk7cmV0dXJuIG49PT10fHxuJiZiLm5vZGVOYW1lKGUsbik/Yi5tZXJnZShbZV0scyk6c31mdW5jdGlvbiBCdChlKXtOdC50ZXN0KGUudHlwZSkmJihlLmRlZmF1bHRDaGVja2VkPWUuY2hlY2tlZCl9Yi5leHRlbmQoe2Nsb25lOmZ1bmN0aW9uKGUsdCxuKXt2YXIgcixpLG8sYSxzLHU9Yi5jb250YWlucyhlLm93bmVyRG9jdW1lbnQsZSk7aWYoYi5zdXBwb3J0Lmh0bWw1Q2xvbmV8fGIuaXNYTUxEb2MoZSl8fCFtdC50ZXN0KFwiPFwiK2Uubm9kZU5hbWUrXCI+XCIpP289ZS5jbG9uZU5vZGUoITApOihEdC5pbm5lckhUTUw9ZS5vdXRlckhUTUwsRHQucmVtb3ZlQ2hpbGQobz1EdC5maXJzdENoaWxkKSksIShiLnN1cHBvcnQubm9DbG9uZUV2ZW50JiZiLnN1cHBvcnQubm9DbG9uZUNoZWNrZWR8fDEhPT1lLm5vZGVUeXBlJiYxMSE9PWUubm9kZVR5cGV8fGIuaXNYTUxEb2MoZSkpKWZvcihyPU90KG8pLHM9T3QoZSksYT0wO251bGwhPShpPXNbYV0pOysrYSlyW2FdJiZGdChpLHJbYV0pO2lmKHQpaWYobilmb3Iocz1zfHxPdChlKSxyPXJ8fE90KG8pLGE9MDtudWxsIT0oaT1zW2FdKTthKyspX3QoaSxyW2FdKTtlbHNlIF90KGUsbyk7cmV0dXJuIHI9T3QobyxcInNjcmlwdFwiKSxyLmxlbmd0aD4wJiZNdChyLCF1JiZPdChlLFwic2NyaXB0XCIpKSxyPXM9aT1udWxsLG99LGJ1aWxkRnJhZ21lbnQ6ZnVuY3Rpb24oZSx0LG4scil7dmFyIGksbyxhLHMsdSxsLGMscD1lLmxlbmd0aCxmPWR0KHQpLGQ9W10saD0wO2Zvcig7cD5oO2grKylpZihvPWVbaF0sb3x8MD09PW8paWYoXCJvYmplY3RcIj09PWIudHlwZShvKSliLm1lcmdlKGQsby5ub2RlVHlwZT9bb106byk7ZWxzZSBpZih3dC50ZXN0KG8pKXtzPXN8fGYuYXBwZW5kQ2hpbGQodC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpKSx1PShidC5leGVjKG8pfHxbXCJcIixcIlwiXSlbMV0udG9Mb3dlckNhc2UoKSxjPUF0W3VdfHxBdC5fZGVmYXVsdCxzLmlubmVySFRNTD1jWzFdK28ucmVwbGFjZSh2dCxcIjwkMT48LyQyPlwiKStjWzJdLGk9Y1swXTt3aGlsZShpLS0pcz1zLmxhc3RDaGlsZDtpZighYi5zdXBwb3J0LmxlYWRpbmdXaGl0ZXNwYWNlJiZ5dC50ZXN0KG8pJiZkLnB1c2godC5jcmVhdGVUZXh0Tm9kZSh5dC5leGVjKG8pWzBdKSksIWIuc3VwcG9ydC50Ym9keSl7bz1cInRhYmxlXCIhPT11fHx4dC50ZXN0KG8pP1wiPHRhYmxlPlwiIT09Y1sxXXx8eHQudGVzdChvKT8wOnM6cy5maXJzdENoaWxkLGk9byYmby5jaGlsZE5vZGVzLmxlbmd0aDt3aGlsZShpLS0pYi5ub2RlTmFtZShsPW8uY2hpbGROb2Rlc1tpXSxcInRib2R5XCIpJiYhbC5jaGlsZE5vZGVzLmxlbmd0aCYmby5yZW1vdmVDaGlsZChsKVxufWIubWVyZ2UoZCxzLmNoaWxkTm9kZXMpLHMudGV4dENvbnRlbnQ9XCJcIjt3aGlsZShzLmZpcnN0Q2hpbGQpcy5yZW1vdmVDaGlsZChzLmZpcnN0Q2hpbGQpO3M9Zi5sYXN0Q2hpbGR9ZWxzZSBkLnB1c2godC5jcmVhdGVUZXh0Tm9kZShvKSk7cyYmZi5yZW1vdmVDaGlsZChzKSxiLnN1cHBvcnQuYXBwZW5kQ2hlY2tlZHx8Yi5ncmVwKE90KGQsXCJpbnB1dFwiKSxCdCksaD0wO3doaWxlKG89ZFtoKytdKWlmKCghcnx8LTE9PT1iLmluQXJyYXkobyxyKSkmJihhPWIuY29udGFpbnMoby5vd25lckRvY3VtZW50LG8pLHM9T3QoZi5hcHBlbmRDaGlsZChvKSxcInNjcmlwdFwiKSxhJiZNdChzKSxuKSl7aT0wO3doaWxlKG89c1tpKytdKWt0LnRlc3Qoby50eXBlfHxcIlwiKSYmbi5wdXNoKG8pfXJldHVybiBzPW51bGwsZn0sY2xlYW5EYXRhOmZ1bmN0aW9uKGUsdCl7dmFyIG4scixvLGEscz0wLHU9Yi5leHBhbmRvLGw9Yi5jYWNoZSxwPWIuc3VwcG9ydC5kZWxldGVFeHBhbmRvLGY9Yi5ldmVudC5zcGVjaWFsO2Zvcig7bnVsbCE9KG49ZVtzXSk7cysrKWlmKCh0fHxiLmFjY2VwdERhdGEobikpJiYobz1uW3VdLGE9byYmbFtvXSkpe2lmKGEuZXZlbnRzKWZvcihyIGluIGEuZXZlbnRzKWZbcl0/Yi5ldmVudC5yZW1vdmUobixyKTpiLnJlbW92ZUV2ZW50KG4scixhLmhhbmRsZSk7bFtvXSYmKGRlbGV0ZSBsW29dLHA/ZGVsZXRlIG5bdV06dHlwZW9mIG4ucmVtb3ZlQXR0cmlidXRlIT09aT9uLnJlbW92ZUF0dHJpYnV0ZSh1KTpuW3VdPW51bGwsYy5wdXNoKG8pKX19fSk7dmFyIFB0LFJ0LFd0LCR0PS9hbHBoYVxcKFteKV0qXFwpL2ksSXQ9L29wYWNpdHlcXHMqPVxccyooW14pXSopLyx6dD0vXih0b3B8cmlnaHR8Ym90dG9tfGxlZnQpJC8sWHQ9L14obm9uZXx0YWJsZSg/IS1jW2VhXSkuKykvLFV0PS9ebWFyZ2luLyxWdD1SZWdFeHAoXCJeKFwiK3grXCIpKC4qKSRcIixcImlcIiksWXQ9UmVnRXhwKFwiXihcIit4K1wiKSg/IXB4KVthLXolXSskXCIsXCJpXCIpLEp0PVJlZ0V4cChcIl4oWystXSk9KFwiK3grXCIpXCIsXCJpXCIpLEd0PXtCT0RZOlwiYmxvY2tcIn0sUXQ9e3Bvc2l0aW9uOlwiYWJzb2x1dGVcIix2aXNpYmlsaXR5OlwiaGlkZGVuXCIsZGlzcGxheTpcImJsb2NrXCJ9LEt0PXtsZXR0ZXJTcGFjaW5nOjAsZm9udFdlaWdodDo0MDB9LFp0PVtcIlRvcFwiLFwiUmlnaHRcIixcIkJvdHRvbVwiLFwiTGVmdFwiXSxlbj1bXCJXZWJraXRcIixcIk9cIixcIk1velwiLFwibXNcIl07ZnVuY3Rpb24gdG4oZSx0KXtpZih0IGluIGUpcmV0dXJuIHQ7dmFyIG49dC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSt0LnNsaWNlKDEpLHI9dCxpPWVuLmxlbmd0aDt3aGlsZShpLS0paWYodD1lbltpXStuLHQgaW4gZSlyZXR1cm4gdDtyZXR1cm4gcn1mdW5jdGlvbiBubihlLHQpe3JldHVybiBlPXR8fGUsXCJub25lXCI9PT1iLmNzcyhlLFwiZGlzcGxheVwiKXx8IWIuY29udGFpbnMoZS5vd25lckRvY3VtZW50LGUpfWZ1bmN0aW9uIHJuKGUsdCl7dmFyIG4scixpLG89W10sYT0wLHM9ZS5sZW5ndGg7Zm9yKDtzPmE7YSsrKXI9ZVthXSxyLnN0eWxlJiYob1thXT1iLl9kYXRhKHIsXCJvbGRkaXNwbGF5XCIpLG49ci5zdHlsZS5kaXNwbGF5LHQ/KG9bYV18fFwibm9uZVwiIT09bnx8KHIuc3R5bGUuZGlzcGxheT1cIlwiKSxcIlwiPT09ci5zdHlsZS5kaXNwbGF5JiZubihyKSYmKG9bYV09Yi5fZGF0YShyLFwib2xkZGlzcGxheVwiLHVuKHIubm9kZU5hbWUpKSkpOm9bYV18fChpPW5uKHIpLChuJiZcIm5vbmVcIiE9PW58fCFpKSYmYi5fZGF0YShyLFwib2xkZGlzcGxheVwiLGk/bjpiLmNzcyhyLFwiZGlzcGxheVwiKSkpKTtmb3IoYT0wO3M+YTthKyspcj1lW2FdLHIuc3R5bGUmJih0JiZcIm5vbmVcIiE9PXIuc3R5bGUuZGlzcGxheSYmXCJcIiE9PXIuc3R5bGUuZGlzcGxheXx8KHIuc3R5bGUuZGlzcGxheT10P29bYV18fFwiXCI6XCJub25lXCIpKTtyZXR1cm4gZX1iLmZuLmV4dGVuZCh7Y3NzOmZ1bmN0aW9uKGUsbil7cmV0dXJuIGIuYWNjZXNzKHRoaXMsZnVuY3Rpb24oZSxuLHIpe3ZhciBpLG8sYT17fSxzPTA7aWYoYi5pc0FycmF5KG4pKXtmb3Iobz1SdChlKSxpPW4ubGVuZ3RoO2k+cztzKyspYVtuW3NdXT1iLmNzcyhlLG5bc10sITEsbyk7cmV0dXJuIGF9cmV0dXJuIHIhPT10P2Iuc3R5bGUoZSxuLHIpOmIuY3NzKGUsbil9LGUsbixhcmd1bWVudHMubGVuZ3RoPjEpfSxzaG93OmZ1bmN0aW9uKCl7cmV0dXJuIHJuKHRoaXMsITApfSxoaWRlOmZ1bmN0aW9uKCl7cmV0dXJuIHJuKHRoaXMpfSx0b2dnbGU6ZnVuY3Rpb24oZSl7dmFyIHQ9XCJib29sZWFuXCI9PXR5cGVvZiBlO3JldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXsodD9lOm5uKHRoaXMpKT9iKHRoaXMpLnNob3coKTpiKHRoaXMpLmhpZGUoKX0pfX0pLGIuZXh0ZW5kKHtjc3NIb29rczp7b3BhY2l0eTp7Z2V0OmZ1bmN0aW9uKGUsdCl7aWYodCl7dmFyIG49V3QoZSxcIm9wYWNpdHlcIik7cmV0dXJuXCJcIj09PW4/XCIxXCI6bn19fX0sY3NzTnVtYmVyOntjb2x1bW5Db3VudDohMCxmaWxsT3BhY2l0eTohMCxmb250V2VpZ2h0OiEwLGxpbmVIZWlnaHQ6ITAsb3BhY2l0eTohMCxvcnBoYW5zOiEwLHdpZG93czohMCx6SW5kZXg6ITAsem9vbTohMH0sY3NzUHJvcHM6e1wiZmxvYXRcIjpiLnN1cHBvcnQuY3NzRmxvYXQ/XCJjc3NGbG9hdFwiOlwic3R5bGVGbG9hdFwifSxzdHlsZTpmdW5jdGlvbihlLG4scixpKXtpZihlJiYzIT09ZS5ub2RlVHlwZSYmOCE9PWUubm9kZVR5cGUmJmUuc3R5bGUpe3ZhciBvLGEscyx1PWIuY2FtZWxDYXNlKG4pLGw9ZS5zdHlsZTtpZihuPWIuY3NzUHJvcHNbdV18fChiLmNzc1Byb3BzW3VdPXRuKGwsdSkpLHM9Yi5jc3NIb29rc1tuXXx8Yi5jc3NIb29rc1t1XSxyPT09dClyZXR1cm4gcyYmXCJnZXRcImluIHMmJihvPXMuZ2V0KGUsITEsaSkpIT09dD9vOmxbbl07aWYoYT10eXBlb2YgcixcInN0cmluZ1wiPT09YSYmKG89SnQuZXhlYyhyKSkmJihyPShvWzFdKzEpKm9bMl0rcGFyc2VGbG9hdChiLmNzcyhlLG4pKSxhPVwibnVtYmVyXCIpLCEobnVsbD09cnx8XCJudW1iZXJcIj09PWEmJmlzTmFOKHIpfHwoXCJudW1iZXJcIiE9PWF8fGIuY3NzTnVtYmVyW3VdfHwocis9XCJweFwiKSxiLnN1cHBvcnQuY2xlYXJDbG9uZVN0eWxlfHxcIlwiIT09cnx8MCE9PW4uaW5kZXhPZihcImJhY2tncm91bmRcIil8fChsW25dPVwiaW5oZXJpdFwiKSxzJiZcInNldFwiaW4gcyYmKHI9cy5zZXQoZSxyLGkpKT09PXQpKSl0cnl7bFtuXT1yfWNhdGNoKGMpe319fSxjc3M6ZnVuY3Rpb24oZSxuLHIsaSl7dmFyIG8sYSxzLHU9Yi5jYW1lbENhc2Uobik7cmV0dXJuIG49Yi5jc3NQcm9wc1t1XXx8KGIuY3NzUHJvcHNbdV09dG4oZS5zdHlsZSx1KSkscz1iLmNzc0hvb2tzW25dfHxiLmNzc0hvb2tzW3VdLHMmJlwiZ2V0XCJpbiBzJiYoYT1zLmdldChlLCEwLHIpKSxhPT09dCYmKGE9V3QoZSxuLGkpKSxcIm5vcm1hbFwiPT09YSYmbiBpbiBLdCYmKGE9S3Rbbl0pLFwiXCI9PT1yfHxyPyhvPXBhcnNlRmxvYXQoYSkscj09PSEwfHxiLmlzTnVtZXJpYyhvKT9vfHwwOmEpOmF9LHN3YXA6ZnVuY3Rpb24oZSx0LG4scil7dmFyIGksbyxhPXt9O2ZvcihvIGluIHQpYVtvXT1lLnN0eWxlW29dLGUuc3R5bGVbb109dFtvXTtpPW4uYXBwbHkoZSxyfHxbXSk7Zm9yKG8gaW4gdCllLnN0eWxlW29dPWFbb107cmV0dXJuIGl9fSksZS5nZXRDb21wdXRlZFN0eWxlPyhSdD1mdW5jdGlvbih0KXtyZXR1cm4gZS5nZXRDb21wdXRlZFN0eWxlKHQsbnVsbCl9LFd0PWZ1bmN0aW9uKGUsbixyKXt2YXIgaSxvLGEscz1yfHxSdChlKSx1PXM/cy5nZXRQcm9wZXJ0eVZhbHVlKG4pfHxzW25dOnQsbD1lLnN0eWxlO3JldHVybiBzJiYoXCJcIiE9PXV8fGIuY29udGFpbnMoZS5vd25lckRvY3VtZW50LGUpfHwodT1iLnN0eWxlKGUsbikpLFl0LnRlc3QodSkmJlV0LnRlc3QobikmJihpPWwud2lkdGgsbz1sLm1pbldpZHRoLGE9bC5tYXhXaWR0aCxsLm1pbldpZHRoPWwubWF4V2lkdGg9bC53aWR0aD11LHU9cy53aWR0aCxsLndpZHRoPWksbC5taW5XaWR0aD1vLGwubWF4V2lkdGg9YSkpLHV9KTpvLmRvY3VtZW50RWxlbWVudC5jdXJyZW50U3R5bGUmJihSdD1mdW5jdGlvbihlKXtyZXR1cm4gZS5jdXJyZW50U3R5bGV9LFd0PWZ1bmN0aW9uKGUsbixyKXt2YXIgaSxvLGEscz1yfHxSdChlKSx1PXM/c1tuXTp0LGw9ZS5zdHlsZTtyZXR1cm4gbnVsbD09dSYmbCYmbFtuXSYmKHU9bFtuXSksWXQudGVzdCh1KSYmIXp0LnRlc3QobikmJihpPWwubGVmdCxvPWUucnVudGltZVN0eWxlLGE9byYmby5sZWZ0LGEmJihvLmxlZnQ9ZS5jdXJyZW50U3R5bGUubGVmdCksbC5sZWZ0PVwiZm9udFNpemVcIj09PW4/XCIxZW1cIjp1LHU9bC5waXhlbExlZnQrXCJweFwiLGwubGVmdD1pLGEmJihvLmxlZnQ9YSkpLFwiXCI9PT11P1wiYXV0b1wiOnV9KTtmdW5jdGlvbiBvbihlLHQsbil7dmFyIHI9VnQuZXhlYyh0KTtyZXR1cm4gcj9NYXRoLm1heCgwLHJbMV0tKG58fDApKSsoclsyXXx8XCJweFwiKTp0fWZ1bmN0aW9uIGFuKGUsdCxuLHIsaSl7dmFyIG89bj09PShyP1wiYm9yZGVyXCI6XCJjb250ZW50XCIpPzQ6XCJ3aWR0aFwiPT09dD8xOjAsYT0wO2Zvcig7ND5vO28rPTIpXCJtYXJnaW5cIj09PW4mJihhKz1iLmNzcyhlLG4rWnRbb10sITAsaSkpLHI/KFwiY29udGVudFwiPT09biYmKGEtPWIuY3NzKGUsXCJwYWRkaW5nXCIrWnRbb10sITAsaSkpLFwibWFyZ2luXCIhPT1uJiYoYS09Yi5jc3MoZSxcImJvcmRlclwiK1p0W29dK1wiV2lkdGhcIiwhMCxpKSkpOihhKz1iLmNzcyhlLFwicGFkZGluZ1wiK1p0W29dLCEwLGkpLFwicGFkZGluZ1wiIT09biYmKGErPWIuY3NzKGUsXCJib3JkZXJcIitadFtvXStcIldpZHRoXCIsITAsaSkpKTtyZXR1cm4gYX1mdW5jdGlvbiBzbihlLHQsbil7dmFyIHI9ITAsaT1cIndpZHRoXCI9PT10P2Uub2Zmc2V0V2lkdGg6ZS5vZmZzZXRIZWlnaHQsbz1SdChlKSxhPWIuc3VwcG9ydC5ib3hTaXppbmcmJlwiYm9yZGVyLWJveFwiPT09Yi5jc3MoZSxcImJveFNpemluZ1wiLCExLG8pO2lmKDA+PWl8fG51bGw9PWkpe2lmKGk9V3QoZSx0LG8pLCgwPml8fG51bGw9PWkpJiYoaT1lLnN0eWxlW3RdKSxZdC50ZXN0KGkpKXJldHVybiBpO3I9YSYmKGIuc3VwcG9ydC5ib3hTaXppbmdSZWxpYWJsZXx8aT09PWUuc3R5bGVbdF0pLGk9cGFyc2VGbG9hdChpKXx8MH1yZXR1cm4gaSthbihlLHQsbnx8KGE/XCJib3JkZXJcIjpcImNvbnRlbnRcIikscixvKStcInB4XCJ9ZnVuY3Rpb24gdW4oZSl7dmFyIHQ9byxuPUd0W2VdO3JldHVybiBufHwobj1sbihlLHQpLFwibm9uZVwiIT09biYmbnx8KFB0PShQdHx8YihcIjxpZnJhbWUgZnJhbWVib3JkZXI9JzAnIHdpZHRoPScwJyBoZWlnaHQ9JzAnLz5cIikuY3NzKFwiY3NzVGV4dFwiLFwiZGlzcGxheTpibG9jayAhaW1wb3J0YW50XCIpKS5hcHBlbmRUbyh0LmRvY3VtZW50RWxlbWVudCksdD0oUHRbMF0uY29udGVudFdpbmRvd3x8UHRbMF0uY29udGVudERvY3VtZW50KS5kb2N1bWVudCx0LndyaXRlKFwiPCFkb2N0eXBlIGh0bWw+PGh0bWw+PGJvZHk+XCIpLHQuY2xvc2UoKSxuPWxuKGUsdCksUHQuZGV0YWNoKCkpLEd0W2VdPW4pLG59ZnVuY3Rpb24gbG4oZSx0KXt2YXIgbj1iKHQuY3JlYXRlRWxlbWVudChlKSkuYXBwZW5kVG8odC5ib2R5KSxyPWIuY3NzKG5bMF0sXCJkaXNwbGF5XCIpO3JldHVybiBuLnJlbW92ZSgpLHJ9Yi5lYWNoKFtcImhlaWdodFwiLFwid2lkdGhcIl0sZnVuY3Rpb24oZSxuKXtiLmNzc0hvb2tzW25dPXtnZXQ6ZnVuY3Rpb24oZSxyLGkpe3JldHVybiByPzA9PT1lLm9mZnNldFdpZHRoJiZYdC50ZXN0KGIuY3NzKGUsXCJkaXNwbGF5XCIpKT9iLnN3YXAoZSxRdCxmdW5jdGlvbigpe3JldHVybiBzbihlLG4saSl9KTpzbihlLG4saSk6dH0sc2V0OmZ1bmN0aW9uKGUsdCxyKXt2YXIgaT1yJiZSdChlKTtyZXR1cm4gb24oZSx0LHI/YW4oZSxuLHIsYi5zdXBwb3J0LmJveFNpemluZyYmXCJib3JkZXItYm94XCI9PT1iLmNzcyhlLFwiYm94U2l6aW5nXCIsITEsaSksaSk6MCl9fX0pLGIuc3VwcG9ydC5vcGFjaXR5fHwoYi5jc3NIb29rcy5vcGFjaXR5PXtnZXQ6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gSXQudGVzdCgodCYmZS5jdXJyZW50U3R5bGU/ZS5jdXJyZW50U3R5bGUuZmlsdGVyOmUuc3R5bGUuZmlsdGVyKXx8XCJcIik/LjAxKnBhcnNlRmxvYXQoUmVnRXhwLiQxKStcIlwiOnQ/XCIxXCI6XCJcIn0sc2V0OmZ1bmN0aW9uKGUsdCl7dmFyIG49ZS5zdHlsZSxyPWUuY3VycmVudFN0eWxlLGk9Yi5pc051bWVyaWModCk/XCJhbHBoYShvcGFjaXR5PVwiKzEwMCp0K1wiKVwiOlwiXCIsbz1yJiZyLmZpbHRlcnx8bi5maWx0ZXJ8fFwiXCI7bi56b29tPTEsKHQ+PTF8fFwiXCI9PT10KSYmXCJcIj09PWIudHJpbShvLnJlcGxhY2UoJHQsXCJcIikpJiZuLnJlbW92ZUF0dHJpYnV0ZSYmKG4ucmVtb3ZlQXR0cmlidXRlKFwiZmlsdGVyXCIpLFwiXCI9PT10fHxyJiYhci5maWx0ZXIpfHwobi5maWx0ZXI9JHQudGVzdChvKT9vLnJlcGxhY2UoJHQsaSk6bytcIiBcIitpKX19KSxiKGZ1bmN0aW9uKCl7Yi5zdXBwb3J0LnJlbGlhYmxlTWFyZ2luUmlnaHR8fChiLmNzc0hvb2tzLm1hcmdpblJpZ2h0PXtnZXQ6ZnVuY3Rpb24oZSxuKXtyZXR1cm4gbj9iLnN3YXAoZSx7ZGlzcGxheTpcImlubGluZS1ibG9ja1wifSxXdCxbZSxcIm1hcmdpblJpZ2h0XCJdKTp0fX0pLCFiLnN1cHBvcnQucGl4ZWxQb3NpdGlvbiYmYi5mbi5wb3NpdGlvbiYmYi5lYWNoKFtcInRvcFwiLFwibGVmdFwiXSxmdW5jdGlvbihlLG4pe2IuY3NzSG9va3Nbbl09e2dldDpmdW5jdGlvbihlLHIpe3JldHVybiByPyhyPVd0KGUsbiksWXQudGVzdChyKT9iKGUpLnBvc2l0aW9uKClbbl0rXCJweFwiOnIpOnR9fX0pfSksYi5leHByJiZiLmV4cHIuZmlsdGVycyYmKGIuZXhwci5maWx0ZXJzLmhpZGRlbj1mdW5jdGlvbihlKXtyZXR1cm4gMD49ZS5vZmZzZXRXaWR0aCYmMD49ZS5vZmZzZXRIZWlnaHR8fCFiLnN1cHBvcnQucmVsaWFibGVIaWRkZW5PZmZzZXRzJiZcIm5vbmVcIj09PShlLnN0eWxlJiZlLnN0eWxlLmRpc3BsYXl8fGIuY3NzKGUsXCJkaXNwbGF5XCIpKX0sYi5leHByLmZpbHRlcnMudmlzaWJsZT1mdW5jdGlvbihlKXtyZXR1cm4hYi5leHByLmZpbHRlcnMuaGlkZGVuKGUpfSksYi5lYWNoKHttYXJnaW46XCJcIixwYWRkaW5nOlwiXCIsYm9yZGVyOlwiV2lkdGhcIn0sZnVuY3Rpb24oZSx0KXtiLmNzc0hvb2tzW2UrdF09e2V4cGFuZDpmdW5jdGlvbihuKXt2YXIgcj0wLGk9e30sbz1cInN0cmluZ1wiPT10eXBlb2Ygbj9uLnNwbGl0KFwiIFwiKTpbbl07Zm9yKDs0PnI7cisrKWlbZStadFtyXSt0XT1vW3JdfHxvW3ItMl18fG9bMF07cmV0dXJuIGl9fSxVdC50ZXN0KGUpfHwoYi5jc3NIb29rc1tlK3RdLnNldD1vbil9KTt2YXIgY249LyUyMC9nLHBuPS9cXFtcXF0kLyxmbj0vXFxyP1xcbi9nLGRuPS9eKD86c3VibWl0fGJ1dHRvbnxpbWFnZXxyZXNldHxmaWxlKSQvaSxobj0vXig/OmlucHV0fHNlbGVjdHx0ZXh0YXJlYXxrZXlnZW4pL2k7Yi5mbi5leHRlbmQoe3NlcmlhbGl6ZTpmdW5jdGlvbigpe3JldHVybiBiLnBhcmFtKHRoaXMuc2VyaWFsaXplQXJyYXkoKSl9LHNlcmlhbGl6ZUFycmF5OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKCl7dmFyIGU9Yi5wcm9wKHRoaXMsXCJlbGVtZW50c1wiKTtyZXR1cm4gZT9iLm1ha2VBcnJheShlKTp0aGlzfSkuZmlsdGVyKGZ1bmN0aW9uKCl7dmFyIGU9dGhpcy50eXBlO3JldHVybiB0aGlzLm5hbWUmJiFiKHRoaXMpLmlzKFwiOmRpc2FibGVkXCIpJiZobi50ZXN0KHRoaXMubm9kZU5hbWUpJiYhZG4udGVzdChlKSYmKHRoaXMuY2hlY2tlZHx8IU50LnRlc3QoZSkpfSkubWFwKGZ1bmN0aW9uKGUsdCl7dmFyIG49Yih0aGlzKS52YWwoKTtyZXR1cm4gbnVsbD09bj9udWxsOmIuaXNBcnJheShuKT9iLm1hcChuLGZ1bmN0aW9uKGUpe3JldHVybntuYW1lOnQubmFtZSx2YWx1ZTplLnJlcGxhY2UoZm4sXCJcXHJcXG5cIil9fSk6e25hbWU6dC5uYW1lLHZhbHVlOm4ucmVwbGFjZShmbixcIlxcclxcblwiKX19KS5nZXQoKX19KSxiLnBhcmFtPWZ1bmN0aW9uKGUsbil7dmFyIHIsaT1bXSxvPWZ1bmN0aW9uKGUsdCl7dD1iLmlzRnVuY3Rpb24odCk/dCgpOm51bGw9PXQ/XCJcIjp0LGlbaS5sZW5ndGhdPWVuY29kZVVSSUNvbXBvbmVudChlKStcIj1cIitlbmNvZGVVUklDb21wb25lbnQodCl9O2lmKG49PT10JiYobj1iLmFqYXhTZXR0aW5ncyYmYi5hamF4U2V0dGluZ3MudHJhZGl0aW9uYWwpLGIuaXNBcnJheShlKXx8ZS5qcXVlcnkmJiFiLmlzUGxhaW5PYmplY3QoZSkpYi5lYWNoKGUsZnVuY3Rpb24oKXtvKHRoaXMubmFtZSx0aGlzLnZhbHVlKX0pO2Vsc2UgZm9yKHIgaW4gZSlnbihyLGVbcl0sbixvKTtyZXR1cm4gaS5qb2luKFwiJlwiKS5yZXBsYWNlKGNuLFwiK1wiKX07ZnVuY3Rpb24gZ24oZSx0LG4scil7dmFyIGk7aWYoYi5pc0FycmF5KHQpKWIuZWFjaCh0LGZ1bmN0aW9uKHQsaSl7bnx8cG4udGVzdChlKT9yKGUsaSk6Z24oZStcIltcIisoXCJvYmplY3RcIj09dHlwZW9mIGk/dDpcIlwiKStcIl1cIixpLG4scil9KTtlbHNlIGlmKG58fFwib2JqZWN0XCIhPT1iLnR5cGUodCkpcihlLHQpO2Vsc2UgZm9yKGkgaW4gdClnbihlK1wiW1wiK2krXCJdXCIsdFtpXSxuLHIpfWIuZWFjaChcImJsdXIgZm9jdXMgZm9jdXNpbiBmb2N1c291dCBsb2FkIHJlc2l6ZSBzY3JvbGwgdW5sb2FkIGNsaWNrIGRibGNsaWNrIG1vdXNlZG93biBtb3VzZXVwIG1vdXNlbW92ZSBtb3VzZW92ZXIgbW91c2VvdXQgbW91c2VlbnRlciBtb3VzZWxlYXZlIGNoYW5nZSBzZWxlY3Qgc3VibWl0IGtleWRvd24ga2V5cHJlc3Mga2V5dXAgZXJyb3IgY29udGV4dG1lbnVcIi5zcGxpdChcIiBcIiksZnVuY3Rpb24oZSx0KXtiLmZuW3RdPWZ1bmN0aW9uKGUsbil7cmV0dXJuIGFyZ3VtZW50cy5sZW5ndGg+MD90aGlzLm9uKHQsbnVsbCxlLG4pOnRoaXMudHJpZ2dlcih0KX19KSxiLmZuLmhvdmVyPWZ1bmN0aW9uKGUsdCl7cmV0dXJuIHRoaXMubW91c2VlbnRlcihlKS5tb3VzZWxlYXZlKHR8fGUpfTt2YXIgbW4seW4sdm49Yi5ub3coKSxibj0vXFw/Lyx4bj0vIy4qJC8sd249LyhbPyZdKV89W14mXSovLFRuPS9eKC4qPyk6WyBcXHRdKihbXlxcclxcbl0qKVxccj8kL2dtLE5uPS9eKD86YWJvdXR8YXBwfGFwcC1zdG9yYWdlfC4rLWV4dGVuc2lvbnxmaWxlfHJlc3x3aWRnZXQpOiQvLENuPS9eKD86R0VUfEhFQUQpJC8sa249L15cXC9cXC8vLEVuPS9eKFtcXHcuKy1dKzopKD86XFwvXFwvKFteXFwvPyM6XSopKD86OihcXGQrKXwpfCkvLFNuPWIuZm4ubG9hZCxBbj17fSxqbj17fSxEbj1cIiovXCIuY29uY2F0KFwiKlwiKTt0cnl7eW49YS5ocmVmfWNhdGNoKExuKXt5bj1vLmNyZWF0ZUVsZW1lbnQoXCJhXCIpLHluLmhyZWY9XCJcIix5bj15bi5ocmVmfW1uPUVuLmV4ZWMoeW4udG9Mb3dlckNhc2UoKSl8fFtdO2Z1bmN0aW9uIEhuKGUpe3JldHVybiBmdW5jdGlvbih0LG4pe1wic3RyaW5nXCIhPXR5cGVvZiB0JiYobj10LHQ9XCIqXCIpO3ZhciByLGk9MCxvPXQudG9Mb3dlckNhc2UoKS5tYXRjaCh3KXx8W107aWYoYi5pc0Z1bmN0aW9uKG4pKXdoaWxlKHI9b1tpKytdKVwiK1wiPT09clswXT8ocj1yLnNsaWNlKDEpfHxcIipcIiwoZVtyXT1lW3JdfHxbXSkudW5zaGlmdChuKSk6KGVbcl09ZVtyXXx8W10pLnB1c2gobil9fWZ1bmN0aW9uIHFuKGUsbixyLGkpe3ZhciBvPXt9LGE9ZT09PWpuO2Z1bmN0aW9uIHModSl7dmFyIGw7cmV0dXJuIG9bdV09ITAsYi5lYWNoKGVbdV18fFtdLGZ1bmN0aW9uKGUsdSl7dmFyIGM9dShuLHIsaSk7cmV0dXJuXCJzdHJpbmdcIiE9dHlwZW9mIGN8fGF8fG9bY10/YT8hKGw9Yyk6dDoobi5kYXRhVHlwZXMudW5zaGlmdChjKSxzKGMpLCExKX0pLGx9cmV0dXJuIHMobi5kYXRhVHlwZXNbMF0pfHwhb1tcIipcIl0mJnMoXCIqXCIpfWZ1bmN0aW9uIE1uKGUsbil7dmFyIHIsaSxvPWIuYWpheFNldHRpbmdzLmZsYXRPcHRpb25zfHx7fTtmb3IoaSBpbiBuKW5baV0hPT10JiYoKG9baV0/ZTpyfHwocj17fSkpW2ldPW5baV0pO3JldHVybiByJiZiLmV4dGVuZCghMCxlLHIpLGV9Yi5mbi5sb2FkPWZ1bmN0aW9uKGUsbixyKXtpZihcInN0cmluZ1wiIT10eXBlb2YgZSYmU24pcmV0dXJuIFNuLmFwcGx5KHRoaXMsYXJndW1lbnRzKTt2YXIgaSxvLGEscz10aGlzLHU9ZS5pbmRleE9mKFwiIFwiKTtyZXR1cm4gdT49MCYmKGk9ZS5zbGljZSh1LGUubGVuZ3RoKSxlPWUuc2xpY2UoMCx1KSksYi5pc0Z1bmN0aW9uKG4pPyhyPW4sbj10KTpuJiZcIm9iamVjdFwiPT10eXBlb2YgbiYmKGE9XCJQT1NUXCIpLHMubGVuZ3RoPjAmJmIuYWpheCh7dXJsOmUsdHlwZTphLGRhdGFUeXBlOlwiaHRtbFwiLGRhdGE6bn0pLmRvbmUoZnVuY3Rpb24oZSl7bz1hcmd1bWVudHMscy5odG1sKGk/YihcIjxkaXY+XCIpLmFwcGVuZChiLnBhcnNlSFRNTChlKSkuZmluZChpKTplKX0pLmNvbXBsZXRlKHImJmZ1bmN0aW9uKGUsdCl7cy5lYWNoKHIsb3x8W2UucmVzcG9uc2VUZXh0LHQsZV0pfSksdGhpc30sYi5lYWNoKFtcImFqYXhTdGFydFwiLFwiYWpheFN0b3BcIixcImFqYXhDb21wbGV0ZVwiLFwiYWpheEVycm9yXCIsXCJhamF4U3VjY2Vzc1wiLFwiYWpheFNlbmRcIl0sZnVuY3Rpb24oZSx0KXtiLmZuW3RdPWZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLm9uKHQsZSl9fSksYi5lYWNoKFtcImdldFwiLFwicG9zdFwiXSxmdW5jdGlvbihlLG4pe2Jbbl09ZnVuY3Rpb24oZSxyLGksbyl7cmV0dXJuIGIuaXNGdW5jdGlvbihyKSYmKG89b3x8aSxpPXIscj10KSxiLmFqYXgoe3VybDplLHR5cGU6bixkYXRhVHlwZTpvLGRhdGE6cixzdWNjZXNzOml9KX19KSxiLmV4dGVuZCh7YWN0aXZlOjAsbGFzdE1vZGlmaWVkOnt9LGV0YWc6e30sYWpheFNldHRpbmdzOnt1cmw6eW4sdHlwZTpcIkdFVFwiLGlzTG9jYWw6Tm4udGVzdChtblsxXSksZ2xvYmFsOiEwLHByb2Nlc3NEYXRhOiEwLGFzeW5jOiEwLGNvbnRlbnRUeXBlOlwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04XCIsYWNjZXB0czp7XCIqXCI6RG4sdGV4dDpcInRleHQvcGxhaW5cIixodG1sOlwidGV4dC9odG1sXCIseG1sOlwiYXBwbGljYXRpb24veG1sLCB0ZXh0L3htbFwiLGpzb246XCJhcHBsaWNhdGlvbi9qc29uLCB0ZXh0L2phdmFzY3JpcHRcIn0sY29udGVudHM6e3htbDoveG1sLyxodG1sOi9odG1sLyxqc29uOi9qc29uL30scmVzcG9uc2VGaWVsZHM6e3htbDpcInJlc3BvbnNlWE1MXCIsdGV4dDpcInJlc3BvbnNlVGV4dFwifSxjb252ZXJ0ZXJzOntcIiogdGV4dFwiOmUuU3RyaW5nLFwidGV4dCBodG1sXCI6ITAsXCJ0ZXh0IGpzb25cIjpiLnBhcnNlSlNPTixcInRleHQgeG1sXCI6Yi5wYXJzZVhNTH0sZmxhdE9wdGlvbnM6e3VybDohMCxjb250ZXh0OiEwfX0sYWpheFNldHVwOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIHQ/TW4oTW4oZSxiLmFqYXhTZXR0aW5ncyksdCk6TW4oYi5hamF4U2V0dGluZ3MsZSl9LGFqYXhQcmVmaWx0ZXI6SG4oQW4pLGFqYXhUcmFuc3BvcnQ6SG4oam4pLGFqYXg6ZnVuY3Rpb24oZSxuKXtcIm9iamVjdFwiPT10eXBlb2YgZSYmKG49ZSxlPXQpLG49bnx8e307dmFyIHIsaSxvLGEscyx1LGwsYyxwPWIuYWpheFNldHVwKHt9LG4pLGY9cC5jb250ZXh0fHxwLGQ9cC5jb250ZXh0JiYoZi5ub2RlVHlwZXx8Zi5qcXVlcnkpP2IoZik6Yi5ldmVudCxoPWIuRGVmZXJyZWQoKSxnPWIuQ2FsbGJhY2tzKFwib25jZSBtZW1vcnlcIiksbT1wLnN0YXR1c0NvZGV8fHt9LHk9e30sdj17fSx4PTAsVD1cImNhbmNlbGVkXCIsTj17cmVhZHlTdGF0ZTowLGdldFJlc3BvbnNlSGVhZGVyOmZ1bmN0aW9uKGUpe3ZhciB0O2lmKDI9PT14KXtpZighYyl7Yz17fTt3aGlsZSh0PVRuLmV4ZWMoYSkpY1t0WzFdLnRvTG93ZXJDYXNlKCldPXRbMl19dD1jW2UudG9Mb3dlckNhc2UoKV19cmV0dXJuIG51bGw9PXQ/bnVsbDp0fSxnZXRBbGxSZXNwb25zZUhlYWRlcnM6ZnVuY3Rpb24oKXtyZXR1cm4gMj09PXg/YTpudWxsfSxzZXRSZXF1ZXN0SGVhZGVyOmZ1bmN0aW9uKGUsdCl7dmFyIG49ZS50b0xvd2VyQ2FzZSgpO3JldHVybiB4fHwoZT12W25dPXZbbl18fGUseVtlXT10KSx0aGlzfSxvdmVycmlkZU1pbWVUeXBlOmZ1bmN0aW9uKGUpe3JldHVybiB4fHwocC5taW1lVHlwZT1lKSx0aGlzfSxzdGF0dXNDb2RlOmZ1bmN0aW9uKGUpe3ZhciB0O2lmKGUpaWYoMj54KWZvcih0IGluIGUpbVt0XT1bbVt0XSxlW3RdXTtlbHNlIE4uYWx3YXlzKGVbTi5zdGF0dXNdKTtyZXR1cm4gdGhpc30sYWJvcnQ6ZnVuY3Rpb24oZSl7dmFyIHQ9ZXx8VDtyZXR1cm4gbCYmbC5hYm9ydCh0KSxrKDAsdCksdGhpc319O2lmKGgucHJvbWlzZShOKS5jb21wbGV0ZT1nLmFkZCxOLnN1Y2Nlc3M9Ti5kb25lLE4uZXJyb3I9Ti5mYWlsLHAudXJsPSgoZXx8cC51cmx8fHluKStcIlwiKS5yZXBsYWNlKHhuLFwiXCIpLnJlcGxhY2Uoa24sbW5bMV0rXCIvL1wiKSxwLnR5cGU9bi5tZXRob2R8fG4udHlwZXx8cC5tZXRob2R8fHAudHlwZSxwLmRhdGFUeXBlcz1iLnRyaW0ocC5kYXRhVHlwZXx8XCIqXCIpLnRvTG93ZXJDYXNlKCkubWF0Y2godyl8fFtcIlwiXSxudWxsPT1wLmNyb3NzRG9tYWluJiYocj1Fbi5leGVjKHAudXJsLnRvTG93ZXJDYXNlKCkpLHAuY3Jvc3NEb21haW49ISghcnx8clsxXT09PW1uWzFdJiZyWzJdPT09bW5bMl0mJihyWzNdfHwoXCJodHRwOlwiPT09clsxXT84MDo0NDMpKT09KG1uWzNdfHwoXCJodHRwOlwiPT09bW5bMV0/ODA6NDQzKSkpKSxwLmRhdGEmJnAucHJvY2Vzc0RhdGEmJlwic3RyaW5nXCIhPXR5cGVvZiBwLmRhdGEmJihwLmRhdGE9Yi5wYXJhbShwLmRhdGEscC50cmFkaXRpb25hbCkpLHFuKEFuLHAsbixOKSwyPT09eClyZXR1cm4gTjt1PXAuZ2xvYmFsLHUmJjA9PT1iLmFjdGl2ZSsrJiZiLmV2ZW50LnRyaWdnZXIoXCJhamF4U3RhcnRcIikscC50eXBlPXAudHlwZS50b1VwcGVyQ2FzZSgpLHAuaGFzQ29udGVudD0hQ24udGVzdChwLnR5cGUpLG89cC51cmwscC5oYXNDb250ZW50fHwocC5kYXRhJiYobz1wLnVybCs9KGJuLnRlc3Qobyk/XCImXCI6XCI/XCIpK3AuZGF0YSxkZWxldGUgcC5kYXRhKSxwLmNhY2hlPT09ITEmJihwLnVybD13bi50ZXN0KG8pP28ucmVwbGFjZSh3bixcIiQxXz1cIit2bisrKTpvKyhibi50ZXN0KG8pP1wiJlwiOlwiP1wiKStcIl89XCIrdm4rKykpLHAuaWZNb2RpZmllZCYmKGIubGFzdE1vZGlmaWVkW29dJiZOLnNldFJlcXVlc3RIZWFkZXIoXCJJZi1Nb2RpZmllZC1TaW5jZVwiLGIubGFzdE1vZGlmaWVkW29dKSxiLmV0YWdbb10mJk4uc2V0UmVxdWVzdEhlYWRlcihcIklmLU5vbmUtTWF0Y2hcIixiLmV0YWdbb10pKSwocC5kYXRhJiZwLmhhc0NvbnRlbnQmJnAuY29udGVudFR5cGUhPT0hMXx8bi5jb250ZW50VHlwZSkmJk4uc2V0UmVxdWVzdEhlYWRlcihcIkNvbnRlbnQtVHlwZVwiLHAuY29udGVudFR5cGUpLE4uc2V0UmVxdWVzdEhlYWRlcihcIkFjY2VwdFwiLHAuZGF0YVR5cGVzWzBdJiZwLmFjY2VwdHNbcC5kYXRhVHlwZXNbMF1dP3AuYWNjZXB0c1twLmRhdGFUeXBlc1swXV0rKFwiKlwiIT09cC5kYXRhVHlwZXNbMF0/XCIsIFwiK0RuK1wiOyBxPTAuMDFcIjpcIlwiKTpwLmFjY2VwdHNbXCIqXCJdKTtmb3IoaSBpbiBwLmhlYWRlcnMpTi5zZXRSZXF1ZXN0SGVhZGVyKGkscC5oZWFkZXJzW2ldKTtpZihwLmJlZm9yZVNlbmQmJihwLmJlZm9yZVNlbmQuY2FsbChmLE4scCk9PT0hMXx8Mj09PXgpKXJldHVybiBOLmFib3J0KCk7VD1cImFib3J0XCI7Zm9yKGkgaW57c3VjY2VzczoxLGVycm9yOjEsY29tcGxldGU6MX0pTltpXShwW2ldKTtpZihsPXFuKGpuLHAsbixOKSl7Ti5yZWFkeVN0YXRlPTEsdSYmZC50cmlnZ2VyKFwiYWpheFNlbmRcIixbTixwXSkscC5hc3luYyYmcC50aW1lb3V0PjAmJihzPXNldFRpbWVvdXQoZnVuY3Rpb24oKXtOLmFib3J0KFwidGltZW91dFwiKX0scC50aW1lb3V0KSk7dHJ5e3g9MSxsLnNlbmQoeSxrKX1jYXRjaChDKXtpZighKDI+eCkpdGhyb3cgQztrKC0xLEMpfX1lbHNlIGsoLTEsXCJObyBUcmFuc3BvcnRcIik7ZnVuY3Rpb24gayhlLG4scixpKXt2YXIgYyx5LHYsdyxULEM9bjsyIT09eCYmKHg9MixzJiZjbGVhclRpbWVvdXQocyksbD10LGE9aXx8XCJcIixOLnJlYWR5U3RhdGU9ZT4wPzQ6MCxyJiYodz1fbihwLE4scikpLGU+PTIwMCYmMzAwPmV8fDMwND09PWU/KHAuaWZNb2RpZmllZCYmKFQ9Ti5nZXRSZXNwb25zZUhlYWRlcihcIkxhc3QtTW9kaWZpZWRcIiksVCYmKGIubGFzdE1vZGlmaWVkW29dPVQpLFQ9Ti5nZXRSZXNwb25zZUhlYWRlcihcImV0YWdcIiksVCYmKGIuZXRhZ1tvXT1UKSksMjA0PT09ZT8oYz0hMCxDPVwibm9jb250ZW50XCIpOjMwND09PWU/KGM9ITAsQz1cIm5vdG1vZGlmaWVkXCIpOihjPUZuKHAsdyksQz1jLnN0YXRlLHk9Yy5kYXRhLHY9Yy5lcnJvcixjPSF2KSk6KHY9QywoZXx8IUMpJiYoQz1cImVycm9yXCIsMD5lJiYoZT0wKSkpLE4uc3RhdHVzPWUsTi5zdGF0dXNUZXh0PShufHxDKStcIlwiLGM/aC5yZXNvbHZlV2l0aChmLFt5LEMsTl0pOmgucmVqZWN0V2l0aChmLFtOLEMsdl0pLE4uc3RhdHVzQ29kZShtKSxtPXQsdSYmZC50cmlnZ2VyKGM/XCJhamF4U3VjY2Vzc1wiOlwiYWpheEVycm9yXCIsW04scCxjP3k6dl0pLGcuZmlyZVdpdGgoZixbTixDXSksdSYmKGQudHJpZ2dlcihcImFqYXhDb21wbGV0ZVwiLFtOLHBdKSwtLWIuYWN0aXZlfHxiLmV2ZW50LnRyaWdnZXIoXCJhamF4U3RvcFwiKSkpfXJldHVybiBOfSxnZXRTY3JpcHQ6ZnVuY3Rpb24oZSxuKXtyZXR1cm4gYi5nZXQoZSx0LG4sXCJzY3JpcHRcIil9LGdldEpTT046ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBiLmdldChlLHQsbixcImpzb25cIil9fSk7ZnVuY3Rpb24gX24oZSxuLHIpe3ZhciBpLG8sYSxzLHU9ZS5jb250ZW50cyxsPWUuZGF0YVR5cGVzLGM9ZS5yZXNwb25zZUZpZWxkcztmb3IocyBpbiBjKXMgaW4gciYmKG5bY1tzXV09cltzXSk7d2hpbGUoXCIqXCI9PT1sWzBdKWwuc2hpZnQoKSxvPT09dCYmKG89ZS5taW1lVHlwZXx8bi5nZXRSZXNwb25zZUhlYWRlcihcIkNvbnRlbnQtVHlwZVwiKSk7aWYobylmb3IocyBpbiB1KWlmKHVbc10mJnVbc10udGVzdChvKSl7bC51bnNoaWZ0KHMpO2JyZWFrfWlmKGxbMF1pbiByKWE9bFswXTtlbHNle2ZvcihzIGluIHIpe2lmKCFsWzBdfHxlLmNvbnZlcnRlcnNbcytcIiBcIitsWzBdXSl7YT1zO2JyZWFrfWl8fChpPXMpfWE9YXx8aX1yZXR1cm4gYT8oYSE9PWxbMF0mJmwudW5zaGlmdChhKSxyW2FdKTp0fWZ1bmN0aW9uIEZuKGUsdCl7dmFyIG4scixpLG8sYT17fSxzPTAsdT1lLmRhdGFUeXBlcy5zbGljZSgpLGw9dVswXTtpZihlLmRhdGFGaWx0ZXImJih0PWUuZGF0YUZpbHRlcih0LGUuZGF0YVR5cGUpKSx1WzFdKWZvcihpIGluIGUuY29udmVydGVycylhW2kudG9Mb3dlckNhc2UoKV09ZS5jb252ZXJ0ZXJzW2ldO2Zvcig7cj11Wysrc107KWlmKFwiKlwiIT09cil7aWYoXCIqXCIhPT1sJiZsIT09cil7aWYoaT1hW2wrXCIgXCIrcl18fGFbXCIqIFwiK3JdLCFpKWZvcihuIGluIGEpaWYobz1uLnNwbGl0KFwiIFwiKSxvWzFdPT09ciYmKGk9YVtsK1wiIFwiK29bMF1dfHxhW1wiKiBcIitvWzBdXSkpe2k9PT0hMD9pPWFbbl06YVtuXSE9PSEwJiYocj1vWzBdLHUuc3BsaWNlKHMtLSwwLHIpKTticmVha31pZihpIT09ITApaWYoaSYmZVtcInRocm93c1wiXSl0PWkodCk7ZWxzZSB0cnl7dD1pKHQpfWNhdGNoKGMpe3JldHVybntzdGF0ZTpcInBhcnNlcmVycm9yXCIsZXJyb3I6aT9jOlwiTm8gY29udmVyc2lvbiBmcm9tIFwiK2wrXCIgdG8gXCIrcn19fWw9cn1yZXR1cm57c3RhdGU6XCJzdWNjZXNzXCIsZGF0YTp0fX1iLmFqYXhTZXR1cCh7YWNjZXB0czp7c2NyaXB0OlwidGV4dC9qYXZhc2NyaXB0LCBhcHBsaWNhdGlvbi9qYXZhc2NyaXB0LCBhcHBsaWNhdGlvbi9lY21hc2NyaXB0LCBhcHBsaWNhdGlvbi94LWVjbWFzY3JpcHRcIn0sY29udGVudHM6e3NjcmlwdDovKD86amF2YXxlY21hKXNjcmlwdC99LGNvbnZlcnRlcnM6e1widGV4dCBzY3JpcHRcIjpmdW5jdGlvbihlKXtyZXR1cm4gYi5nbG9iYWxFdmFsKGUpLGV9fX0pLGIuYWpheFByZWZpbHRlcihcInNjcmlwdFwiLGZ1bmN0aW9uKGUpe2UuY2FjaGU9PT10JiYoZS5jYWNoZT0hMSksZS5jcm9zc0RvbWFpbiYmKGUudHlwZT1cIkdFVFwiLGUuZ2xvYmFsPSExKX0pLGIuYWpheFRyYW5zcG9ydChcInNjcmlwdFwiLGZ1bmN0aW9uKGUpe2lmKGUuY3Jvc3NEb21haW4pe3ZhciBuLHI9by5oZWFkfHxiKFwiaGVhZFwiKVswXXx8by5kb2N1bWVudEVsZW1lbnQ7cmV0dXJue3NlbmQ6ZnVuY3Rpb24odCxpKXtuPW8uY3JlYXRlRWxlbWVudChcInNjcmlwdFwiKSxuLmFzeW5jPSEwLGUuc2NyaXB0Q2hhcnNldCYmKG4uY2hhcnNldD1lLnNjcmlwdENoYXJzZXQpLG4uc3JjPWUudXJsLG4ub25sb2FkPW4ub25yZWFkeXN0YXRlY2hhbmdlPWZ1bmN0aW9uKGUsdCl7KHR8fCFuLnJlYWR5U3RhdGV8fC9sb2FkZWR8Y29tcGxldGUvLnRlc3Qobi5yZWFkeVN0YXRlKSkmJihuLm9ubG9hZD1uLm9ucmVhZHlzdGF0ZWNoYW5nZT1udWxsLG4ucGFyZW50Tm9kZSYmbi5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG4pLG49bnVsbCx0fHxpKDIwMCxcInN1Y2Nlc3NcIikpfSxyLmluc2VydEJlZm9yZShuLHIuZmlyc3RDaGlsZCl9LGFib3J0OmZ1bmN0aW9uKCl7biYmbi5vbmxvYWQodCwhMCl9fX19KTt2YXIgT249W10sQm49Lyg9KVxcPyg/PSZ8JCl8XFw/XFw/LztiLmFqYXhTZXR1cCh7anNvbnA6XCJjYWxsYmFja1wiLGpzb25wQ2FsbGJhY2s6ZnVuY3Rpb24oKXt2YXIgZT1Pbi5wb3AoKXx8Yi5leHBhbmRvK1wiX1wiK3ZuKys7cmV0dXJuIHRoaXNbZV09ITAsZX19KSxiLmFqYXhQcmVmaWx0ZXIoXCJqc29uIGpzb25wXCIsZnVuY3Rpb24obixyLGkpe3ZhciBvLGEscyx1PW4uanNvbnAhPT0hMSYmKEJuLnRlc3Qobi51cmwpP1widXJsXCI6XCJzdHJpbmdcIj09dHlwZW9mIG4uZGF0YSYmIShuLmNvbnRlbnRUeXBlfHxcIlwiKS5pbmRleE9mKFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCIpJiZCbi50ZXN0KG4uZGF0YSkmJlwiZGF0YVwiKTtyZXR1cm4gdXx8XCJqc29ucFwiPT09bi5kYXRhVHlwZXNbMF0/KG89bi5qc29ucENhbGxiYWNrPWIuaXNGdW5jdGlvbihuLmpzb25wQ2FsbGJhY2spP24uanNvbnBDYWxsYmFjaygpOm4uanNvbnBDYWxsYmFjayx1P25bdV09blt1XS5yZXBsYWNlKEJuLFwiJDFcIitvKTpuLmpzb25wIT09ITEmJihuLnVybCs9KGJuLnRlc3Qobi51cmwpP1wiJlwiOlwiP1wiKStuLmpzb25wK1wiPVwiK28pLG4uY29udmVydGVyc1tcInNjcmlwdCBqc29uXCJdPWZ1bmN0aW9uKCl7cmV0dXJuIHN8fGIuZXJyb3IobytcIiB3YXMgbm90IGNhbGxlZFwiKSxzWzBdfSxuLmRhdGFUeXBlc1swXT1cImpzb25cIixhPWVbb10sZVtvXT1mdW5jdGlvbigpe3M9YXJndW1lbnRzfSxpLmFsd2F5cyhmdW5jdGlvbigpe2Vbb109YSxuW29dJiYobi5qc29ucENhbGxiYWNrPXIuanNvbnBDYWxsYmFjayxPbi5wdXNoKG8pKSxzJiZiLmlzRnVuY3Rpb24oYSkmJmEoc1swXSkscz1hPXR9KSxcInNjcmlwdFwiKTp0fSk7dmFyIFBuLFJuLFduPTAsJG49ZS5BY3RpdmVYT2JqZWN0JiZmdW5jdGlvbigpe3ZhciBlO2ZvcihlIGluIFBuKVBuW2VdKHQsITApfTtmdW5jdGlvbiBJbigpe3RyeXtyZXR1cm4gbmV3IGUuWE1MSHR0cFJlcXVlc3R9Y2F0Y2godCl7fX1mdW5jdGlvbiB6bigpe3RyeXtyZXR1cm4gbmV3IGUuQWN0aXZlWE9iamVjdChcIk1pY3Jvc29mdC5YTUxIVFRQXCIpfWNhdGNoKHQpe319Yi5hamF4U2V0dGluZ3MueGhyPWUuQWN0aXZlWE9iamVjdD9mdW5jdGlvbigpe3JldHVybiF0aGlzLmlzTG9jYWwmJkluKCl8fHpuKCl9OkluLFJuPWIuYWpheFNldHRpbmdzLnhocigpLGIuc3VwcG9ydC5jb3JzPSEhUm4mJlwid2l0aENyZWRlbnRpYWxzXCJpbiBSbixSbj1iLnN1cHBvcnQuYWpheD0hIVJuLFJuJiZiLmFqYXhUcmFuc3BvcnQoZnVuY3Rpb24obil7aWYoIW4uY3Jvc3NEb21haW58fGIuc3VwcG9ydC5jb3JzKXt2YXIgcjtyZXR1cm57c2VuZDpmdW5jdGlvbihpLG8pe3ZhciBhLHMsdT1uLnhocigpO2lmKG4udXNlcm5hbWU/dS5vcGVuKG4udHlwZSxuLnVybCxuLmFzeW5jLG4udXNlcm5hbWUsbi5wYXNzd29yZCk6dS5vcGVuKG4udHlwZSxuLnVybCxuLmFzeW5jKSxuLnhockZpZWxkcylmb3IocyBpbiBuLnhockZpZWxkcyl1W3NdPW4ueGhyRmllbGRzW3NdO24ubWltZVR5cGUmJnUub3ZlcnJpZGVNaW1lVHlwZSYmdS5vdmVycmlkZU1pbWVUeXBlKG4ubWltZVR5cGUpLG4uY3Jvc3NEb21haW58fGlbXCJYLVJlcXVlc3RlZC1XaXRoXCJdfHwoaVtcIlgtUmVxdWVzdGVkLVdpdGhcIl09XCJYTUxIdHRwUmVxdWVzdFwiKTt0cnl7Zm9yKHMgaW4gaSl1LnNldFJlcXVlc3RIZWFkZXIocyxpW3NdKX1jYXRjaChsKXt9dS5zZW5kKG4uaGFzQ29udGVudCYmbi5kYXRhfHxudWxsKSxyPWZ1bmN0aW9uKGUsaSl7dmFyIHMsbCxjLHA7dHJ5e2lmKHImJihpfHw0PT09dS5yZWFkeVN0YXRlKSlpZihyPXQsYSYmKHUub25yZWFkeXN0YXRlY2hhbmdlPWIubm9vcCwkbiYmZGVsZXRlIFBuW2FdKSxpKTQhPT11LnJlYWR5U3RhdGUmJnUuYWJvcnQoKTtlbHNle3A9e30scz11LnN0YXR1cyxsPXUuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCksXCJzdHJpbmdcIj09dHlwZW9mIHUucmVzcG9uc2VUZXh0JiYocC50ZXh0PXUucmVzcG9uc2VUZXh0KTt0cnl7Yz11LnN0YXR1c1RleHR9Y2F0Y2goZil7Yz1cIlwifXN8fCFuLmlzTG9jYWx8fG4uY3Jvc3NEb21haW4/MTIyMz09PXMmJihzPTIwNCk6cz1wLnRleHQ/MjAwOjQwNH19Y2F0Y2goZCl7aXx8bygtMSxkKX1wJiZvKHMsYyxwLGwpfSxuLmFzeW5jPzQ9PT11LnJlYWR5U3RhdGU/c2V0VGltZW91dChyKTooYT0rK1duLCRuJiYoUG58fChQbj17fSxiKGUpLnVubG9hZCgkbikpLFBuW2FdPXIpLHUub25yZWFkeXN0YXRlY2hhbmdlPXIpOnIoKX0sYWJvcnQ6ZnVuY3Rpb24oKXtyJiZyKHQsITApfX19fSk7dmFyIFhuLFVuLFZuPS9eKD86dG9nZ2xlfHNob3d8aGlkZSkkLyxZbj1SZWdFeHAoXCJeKD86KFsrLV0pPXwpKFwiK3grXCIpKFthLXolXSopJFwiLFwiaVwiKSxKbj0vcXVldWVIb29rcyQvLEduPVtucl0sUW49e1wiKlwiOltmdW5jdGlvbihlLHQpe3ZhciBuLHIsaT10aGlzLmNyZWF0ZVR3ZWVuKGUsdCksbz1Zbi5leGVjKHQpLGE9aS5jdXIoKSxzPSthfHwwLHU9MSxsPTIwO2lmKG8pe2lmKG49K29bMl0scj1vWzNdfHwoYi5jc3NOdW1iZXJbZV0/XCJcIjpcInB4XCIpLFwicHhcIiE9PXImJnMpe3M9Yi5jc3MoaS5lbGVtLGUsITApfHxufHwxO2RvIHU9dXx8XCIuNVwiLHMvPXUsYi5zdHlsZShpLmVsZW0sZSxzK3IpO3doaWxlKHUhPT0odT1pLmN1cigpL2EpJiYxIT09dSYmLS1sKX1pLnVuaXQ9cixpLnN0YXJ0PXMsaS5lbmQ9b1sxXT9zKyhvWzFdKzEpKm46bn1yZXR1cm4gaX1dfTtmdW5jdGlvbiBLbigpe3JldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7WG49dH0pLFhuPWIubm93KCl9ZnVuY3Rpb24gWm4oZSx0KXtiLmVhY2godCxmdW5jdGlvbih0LG4pe3ZhciByPShRblt0XXx8W10pLmNvbmNhdChRbltcIipcIl0pLGk9MCxvPXIubGVuZ3RoO2Zvcig7bz5pO2krKylpZihyW2ldLmNhbGwoZSx0LG4pKXJldHVybn0pfWZ1bmN0aW9uIGVyKGUsdCxuKXt2YXIgcixpLG89MCxhPUduLmxlbmd0aCxzPWIuRGVmZXJyZWQoKS5hbHdheXMoZnVuY3Rpb24oKXtkZWxldGUgdS5lbGVtfSksdT1mdW5jdGlvbigpe2lmKGkpcmV0dXJuITE7dmFyIHQ9WG58fEtuKCksbj1NYXRoLm1heCgwLGwuc3RhcnRUaW1lK2wuZHVyYXRpb24tdCkscj1uL2wuZHVyYXRpb258fDAsbz0xLXIsYT0wLHU9bC50d2VlbnMubGVuZ3RoO2Zvcig7dT5hO2ErKylsLnR3ZWVuc1thXS5ydW4obyk7cmV0dXJuIHMubm90aWZ5V2l0aChlLFtsLG8sbl0pLDE+byYmdT9uOihzLnJlc29sdmVXaXRoKGUsW2xdKSwhMSl9LGw9cy5wcm9taXNlKHtlbGVtOmUscHJvcHM6Yi5leHRlbmQoe30sdCksb3B0czpiLmV4dGVuZCghMCx7c3BlY2lhbEVhc2luZzp7fX0sbiksb3JpZ2luYWxQcm9wZXJ0aWVzOnQsb3JpZ2luYWxPcHRpb25zOm4sc3RhcnRUaW1lOlhufHxLbigpLGR1cmF0aW9uOm4uZHVyYXRpb24sdHdlZW5zOltdLGNyZWF0ZVR3ZWVuOmZ1bmN0aW9uKHQsbil7dmFyIHI9Yi5Ud2VlbihlLGwub3B0cyx0LG4sbC5vcHRzLnNwZWNpYWxFYXNpbmdbdF18fGwub3B0cy5lYXNpbmcpO3JldHVybiBsLnR3ZWVucy5wdXNoKHIpLHJ9LHN0b3A6ZnVuY3Rpb24odCl7dmFyIG49MCxyPXQ/bC50d2VlbnMubGVuZ3RoOjA7aWYoaSlyZXR1cm4gdGhpcztmb3IoaT0hMDtyPm47bisrKWwudHdlZW5zW25dLnJ1bigxKTtyZXR1cm4gdD9zLnJlc29sdmVXaXRoKGUsW2wsdF0pOnMucmVqZWN0V2l0aChlLFtsLHRdKSx0aGlzfX0pLGM9bC5wcm9wcztmb3IodHIoYyxsLm9wdHMuc3BlY2lhbEVhc2luZyk7YT5vO28rKylpZihyPUduW29dLmNhbGwobCxlLGMsbC5vcHRzKSlyZXR1cm4gcjtyZXR1cm4gWm4obCxjKSxiLmlzRnVuY3Rpb24obC5vcHRzLnN0YXJ0KSYmbC5vcHRzLnN0YXJ0LmNhbGwoZSxsKSxiLmZ4LnRpbWVyKGIuZXh0ZW5kKHUse2VsZW06ZSxhbmltOmwscXVldWU6bC5vcHRzLnF1ZXVlfSkpLGwucHJvZ3Jlc3MobC5vcHRzLnByb2dyZXNzKS5kb25lKGwub3B0cy5kb25lLGwub3B0cy5jb21wbGV0ZSkuZmFpbChsLm9wdHMuZmFpbCkuYWx3YXlzKGwub3B0cy5hbHdheXMpfWZ1bmN0aW9uIHRyKGUsdCl7dmFyIG4scixpLG8sYTtmb3IoaSBpbiBlKWlmKHI9Yi5jYW1lbENhc2UoaSksbz10W3JdLG49ZVtpXSxiLmlzQXJyYXkobikmJihvPW5bMV0sbj1lW2ldPW5bMF0pLGkhPT1yJiYoZVtyXT1uLGRlbGV0ZSBlW2ldKSxhPWIuY3NzSG9va3Nbcl0sYSYmXCJleHBhbmRcImluIGEpe249YS5leHBhbmQobiksZGVsZXRlIGVbcl07Zm9yKGkgaW4gbilpIGluIGV8fChlW2ldPW5baV0sdFtpXT1vKX1lbHNlIHRbcl09b31iLkFuaW1hdGlvbj1iLmV4dGVuZChlcix7dHdlZW5lcjpmdW5jdGlvbihlLHQpe2IuaXNGdW5jdGlvbihlKT8odD1lLGU9W1wiKlwiXSk6ZT1lLnNwbGl0KFwiIFwiKTt2YXIgbixyPTAsaT1lLmxlbmd0aDtmb3IoO2k+cjtyKyspbj1lW3JdLFFuW25dPVFuW25dfHxbXSxRbltuXS51bnNoaWZ0KHQpfSxwcmVmaWx0ZXI6ZnVuY3Rpb24oZSx0KXt0P0duLnVuc2hpZnQoZSk6R24ucHVzaChlKX19KTtmdW5jdGlvbiBucihlLHQsbil7dmFyIHIsaSxvLGEscyx1LGwsYyxwLGY9dGhpcyxkPWUuc3R5bGUsaD17fSxnPVtdLG09ZS5ub2RlVHlwZSYmbm4oZSk7bi5xdWV1ZXx8KGM9Yi5fcXVldWVIb29rcyhlLFwiZnhcIiksbnVsbD09Yy51bnF1ZXVlZCYmKGMudW5xdWV1ZWQ9MCxwPWMuZW1wdHkuZmlyZSxjLmVtcHR5LmZpcmU9ZnVuY3Rpb24oKXtjLnVucXVldWVkfHxwKCl9KSxjLnVucXVldWVkKyssZi5hbHdheXMoZnVuY3Rpb24oKXtmLmFsd2F5cyhmdW5jdGlvbigpe2MudW5xdWV1ZWQtLSxiLnF1ZXVlKGUsXCJmeFwiKS5sZW5ndGh8fGMuZW1wdHkuZmlyZSgpfSl9KSksMT09PWUubm9kZVR5cGUmJihcImhlaWdodFwiaW4gdHx8XCJ3aWR0aFwiaW4gdCkmJihuLm92ZXJmbG93PVtkLm92ZXJmbG93LGQub3ZlcmZsb3dYLGQub3ZlcmZsb3dZXSxcImlubGluZVwiPT09Yi5jc3MoZSxcImRpc3BsYXlcIikmJlwibm9uZVwiPT09Yi5jc3MoZSxcImZsb2F0XCIpJiYoYi5zdXBwb3J0LmlubGluZUJsb2NrTmVlZHNMYXlvdXQmJlwiaW5saW5lXCIhPT11bihlLm5vZGVOYW1lKT9kLnpvb209MTpkLmRpc3BsYXk9XCJpbmxpbmUtYmxvY2tcIikpLG4ub3ZlcmZsb3cmJihkLm92ZXJmbG93PVwiaGlkZGVuXCIsYi5zdXBwb3J0LnNocmlua1dyYXBCbG9ja3N8fGYuYWx3YXlzKGZ1bmN0aW9uKCl7ZC5vdmVyZmxvdz1uLm92ZXJmbG93WzBdLGQub3ZlcmZsb3dYPW4ub3ZlcmZsb3dbMV0sZC5vdmVyZmxvd1k9bi5vdmVyZmxvd1syXX0pKTtmb3IoaSBpbiB0KWlmKGE9dFtpXSxWbi5leGVjKGEpKXtpZihkZWxldGUgdFtpXSx1PXV8fFwidG9nZ2xlXCI9PT1hLGE9PT0obT9cImhpZGVcIjpcInNob3dcIikpY29udGludWU7Zy5wdXNoKGkpfWlmKG89Zy5sZW5ndGgpe3M9Yi5fZGF0YShlLFwiZnhzaG93XCIpfHxiLl9kYXRhKGUsXCJmeHNob3dcIix7fSksXCJoaWRkZW5cImluIHMmJihtPXMuaGlkZGVuKSx1JiYocy5oaWRkZW49IW0pLG0/YihlKS5zaG93KCk6Zi5kb25lKGZ1bmN0aW9uKCl7YihlKS5oaWRlKCl9KSxmLmRvbmUoZnVuY3Rpb24oKXt2YXIgdDtiLl9yZW1vdmVEYXRhKGUsXCJmeHNob3dcIik7Zm9yKHQgaW4gaCliLnN0eWxlKGUsdCxoW3RdKX0pO2ZvcihpPTA7bz5pO2krKylyPWdbaV0sbD1mLmNyZWF0ZVR3ZWVuKHIsbT9zW3JdOjApLGhbcl09c1tyXXx8Yi5zdHlsZShlLHIpLHIgaW4gc3x8KHNbcl09bC5zdGFydCxtJiYobC5lbmQ9bC5zdGFydCxsLnN0YXJ0PVwid2lkdGhcIj09PXJ8fFwiaGVpZ2h0XCI9PT1yPzE6MCkpfX1mdW5jdGlvbiBycihlLHQsbixyLGkpe3JldHVybiBuZXcgcnIucHJvdG90eXBlLmluaXQoZSx0LG4scixpKX1iLlR3ZWVuPXJyLHJyLnByb3RvdHlwZT17Y29uc3RydWN0b3I6cnIsaW5pdDpmdW5jdGlvbihlLHQsbixyLGksbyl7dGhpcy5lbGVtPWUsdGhpcy5wcm9wPW4sdGhpcy5lYXNpbmc9aXx8XCJzd2luZ1wiLHRoaXMub3B0aW9ucz10LHRoaXMuc3RhcnQ9dGhpcy5ub3c9dGhpcy5jdXIoKSx0aGlzLmVuZD1yLHRoaXMudW5pdD1vfHwoYi5jc3NOdW1iZXJbbl0/XCJcIjpcInB4XCIpfSxjdXI6ZnVuY3Rpb24oKXt2YXIgZT1yci5wcm9wSG9va3NbdGhpcy5wcm9wXTtyZXR1cm4gZSYmZS5nZXQ/ZS5nZXQodGhpcyk6cnIucHJvcEhvb2tzLl9kZWZhdWx0LmdldCh0aGlzKX0scnVuOmZ1bmN0aW9uKGUpe3ZhciB0LG49cnIucHJvcEhvb2tzW3RoaXMucHJvcF07cmV0dXJuIHRoaXMucG9zPXQ9dGhpcy5vcHRpb25zLmR1cmF0aW9uP2IuZWFzaW5nW3RoaXMuZWFzaW5nXShlLHRoaXMub3B0aW9ucy5kdXJhdGlvbiplLDAsMSx0aGlzLm9wdGlvbnMuZHVyYXRpb24pOmUsdGhpcy5ub3c9KHRoaXMuZW5kLXRoaXMuc3RhcnQpKnQrdGhpcy5zdGFydCx0aGlzLm9wdGlvbnMuc3RlcCYmdGhpcy5vcHRpb25zLnN0ZXAuY2FsbCh0aGlzLmVsZW0sdGhpcy5ub3csdGhpcyksbiYmbi5zZXQ/bi5zZXQodGhpcyk6cnIucHJvcEhvb2tzLl9kZWZhdWx0LnNldCh0aGlzKSx0aGlzfX0scnIucHJvdG90eXBlLmluaXQucHJvdG90eXBlPXJyLnByb3RvdHlwZSxyci5wcm9wSG9va3M9e19kZWZhdWx0OntnZXQ6ZnVuY3Rpb24oZSl7dmFyIHQ7cmV0dXJuIG51bGw9PWUuZWxlbVtlLnByb3BdfHxlLmVsZW0uc3R5bGUmJm51bGwhPWUuZWxlbS5zdHlsZVtlLnByb3BdPyh0PWIuY3NzKGUuZWxlbSxlLnByb3AsXCJcIiksdCYmXCJhdXRvXCIhPT10P3Q6MCk6ZS5lbGVtW2UucHJvcF19LHNldDpmdW5jdGlvbihlKXtiLmZ4LnN0ZXBbZS5wcm9wXT9iLmZ4LnN0ZXBbZS5wcm9wXShlKTplLmVsZW0uc3R5bGUmJihudWxsIT1lLmVsZW0uc3R5bGVbYi5jc3NQcm9wc1tlLnByb3BdXXx8Yi5jc3NIb29rc1tlLnByb3BdKT9iLnN0eWxlKGUuZWxlbSxlLnByb3AsZS5ub3crZS51bml0KTplLmVsZW1bZS5wcm9wXT1lLm5vd319fSxyci5wcm9wSG9va3Muc2Nyb2xsVG9wPXJyLnByb3BIb29rcy5zY3JvbGxMZWZ0PXtzZXQ6ZnVuY3Rpb24oZSl7ZS5lbGVtLm5vZGVUeXBlJiZlLmVsZW0ucGFyZW50Tm9kZSYmKGUuZWxlbVtlLnByb3BdPWUubm93KX19LGIuZWFjaChbXCJ0b2dnbGVcIixcInNob3dcIixcImhpZGVcIl0sZnVuY3Rpb24oZSx0KXt2YXIgbj1iLmZuW3RdO2IuZm5bdF09ZnVuY3Rpb24oZSxyLGkpe3JldHVybiBudWxsPT1lfHxcImJvb2xlYW5cIj09dHlwZW9mIGU/bi5hcHBseSh0aGlzLGFyZ3VtZW50cyk6dGhpcy5hbmltYXRlKGlyKHQsITApLGUscixpKX19KSxiLmZuLmV4dGVuZCh7ZmFkZVRvOmZ1bmN0aW9uKGUsdCxuLHIpe3JldHVybiB0aGlzLmZpbHRlcihubikuY3NzKFwib3BhY2l0eVwiLDApLnNob3coKS5lbmQoKS5hbmltYXRlKHtvcGFjaXR5OnR9LGUsbixyKX0sYW5pbWF0ZTpmdW5jdGlvbihlLHQsbixyKXt2YXIgaT1iLmlzRW1wdHlPYmplY3QoZSksbz1iLnNwZWVkKHQsbixyKSxhPWZ1bmN0aW9uKCl7dmFyIHQ9ZXIodGhpcyxiLmV4dGVuZCh7fSxlKSxvKTthLmZpbmlzaD1mdW5jdGlvbigpe3Quc3RvcCghMCl9LChpfHxiLl9kYXRhKHRoaXMsXCJmaW5pc2hcIikpJiZ0LnN0b3AoITApfTtyZXR1cm4gYS5maW5pc2g9YSxpfHxvLnF1ZXVlPT09ITE/dGhpcy5lYWNoKGEpOnRoaXMucXVldWUoby5xdWV1ZSxhKX0sc3RvcDpmdW5jdGlvbihlLG4scil7dmFyIGk9ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5zdG9wO2RlbGV0ZSBlLnN0b3AsdChyKX07cmV0dXJuXCJzdHJpbmdcIiE9dHlwZW9mIGUmJihyPW4sbj1lLGU9dCksbiYmZSE9PSExJiZ0aGlzLnF1ZXVlKGV8fFwiZnhcIixbXSksdGhpcy5lYWNoKGZ1bmN0aW9uKCl7dmFyIHQ9ITAsbj1udWxsIT1lJiZlK1wicXVldWVIb29rc1wiLG89Yi50aW1lcnMsYT1iLl9kYXRhKHRoaXMpO2lmKG4pYVtuXSYmYVtuXS5zdG9wJiZpKGFbbl0pO2Vsc2UgZm9yKG4gaW4gYSlhW25dJiZhW25dLnN0b3AmJkpuLnRlc3QobikmJmkoYVtuXSk7Zm9yKG49by5sZW5ndGg7bi0tOylvW25dLmVsZW0hPT10aGlzfHxudWxsIT1lJiZvW25dLnF1ZXVlIT09ZXx8KG9bbl0uYW5pbS5zdG9wKHIpLHQ9ITEsby5zcGxpY2UobiwxKSk7KHR8fCFyKSYmYi5kZXF1ZXVlKHRoaXMsZSl9KX0sZmluaXNoOmZ1bmN0aW9uKGUpe3JldHVybiBlIT09ITEmJihlPWV8fFwiZnhcIiksdGhpcy5lYWNoKGZ1bmN0aW9uKCl7dmFyIHQsbj1iLl9kYXRhKHRoaXMpLHI9bltlK1wicXVldWVcIl0saT1uW2UrXCJxdWV1ZUhvb2tzXCJdLG89Yi50aW1lcnMsYT1yP3IubGVuZ3RoOjA7Zm9yKG4uZmluaXNoPSEwLGIucXVldWUodGhpcyxlLFtdKSxpJiZpLmN1ciYmaS5jdXIuZmluaXNoJiZpLmN1ci5maW5pc2guY2FsbCh0aGlzKSx0PW8ubGVuZ3RoO3QtLTspb1t0XS5lbGVtPT09dGhpcyYmb1t0XS5xdWV1ZT09PWUmJihvW3RdLmFuaW0uc3RvcCghMCksby5zcGxpY2UodCwxKSk7Zm9yKHQ9MDthPnQ7dCsrKXJbdF0mJnJbdF0uZmluaXNoJiZyW3RdLmZpbmlzaC5jYWxsKHRoaXMpO2RlbGV0ZSBuLmZpbmlzaH0pfX0pO2Z1bmN0aW9uIGlyKGUsdCl7dmFyIG4scj17aGVpZ2h0OmV9LGk9MDtmb3IodD10PzE6MDs0Pmk7aSs9Mi10KW49WnRbaV0scltcIm1hcmdpblwiK25dPXJbXCJwYWRkaW5nXCIrbl09ZTtyZXR1cm4gdCYmKHIub3BhY2l0eT1yLndpZHRoPWUpLHJ9Yi5lYWNoKHtzbGlkZURvd246aXIoXCJzaG93XCIpLHNsaWRlVXA6aXIoXCJoaWRlXCIpLHNsaWRlVG9nZ2xlOmlyKFwidG9nZ2xlXCIpLGZhZGVJbjp7b3BhY2l0eTpcInNob3dcIn0sZmFkZU91dDp7b3BhY2l0eTpcImhpZGVcIn0sZmFkZVRvZ2dsZTp7b3BhY2l0eTpcInRvZ2dsZVwifX0sZnVuY3Rpb24oZSx0KXtiLmZuW2VdPWZ1bmN0aW9uKGUsbixyKXtyZXR1cm4gdGhpcy5hbmltYXRlKHQsZSxuLHIpfX0pLGIuc3BlZWQ9ZnVuY3Rpb24oZSx0LG4pe3ZhciByPWUmJlwib2JqZWN0XCI9PXR5cGVvZiBlP2IuZXh0ZW5kKHt9LGUpOntjb21wbGV0ZTpufHwhbiYmdHx8Yi5pc0Z1bmN0aW9uKGUpJiZlLGR1cmF0aW9uOmUsZWFzaW5nOm4mJnR8fHQmJiFiLmlzRnVuY3Rpb24odCkmJnR9O3JldHVybiByLmR1cmF0aW9uPWIuZngub2ZmPzA6XCJudW1iZXJcIj09dHlwZW9mIHIuZHVyYXRpb24/ci5kdXJhdGlvbjpyLmR1cmF0aW9uIGluIGIuZnguc3BlZWRzP2IuZnguc3BlZWRzW3IuZHVyYXRpb25dOmIuZnguc3BlZWRzLl9kZWZhdWx0LChudWxsPT1yLnF1ZXVlfHxyLnF1ZXVlPT09ITApJiYoci5xdWV1ZT1cImZ4XCIpLHIub2xkPXIuY29tcGxldGUsci5jb21wbGV0ZT1mdW5jdGlvbigpe2IuaXNGdW5jdGlvbihyLm9sZCkmJnIub2xkLmNhbGwodGhpcyksci5xdWV1ZSYmYi5kZXF1ZXVlKHRoaXMsci5xdWV1ZSl9LHJ9LGIuZWFzaW5nPXtsaW5lYXI6ZnVuY3Rpb24oZSl7cmV0dXJuIGV9LHN3aW5nOmZ1bmN0aW9uKGUpe3JldHVybi41LU1hdGguY29zKGUqTWF0aC5QSSkvMn19LGIudGltZXJzPVtdLGIuZng9cnIucHJvdG90eXBlLmluaXQsYi5meC50aWNrPWZ1bmN0aW9uKCl7dmFyIGUsbj1iLnRpbWVycyxyPTA7Zm9yKFhuPWIubm93KCk7bi5sZW5ndGg+cjtyKyspZT1uW3JdLGUoKXx8bltyXSE9PWV8fG4uc3BsaWNlKHItLSwxKTtuLmxlbmd0aHx8Yi5meC5zdG9wKCksWG49dH0sYi5meC50aW1lcj1mdW5jdGlvbihlKXtlKCkmJmIudGltZXJzLnB1c2goZSkmJmIuZnguc3RhcnQoKX0sYi5meC5pbnRlcnZhbD0xMyxiLmZ4LnN0YXJ0PWZ1bmN0aW9uKCl7VW58fChVbj1zZXRJbnRlcnZhbChiLmZ4LnRpY2ssYi5meC5pbnRlcnZhbCkpfSxiLmZ4LnN0b3A9ZnVuY3Rpb24oKXtjbGVhckludGVydmFsKFVuKSxVbj1udWxsfSxiLmZ4LnNwZWVkcz17c2xvdzo2MDAsZmFzdDoyMDAsX2RlZmF1bHQ6NDAwfSxiLmZ4LnN0ZXA9e30sYi5leHByJiZiLmV4cHIuZmlsdGVycyYmKGIuZXhwci5maWx0ZXJzLmFuaW1hdGVkPWZ1bmN0aW9uKGUpe3JldHVybiBiLmdyZXAoYi50aW1lcnMsZnVuY3Rpb24odCl7cmV0dXJuIGU9PT10LmVsZW19KS5sZW5ndGh9KSxiLmZuLm9mZnNldD1mdW5jdGlvbihlKXtpZihhcmd1bWVudHMubGVuZ3RoKXJldHVybiBlPT09dD90aGlzOnRoaXMuZWFjaChmdW5jdGlvbih0KXtiLm9mZnNldC5zZXRPZmZzZXQodGhpcyxlLHQpfSk7dmFyIG4scixvPXt0b3A6MCxsZWZ0OjB9LGE9dGhpc1swXSxzPWEmJmEub3duZXJEb2N1bWVudDtpZihzKXJldHVybiBuPXMuZG9jdW1lbnRFbGVtZW50LGIuY29udGFpbnMobixhKT8odHlwZW9mIGEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0IT09aSYmKG89YS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSkscj1vcihzKSx7dG9wOm8udG9wKyhyLnBhZ2VZT2Zmc2V0fHxuLnNjcm9sbFRvcCktKG4uY2xpZW50VG9wfHwwKSxsZWZ0Om8ubGVmdCsoci5wYWdlWE9mZnNldHx8bi5zY3JvbGxMZWZ0KS0obi5jbGllbnRMZWZ0fHwwKX0pOm99LGIub2Zmc2V0PXtzZXRPZmZzZXQ6ZnVuY3Rpb24oZSx0LG4pe3ZhciByPWIuY3NzKGUsXCJwb3NpdGlvblwiKTtcInN0YXRpY1wiPT09ciYmKGUuc3R5bGUucG9zaXRpb249XCJyZWxhdGl2ZVwiKTt2YXIgaT1iKGUpLG89aS5vZmZzZXQoKSxhPWIuY3NzKGUsXCJ0b3BcIikscz1iLmNzcyhlLFwibGVmdFwiKSx1PShcImFic29sdXRlXCI9PT1yfHxcImZpeGVkXCI9PT1yKSYmYi5pbkFycmF5KFwiYXV0b1wiLFthLHNdKT4tMSxsPXt9LGM9e30scCxmO3U/KGM9aS5wb3NpdGlvbigpLHA9Yy50b3AsZj1jLmxlZnQpOihwPXBhcnNlRmxvYXQoYSl8fDAsZj1wYXJzZUZsb2F0KHMpfHwwKSxiLmlzRnVuY3Rpb24odCkmJih0PXQuY2FsbChlLG4sbykpLG51bGwhPXQudG9wJiYobC50b3A9dC50b3Atby50b3ArcCksbnVsbCE9dC5sZWZ0JiYobC5sZWZ0PXQubGVmdC1vLmxlZnQrZiksXCJ1c2luZ1wiaW4gdD90LnVzaW5nLmNhbGwoZSxsKTppLmNzcyhsKX19LGIuZm4uZXh0ZW5kKHtwb3NpdGlvbjpmdW5jdGlvbigpe2lmKHRoaXNbMF0pe3ZhciBlLHQsbj17dG9wOjAsbGVmdDowfSxyPXRoaXNbMF07cmV0dXJuXCJmaXhlZFwiPT09Yi5jc3MocixcInBvc2l0aW9uXCIpP3Q9ci5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTooZT10aGlzLm9mZnNldFBhcmVudCgpLHQ9dGhpcy5vZmZzZXQoKSxiLm5vZGVOYW1lKGVbMF0sXCJodG1sXCIpfHwobj1lLm9mZnNldCgpKSxuLnRvcCs9Yi5jc3MoZVswXSxcImJvcmRlclRvcFdpZHRoXCIsITApLG4ubGVmdCs9Yi5jc3MoZVswXSxcImJvcmRlckxlZnRXaWR0aFwiLCEwKSkse3RvcDp0LnRvcC1uLnRvcC1iLmNzcyhyLFwibWFyZ2luVG9wXCIsITApLGxlZnQ6dC5sZWZ0LW4ubGVmdC1iLmNzcyhyLFwibWFyZ2luTGVmdFwiLCEwKX19fSxvZmZzZXRQYXJlbnQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24oKXt2YXIgZT10aGlzLm9mZnNldFBhcmVudHx8by5kb2N1bWVudEVsZW1lbnQ7d2hpbGUoZSYmIWIubm9kZU5hbWUoZSxcImh0bWxcIikmJlwic3RhdGljXCI9PT1iLmNzcyhlLFwicG9zaXRpb25cIikpZT1lLm9mZnNldFBhcmVudDtyZXR1cm4gZXx8by5kb2N1bWVudEVsZW1lbnR9KX19KSxiLmVhY2goe3Njcm9sbExlZnQ6XCJwYWdlWE9mZnNldFwiLHNjcm9sbFRvcDpcInBhZ2VZT2Zmc2V0XCJ9LGZ1bmN0aW9uKGUsbil7dmFyIHI9L1kvLnRlc3Qobik7Yi5mbltlXT1mdW5jdGlvbihpKXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxmdW5jdGlvbihlLGksbyl7dmFyIGE9b3IoZSk7cmV0dXJuIG89PT10P2E/biBpbiBhP2Fbbl06YS5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnRbaV06ZVtpXTooYT9hLnNjcm9sbFRvKHI/YihhKS5zY3JvbGxMZWZ0KCk6byxyP286YihhKS5zY3JvbGxUb3AoKSk6ZVtpXT1vLHQpfSxlLGksYXJndW1lbnRzLmxlbmd0aCxudWxsKX19KTtmdW5jdGlvbiBvcihlKXtyZXR1cm4gYi5pc1dpbmRvdyhlKT9lOjk9PT1lLm5vZGVUeXBlP2UuZGVmYXVsdFZpZXd8fGUucGFyZW50V2luZG93OiExfWIuZWFjaCh7SGVpZ2h0OlwiaGVpZ2h0XCIsV2lkdGg6XCJ3aWR0aFwifSxmdW5jdGlvbihlLG4pe2IuZWFjaCh7cGFkZGluZzpcImlubmVyXCIrZSxjb250ZW50Om4sXCJcIjpcIm91dGVyXCIrZX0sZnVuY3Rpb24ocixpKXtiLmZuW2ldPWZ1bmN0aW9uKGksbyl7dmFyIGE9YXJndW1lbnRzLmxlbmd0aCYmKHJ8fFwiYm9vbGVhblwiIT10eXBlb2YgaSkscz1yfHwoaT09PSEwfHxvPT09ITA/XCJtYXJnaW5cIjpcImJvcmRlclwiKTtyZXR1cm4gYi5hY2Nlc3ModGhpcyxmdW5jdGlvbihuLHIsaSl7dmFyIG87cmV0dXJuIGIuaXNXaW5kb3cobik/bi5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnRbXCJjbGllbnRcIitlXTo5PT09bi5ub2RlVHlwZT8obz1uLmRvY3VtZW50RWxlbWVudCxNYXRoLm1heChuLmJvZHlbXCJzY3JvbGxcIitlXSxvW1wic2Nyb2xsXCIrZV0sbi5ib2R5W1wib2Zmc2V0XCIrZV0sb1tcIm9mZnNldFwiK2VdLG9bXCJjbGllbnRcIitlXSkpOmk9PT10P2IuY3NzKG4scixzKTpiLnN0eWxlKG4scixpLHMpfSxuLGE/aTp0LGEsbnVsbCl9fSl9KSxlLmpRdWVyeT1lLiQ9YixcImZ1bmN0aW9uXCI9PXR5cGVvZiBkZWZpbmUmJmRlZmluZS5hbWQmJmRlZmluZS5hbWQualF1ZXJ5JiZkZWZpbmUoXCJqcXVlcnlcIixbXSxmdW5jdGlvbigpe3JldHVybiBifSl9KSh3aW5kb3cpOyIsIi8qZ2xvYmFsIGRlZmluZTpmYWxzZSAqL1xuLyoqXG4gKiBDb3B5cmlnaHQgMjAxMyBDcmFpZyBDYW1wYmVsbFxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICpcbiAqIE1vdXNldHJhcCBpcyBhIHNpbXBsZSBrZXlib2FyZCBzaG9ydGN1dCBsaWJyYXJ5IGZvciBKYXZhc2NyaXB0IHdpdGhcbiAqIG5vIGV4dGVybmFsIGRlcGVuZGVuY2llc1xuICpcbiAqIEB2ZXJzaW9uIDEuNC42XG4gKiBAdXJsIGNyYWlnLmlzL2tpbGxpbmcvbWljZVxuICovXG4oZnVuY3Rpb24od2luZG93LCBkb2N1bWVudCwgdW5kZWZpbmVkKSB7XG5cbiAgICAvKipcbiAgICAgKiBtYXBwaW5nIG9mIHNwZWNpYWwga2V5Y29kZXMgdG8gdGhlaXIgY29ycmVzcG9uZGluZyBrZXlzXG4gICAgICpcbiAgICAgKiBldmVyeXRoaW5nIGluIHRoaXMgZGljdGlvbmFyeSBjYW5ub3QgdXNlIGtleXByZXNzIGV2ZW50c1xuICAgICAqIHNvIGl0IGhhcyB0byBiZSBoZXJlIHRvIG1hcCB0byB0aGUgY29ycmVjdCBrZXljb2RlcyBmb3JcbiAgICAgKiBrZXl1cC9rZXlkb3duIGV2ZW50c1xuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB2YXIgX01BUCA9IHtcbiAgICAgICAgICAgIDg6ICdiYWNrc3BhY2UnLFxuICAgICAgICAgICAgOTogJ3RhYicsXG4gICAgICAgICAgICAxMzogJ2VudGVyJyxcbiAgICAgICAgICAgIDE2OiAnc2hpZnQnLFxuICAgICAgICAgICAgMTc6ICdjdHJsJyxcbiAgICAgICAgICAgIDE4OiAnYWx0JyxcbiAgICAgICAgICAgIDIwOiAnY2Fwc2xvY2snLFxuICAgICAgICAgICAgMjc6ICdlc2MnLFxuICAgICAgICAgICAgMzI6ICdzcGFjZScsXG4gICAgICAgICAgICAzMzogJ3BhZ2V1cCcsXG4gICAgICAgICAgICAzNDogJ3BhZ2Vkb3duJyxcbiAgICAgICAgICAgIDM1OiAnZW5kJyxcbiAgICAgICAgICAgIDM2OiAnaG9tZScsXG4gICAgICAgICAgICAzNzogJ2xlZnQnLFxuICAgICAgICAgICAgMzg6ICd1cCcsXG4gICAgICAgICAgICAzOTogJ3JpZ2h0JyxcbiAgICAgICAgICAgIDQwOiAnZG93bicsXG4gICAgICAgICAgICA0NTogJ2lucycsXG4gICAgICAgICAgICA0NjogJ2RlbCcsXG4gICAgICAgICAgICA5MTogJ21ldGEnLFxuICAgICAgICAgICAgOTM6ICdtZXRhJyxcbiAgICAgICAgICAgIDIyNDogJ21ldGEnXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIG1hcHBpbmcgZm9yIHNwZWNpYWwgY2hhcmFjdGVycyBzbyB0aGV5IGNhbiBzdXBwb3J0XG4gICAgICAgICAqXG4gICAgICAgICAqIHRoaXMgZGljdGlvbmFyeSBpcyBvbmx5IHVzZWQgaW5jYXNlIHlvdSB3YW50IHRvIGJpbmQgYVxuICAgICAgICAgKiBrZXl1cCBvciBrZXlkb3duIGV2ZW50IHRvIG9uZSBvZiB0aGVzZSBrZXlzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBfS0VZQ09ERV9NQVAgPSB7XG4gICAgICAgICAgICAxMDY6ICcqJyxcbiAgICAgICAgICAgIDEwNzogJysnLFxuICAgICAgICAgICAgMTA5OiAnLScsXG4gICAgICAgICAgICAxMTA6ICcuJyxcbiAgICAgICAgICAgIDExMSA6ICcvJyxcbiAgICAgICAgICAgIDE4NjogJzsnLFxuICAgICAgICAgICAgMTg3OiAnPScsXG4gICAgICAgICAgICAxODg6ICcsJyxcbiAgICAgICAgICAgIDE4OTogJy0nLFxuICAgICAgICAgICAgMTkwOiAnLicsXG4gICAgICAgICAgICAxOTE6ICcvJyxcbiAgICAgICAgICAgIDE5MjogJ2AnLFxuICAgICAgICAgICAgMjE5OiAnWycsXG4gICAgICAgICAgICAyMjA6ICdcXFxcJyxcbiAgICAgICAgICAgIDIyMTogJ10nLFxuICAgICAgICAgICAgMjIyOiAnXFwnJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB0aGlzIGlzIGEgbWFwcGluZyBvZiBrZXlzIHRoYXQgcmVxdWlyZSBzaGlmdCBvbiBhIFVTIGtleXBhZFxuICAgICAgICAgKiBiYWNrIHRvIHRoZSBub24gc2hpZnQgZXF1aXZlbGVudHNcbiAgICAgICAgICpcbiAgICAgICAgICogdGhpcyBpcyBzbyB5b3UgY2FuIHVzZSBrZXl1cCBldmVudHMgd2l0aCB0aGVzZSBrZXlzXG4gICAgICAgICAqXG4gICAgICAgICAqIG5vdGUgdGhhdCB0aGlzIHdpbGwgb25seSB3b3JrIHJlbGlhYmx5IG9uIFVTIGtleWJvYXJkc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX1NISUZUX01BUCA9IHtcbiAgICAgICAgICAgICd+JzogJ2AnLFxuICAgICAgICAgICAgJyEnOiAnMScsXG4gICAgICAgICAgICAnQCc6ICcyJyxcbiAgICAgICAgICAgICcjJzogJzMnLFxuICAgICAgICAgICAgJyQnOiAnNCcsXG4gICAgICAgICAgICAnJSc6ICc1JyxcbiAgICAgICAgICAgICdeJzogJzYnLFxuICAgICAgICAgICAgJyYnOiAnNycsXG4gICAgICAgICAgICAnKic6ICc4JyxcbiAgICAgICAgICAgICcoJzogJzknLFxuICAgICAgICAgICAgJyknOiAnMCcsXG4gICAgICAgICAgICAnXyc6ICctJyxcbiAgICAgICAgICAgICcrJzogJz0nLFxuICAgICAgICAgICAgJzonOiAnOycsXG4gICAgICAgICAgICAnXFxcIic6ICdcXCcnLFxuICAgICAgICAgICAgJzwnOiAnLCcsXG4gICAgICAgICAgICAnPic6ICcuJyxcbiAgICAgICAgICAgICc/JzogJy8nLFxuICAgICAgICAgICAgJ3wnOiAnXFxcXCdcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdGhpcyBpcyBhIGxpc3Qgb2Ygc3BlY2lhbCBzdHJpbmdzIHlvdSBjYW4gdXNlIHRvIG1hcFxuICAgICAgICAgKiB0byBtb2RpZmllciBrZXlzIHdoZW4geW91IHNwZWNpZnkgeW91ciBrZXlib2FyZCBzaG9ydGN1dHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIF9TUEVDSUFMX0FMSUFTRVMgPSB7XG4gICAgICAgICAgICAnb3B0aW9uJzogJ2FsdCcsXG4gICAgICAgICAgICAnY29tbWFuZCc6ICdtZXRhJyxcbiAgICAgICAgICAgICdyZXR1cm4nOiAnZW50ZXInLFxuICAgICAgICAgICAgJ2VzY2FwZSc6ICdlc2MnLFxuICAgICAgICAgICAgJ21vZCc6IC9NYWN8aVBvZHxpUGhvbmV8aVBhZC8udGVzdChuYXZpZ2F0b3IucGxhdGZvcm0pID8gJ21ldGEnIDogJ2N0cmwnXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHZhcmlhYmxlIHRvIHN0b3JlIHRoZSBmbGlwcGVkIHZlcnNpb24gb2YgX01BUCBmcm9tIGFib3ZlXG4gICAgICAgICAqIG5lZWRlZCB0byBjaGVjayBpZiB3ZSBzaG91bGQgdXNlIGtleXByZXNzIG9yIG5vdCB3aGVuIG5vIGFjdGlvblxuICAgICAgICAgKiBpcyBzcGVjaWZpZWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdHx1bmRlZmluZWR9XG4gICAgICAgICAqL1xuICAgICAgICBfUkVWRVJTRV9NQVAsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGEgbGlzdCBvZiBhbGwgdGhlIGNhbGxiYWNrcyBzZXR1cCB2aWEgTW91c2V0cmFwLmJpbmQoKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX2NhbGxiYWNrcyA9IHt9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBkaXJlY3QgbWFwIG9mIHN0cmluZyBjb21iaW5hdGlvbnMgdG8gY2FsbGJhY2tzIHVzZWQgZm9yIHRyaWdnZXIoKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX2RpcmVjdE1hcCA9IHt9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBrZWVwcyB0cmFjayBvZiB3aGF0IGxldmVsIGVhY2ggc2VxdWVuY2UgaXMgYXQgc2luY2UgbXVsdGlwbGVcbiAgICAgICAgICogc2VxdWVuY2VzIGNhbiBzdGFydCBvdXQgd2l0aCB0aGUgc2FtZSBzZXF1ZW5jZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX3NlcXVlbmNlTGV2ZWxzID0ge30sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHZhcmlhYmxlIHRvIHN0b3JlIHRoZSBzZXRUaW1lb3V0IGNhbGxcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bGx8bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgX3Jlc2V0VGltZXIsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRlbXBvcmFyeSBzdGF0ZSB3aGVyZSB3ZSB3aWxsIGlnbm9yZSB0aGUgbmV4dCBrZXl1cFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbnxzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBfaWdub3JlTmV4dEtleXVwID0gZmFsc2UsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRlbXBvcmFyeSBzdGF0ZSB3aGVyZSB3ZSB3aWxsIGlnbm9yZSB0aGUgbmV4dCBrZXlwcmVzc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICovXG4gICAgICAgIF9pZ25vcmVOZXh0S2V5cHJlc3MgPSBmYWxzZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogYXJlIHdlIGN1cnJlbnRseSBpbnNpZGUgb2YgYSBzZXF1ZW5jZT9cbiAgICAgICAgICogdHlwZSBvZiBhY3Rpb24gKFwia2V5dXBcIiBvciBcImtleWRvd25cIiBvciBcImtleXByZXNzXCIpIG9yIGZhbHNlXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufHN0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9uZXh0RXhwZWN0ZWRBY3Rpb24gPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIGxvb3AgdGhyb3VnaCB0aGUgZiBrZXlzLCBmMSB0byBmMTkgYW5kIGFkZCB0aGVtIHRvIHRoZSBtYXBcbiAgICAgKiBwcm9ncmFtYXRpY2FsbHlcbiAgICAgKi9cbiAgICBmb3IgKHZhciBpID0gMTsgaSA8IDIwOyArK2kpIHtcbiAgICAgICAgX01BUFsxMTEgKyBpXSA9ICdmJyArIGk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogbG9vcCB0aHJvdWdoIHRvIG1hcCBudW1iZXJzIG9uIHRoZSBudW1lcmljIGtleXBhZFxuICAgICAqL1xuICAgIGZvciAoaSA9IDA7IGkgPD0gOTsgKytpKSB7XG4gICAgICAgIF9NQVBbaSArIDk2XSA9IGk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY3Jvc3MgYnJvd3NlciBhZGQgZXZlbnQgbWV0aG9kXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnR8SFRNTERvY3VtZW50fSBvYmplY3RcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdHlwZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9hZGRFdmVudChvYmplY3QsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmIChvYmplY3QuYWRkRXZlbnRMaXN0ZW5lcikge1xuICAgICAgICAgICAgb2JqZWN0LmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgY2FsbGJhY2ssIGZhbHNlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIG9iamVjdC5hdHRhY2hFdmVudCgnb24nICsgdHlwZSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHRha2VzIHRoZSBldmVudCBhbmQgcmV0dXJucyB0aGUga2V5IGNoYXJhY3RlclxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfY2hhcmFjdGVyRnJvbUV2ZW50KGUpIHtcblxuICAgICAgICAvLyBmb3Iga2V5cHJlc3MgZXZlbnRzIHdlIHNob3VsZCByZXR1cm4gdGhlIGNoYXJhY3RlciBhcyBpc1xuICAgICAgICBpZiAoZS50eXBlID09ICdrZXlwcmVzcycpIHtcbiAgICAgICAgICAgIHZhciBjaGFyYWN0ZXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGUud2hpY2gpO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgc2hpZnQga2V5IGlzIG5vdCBwcmVzc2VkIHRoZW4gaXQgaXMgc2FmZSB0byBhc3N1bWVcbiAgICAgICAgICAgIC8vIHRoYXQgd2Ugd2FudCB0aGUgY2hhcmFjdGVyIHRvIGJlIGxvd2VyY2FzZS4gIHRoaXMgbWVhbnMgaWZcbiAgICAgICAgICAgIC8vIHlvdSBhY2NpZGVudGFsbHkgaGF2ZSBjYXBzIGxvY2sgb24gdGhlbiB5b3VyIGtleSBiaW5kaW5nc1xuICAgICAgICAgICAgLy8gd2lsbCBjb250aW51ZSB0byB3b3JrXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gdGhlIG9ubHkgc2lkZSBlZmZlY3QgdGhhdCBtaWdodCBub3QgYmUgZGVzaXJlZCBpcyBpZiB5b3VcbiAgICAgICAgICAgIC8vIGJpbmQgc29tZXRoaW5nIGxpa2UgJ0EnIGNhdXNlIHlvdSB3YW50IHRvIHRyaWdnZXIgYW5cbiAgICAgICAgICAgIC8vIGV2ZW50IHdoZW4gY2FwaXRhbCBBIGlzIHByZXNzZWQgY2FwcyBsb2NrIHdpbGwgbm8gbG9uZ2VyXG4gICAgICAgICAgICAvLyB0cmlnZ2VyIHRoZSBldmVudC4gIHNoaWZ0K2Egd2lsbCB0aG91Z2guXG4gICAgICAgICAgICBpZiAoIWUuc2hpZnRLZXkpIHtcbiAgICAgICAgICAgICAgICBjaGFyYWN0ZXIgPSBjaGFyYWN0ZXIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGNoYXJhY3RlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZvciBub24ga2V5cHJlc3MgZXZlbnRzIHRoZSBzcGVjaWFsIG1hcHMgYXJlIG5lZWRlZFxuICAgICAgICBpZiAoX01BUFtlLndoaWNoXSkge1xuICAgICAgICAgICAgcmV0dXJuIF9NQVBbZS53aGljaF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoX0tFWUNPREVfTUFQW2Uud2hpY2hdKSB7XG4gICAgICAgICAgICByZXR1cm4gX0tFWUNPREVfTUFQW2Uud2hpY2hdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgaXQgaXMgbm90IGluIHRoZSBzcGVjaWFsIG1hcFxuXG4gICAgICAgIC8vIHdpdGgga2V5ZG93biBhbmQga2V5dXAgZXZlbnRzIHRoZSBjaGFyYWN0ZXIgc2VlbXMgdG8gYWx3YXlzXG4gICAgICAgIC8vIGNvbWUgaW4gYXMgYW4gdXBwZXJjYXNlIGNoYXJhY3RlciB3aGV0aGVyIHlvdSBhcmUgcHJlc3Npbmcgc2hpZnRcbiAgICAgICAgLy8gb3Igbm90LiAgd2Ugc2hvdWxkIG1ha2Ugc3VyZSBpdCBpcyBhbHdheXMgbG93ZXJjYXNlIGZvciBjb21wYXJpc29uc1xuICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShlLndoaWNoKS50b0xvd2VyQ2FzZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNoZWNrcyBpZiB0d28gYXJyYXlzIGFyZSBlcXVhbFxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzMVxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vZGlmaWVyczJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfbW9kaWZpZXJzTWF0Y2gobW9kaWZpZXJzMSwgbW9kaWZpZXJzMikge1xuICAgICAgICByZXR1cm4gbW9kaWZpZXJzMS5zb3J0KCkuam9pbignLCcpID09PSBtb2RpZmllcnMyLnNvcnQoKS5qb2luKCcsJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmVzZXRzIGFsbCBzZXF1ZW5jZSBjb3VudGVycyBleGNlcHQgZm9yIHRoZSBvbmVzIHBhc3NlZCBpblxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGRvTm90UmVzZXRcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3Jlc2V0U2VxdWVuY2VzKGRvTm90UmVzZXQpIHtcbiAgICAgICAgZG9Ob3RSZXNldCA9IGRvTm90UmVzZXQgfHwge307XG5cbiAgICAgICAgdmFyIGFjdGl2ZVNlcXVlbmNlcyA9IGZhbHNlLFxuICAgICAgICAgICAga2V5O1xuXG4gICAgICAgIGZvciAoa2V5IGluIF9zZXF1ZW5jZUxldmVscykge1xuICAgICAgICAgICAgaWYgKGRvTm90UmVzZXRba2V5XSkge1xuICAgICAgICAgICAgICAgIGFjdGl2ZVNlcXVlbmNlcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBfc2VxdWVuY2VMZXZlbHNba2V5XSA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWFjdGl2ZVNlcXVlbmNlcykge1xuICAgICAgICAgICAgX25leHRFeHBlY3RlZEFjdGlvbiA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZmluZHMgYWxsIGNhbGxiYWNrcyB0aGF0IG1hdGNoIGJhc2VkIG9uIHRoZSBrZXljb2RlLCBtb2RpZmllcnMsXG4gICAgICogYW5kIGFjdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNoYXJhY3RlclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vZGlmaWVyc1xuICAgICAqIEBwYXJhbSB7RXZlbnR8T2JqZWN0fSBlXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBzZXF1ZW5jZU5hbWUgLSBuYW1lIG9mIHRoZSBzZXF1ZW5jZSB3ZSBhcmUgbG9va2luZyBmb3JcbiAgICAgKiBAcGFyYW0ge3N0cmluZz19IGNvbWJpbmF0aW9uXG4gICAgICogQHBhcmFtIHtudW1iZXI9fSBsZXZlbFxuICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZ2V0TWF0Y2hlcyhjaGFyYWN0ZXIsIG1vZGlmaWVycywgZSwgc2VxdWVuY2VOYW1lLCBjb21iaW5hdGlvbiwgbGV2ZWwpIHtcbiAgICAgICAgdmFyIGksXG4gICAgICAgICAgICBjYWxsYmFjayxcbiAgICAgICAgICAgIG1hdGNoZXMgPSBbXSxcbiAgICAgICAgICAgIGFjdGlvbiA9IGUudHlwZTtcblxuICAgICAgICAvLyBpZiB0aGVyZSBhcmUgbm8gZXZlbnRzIHJlbGF0ZWQgdG8gdGhpcyBrZXljb2RlXG4gICAgICAgIGlmICghX2NhbGxiYWNrc1tjaGFyYWN0ZXJdKSB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBhIG1vZGlmaWVyIGtleSBpcyBjb21pbmcgdXAgb24gaXRzIG93biB3ZSBzaG91bGQgYWxsb3cgaXRcbiAgICAgICAgaWYgKGFjdGlvbiA9PSAna2V5dXAnICYmIF9pc01vZGlmaWVyKGNoYXJhY3RlcikpIHtcbiAgICAgICAgICAgIG1vZGlmaWVycyA9IFtjaGFyYWN0ZXJdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGFsbCBjYWxsYmFja3MgZm9yIHRoZSBrZXkgdGhhdCB3YXMgcHJlc3NlZFxuICAgICAgICAvLyBhbmQgc2VlIGlmIGFueSBvZiB0aGVtIG1hdGNoXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBfY2FsbGJhY2tzW2NoYXJhY3Rlcl0ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gX2NhbGxiYWNrc1tjaGFyYWN0ZXJdW2ldO1xuXG4gICAgICAgICAgICAvLyBpZiBhIHNlcXVlbmNlIG5hbWUgaXMgbm90IHNwZWNpZmllZCwgYnV0IHRoaXMgaXMgYSBzZXF1ZW5jZSBhdFxuICAgICAgICAgICAgLy8gdGhlIHdyb25nIGxldmVsIHRoZW4gbW92ZSBvbnRvIHRoZSBuZXh0IG1hdGNoXG4gICAgICAgICAgICBpZiAoIXNlcXVlbmNlTmFtZSAmJiBjYWxsYmFjay5zZXEgJiYgX3NlcXVlbmNlTGV2ZWxzW2NhbGxiYWNrLnNlcV0gIT0gY2FsbGJhY2subGV2ZWwpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhlIGFjdGlvbiB3ZSBhcmUgbG9va2luZyBmb3IgZG9lc24ndCBtYXRjaCB0aGUgYWN0aW9uIHdlIGdvdFxuICAgICAgICAgICAgLy8gdGhlbiB3ZSBzaG91bGQga2VlcCBnb2luZ1xuICAgICAgICAgICAgaWYgKGFjdGlvbiAhPSBjYWxsYmFjay5hY3Rpb24pIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhpcyBpcyBhIGtleXByZXNzIGV2ZW50IGFuZCB0aGUgbWV0YSBrZXkgYW5kIGNvbnRyb2wga2V5XG4gICAgICAgICAgICAvLyBhcmUgbm90IHByZXNzZWQgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gb25seSBsb29rIGF0IHRoZVxuICAgICAgICAgICAgLy8gY2hhcmFjdGVyLCBvdGhlcndpc2UgY2hlY2sgdGhlIG1vZGlmaWVycyBhcyB3ZWxsXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gY2hyb21lIHdpbGwgbm90IGZpcmUgYSBrZXlwcmVzcyBpZiBtZXRhIG9yIGNvbnRyb2wgaXMgZG93blxuICAgICAgICAgICAgLy8gc2FmYXJpIHdpbGwgZmlyZSBhIGtleXByZXNzIGlmIG1ldGEgb3IgbWV0YStzaGlmdCBpcyBkb3duXG4gICAgICAgICAgICAvLyBmaXJlZm94IHdpbGwgZmlyZSBhIGtleXByZXNzIGlmIG1ldGEgb3IgY29udHJvbCBpcyBkb3duXG4gICAgICAgICAgICBpZiAoKGFjdGlvbiA9PSAna2V5cHJlc3MnICYmICFlLm1ldGFLZXkgJiYgIWUuY3RybEtleSkgfHwgX21vZGlmaWVyc01hdGNoKG1vZGlmaWVycywgY2FsbGJhY2subW9kaWZpZXJzKSkge1xuXG4gICAgICAgICAgICAgICAgLy8gd2hlbiB5b3UgYmluZCBhIGNvbWJpbmF0aW9uIG9yIHNlcXVlbmNlIGEgc2Vjb25kIHRpbWUgaXRcbiAgICAgICAgICAgICAgICAvLyBzaG91bGQgb3ZlcndyaXRlIHRoZSBmaXJzdCBvbmUuICBpZiBhIHNlcXVlbmNlTmFtZSBvclxuICAgICAgICAgICAgICAgIC8vIGNvbWJpbmF0aW9uIGlzIHNwZWNpZmllZCBpbiB0aGlzIGNhbGwgaXQgZG9lcyBqdXN0IHRoYXRcbiAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgIC8vIEB0b2RvIG1ha2UgZGVsZXRpbmcgaXRzIG93biBtZXRob2Q/XG4gICAgICAgICAgICAgICAgdmFyIGRlbGV0ZUNvbWJvID0gIXNlcXVlbmNlTmFtZSAmJiBjYWxsYmFjay5jb21ibyA9PSBjb21iaW5hdGlvbjtcbiAgICAgICAgICAgICAgICB2YXIgZGVsZXRlU2VxdWVuY2UgPSBzZXF1ZW5jZU5hbWUgJiYgY2FsbGJhY2suc2VxID09IHNlcXVlbmNlTmFtZSAmJiBjYWxsYmFjay5sZXZlbCA9PSBsZXZlbDtcbiAgICAgICAgICAgICAgICBpZiAoZGVsZXRlQ29tYm8gfHwgZGVsZXRlU2VxdWVuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgX2NhbGxiYWNrc1tjaGFyYWN0ZXJdLnNwbGljZShpLCAxKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtYXRjaGVzLnB1c2goY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1hdGNoZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdGFrZXMgYSBrZXkgZXZlbnQgYW5kIGZpZ3VyZXMgb3V0IHdoYXQgdGhlIG1vZGlmaWVycyBhcmVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2V2ZW50TW9kaWZpZXJzKGUpIHtcbiAgICAgICAgdmFyIG1vZGlmaWVycyA9IFtdO1xuXG4gICAgICAgIGlmIChlLnNoaWZ0S2V5KSB7XG4gICAgICAgICAgICBtb2RpZmllcnMucHVzaCgnc2hpZnQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlLmFsdEtleSkge1xuICAgICAgICAgICAgbW9kaWZpZXJzLnB1c2goJ2FsdCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGUuY3RybEtleSkge1xuICAgICAgICAgICAgbW9kaWZpZXJzLnB1c2goJ2N0cmwnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlLm1ldGFLZXkpIHtcbiAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKCdtZXRhJyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbW9kaWZpZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHByZXZlbnRzIGRlZmF1bHQgZm9yIHRoaXMgZXZlbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3ByZXZlbnREZWZhdWx0KGUpIHtcbiAgICAgICAgaWYgKGUucHJldmVudERlZmF1bHQpIHtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGUucmV0dXJuVmFsdWUgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBzdG9wcyBwcm9wb2dhdGlvbiBmb3IgdGhpcyBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfc3RvcFByb3BhZ2F0aW9uKGUpIHtcbiAgICAgICAgaWYgKGUuc3RvcFByb3BhZ2F0aW9uKSB7XG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZS5jYW5jZWxCdWJibGUgPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGFjdHVhbGx5IGNhbGxzIHRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAqXG4gICAgICogaWYgeW91ciBjYWxsYmFjayBmdW5jdGlvbiByZXR1cm5zIGZhbHNlIHRoaXMgd2lsbCB1c2UgdGhlIGpxdWVyeVxuICAgICAqIGNvbnZlbnRpb24gLSBwcmV2ZW50IGRlZmF1bHQgYW5kIHN0b3AgcHJvcG9nYXRpb24gb24gdGhlIGV2ZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2ZpcmVDYWxsYmFjayhjYWxsYmFjaywgZSwgY29tYm8sIHNlcXVlbmNlKSB7XG5cbiAgICAgICAgLy8gaWYgdGhpcyBldmVudCBzaG91bGQgbm90IGhhcHBlbiBzdG9wIGhlcmVcbiAgICAgICAgaWYgKE1vdXNldHJhcC5zdG9wQ2FsbGJhY2soZSwgZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50LCBjb21ibywgc2VxdWVuY2UpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2FsbGJhY2soZSwgY29tYm8pID09PSBmYWxzZSkge1xuICAgICAgICAgICAgX3ByZXZlbnREZWZhdWx0KGUpO1xuICAgICAgICAgICAgX3N0b3BQcm9wYWdhdGlvbihlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGhhbmRsZXMgYSBjaGFyYWN0ZXIga2V5IGV2ZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhcmFjdGVyXG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfaGFuZGxlS2V5KGNoYXJhY3RlciwgbW9kaWZpZXJzLCBlKSB7XG4gICAgICAgIHZhciBjYWxsYmFja3MgPSBfZ2V0TWF0Y2hlcyhjaGFyYWN0ZXIsIG1vZGlmaWVycywgZSksXG4gICAgICAgICAgICBpLFxuICAgICAgICAgICAgZG9Ob3RSZXNldCA9IHt9LFxuICAgICAgICAgICAgbWF4TGV2ZWwgPSAwLFxuICAgICAgICAgICAgcHJvY2Vzc2VkU2VxdWVuY2VDYWxsYmFjayA9IGZhbHNlO1xuXG4gICAgICAgIC8vIENhbGN1bGF0ZSB0aGUgbWF4TGV2ZWwgZm9yIHNlcXVlbmNlcyBzbyB3ZSBjYW4gb25seSBleGVjdXRlIHRoZSBsb25nZXN0IGNhbGxiYWNrIHNlcXVlbmNlXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChjYWxsYmFja3NbaV0uc2VxKSB7XG4gICAgICAgICAgICAgICAgbWF4TGV2ZWwgPSBNYXRoLm1heChtYXhMZXZlbCwgY2FsbGJhY2tzW2ldLmxldmVsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBtYXRjaGluZyBjYWxsYmFja3MgZm9yIHRoaXMga2V5IGV2ZW50XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyArK2kpIHtcblxuICAgICAgICAgICAgLy8gZmlyZSBmb3IgYWxsIHNlcXVlbmNlIGNhbGxiYWNrc1xuICAgICAgICAgICAgLy8gdGhpcyBpcyBiZWNhdXNlIGlmIGZvciBleGFtcGxlIHlvdSBoYXZlIG11bHRpcGxlIHNlcXVlbmNlc1xuICAgICAgICAgICAgLy8gYm91bmQgc3VjaCBhcyBcImcgaVwiIGFuZCBcImcgdFwiIHRoZXkgYm90aCBuZWVkIHRvIGZpcmUgdGhlXG4gICAgICAgICAgICAvLyBjYWxsYmFjayBmb3IgbWF0Y2hpbmcgZyBjYXVzZSBvdGhlcndpc2UgeW91IGNhbiBvbmx5IGV2ZXJcbiAgICAgICAgICAgIC8vIG1hdGNoIHRoZSBmaXJzdCBvbmVcbiAgICAgICAgICAgIGlmIChjYWxsYmFja3NbaV0uc2VxKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBvbmx5IGZpcmUgY2FsbGJhY2tzIGZvciB0aGUgbWF4TGV2ZWwgdG8gcHJldmVudFxuICAgICAgICAgICAgICAgIC8vIHN1YnNlcXVlbmNlcyBmcm9tIGFsc28gZmlyaW5nXG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAvLyBmb3IgZXhhbXBsZSAnYSBvcHRpb24gYicgc2hvdWxkIG5vdCBjYXVzZSAnb3B0aW9uIGInIHRvIGZpcmVcbiAgICAgICAgICAgICAgICAvLyBldmVuIHRob3VnaCAnb3B0aW9uIGInIGlzIHBhcnQgb2YgdGhlIG90aGVyIHNlcXVlbmNlXG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAvLyBhbnkgc2VxdWVuY2VzIHRoYXQgZG8gbm90IG1hdGNoIGhlcmUgd2lsbCBiZSBkaXNjYXJkZWRcbiAgICAgICAgICAgICAgICAvLyBiZWxvdyBieSB0aGUgX3Jlc2V0U2VxdWVuY2VzIGNhbGxcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2tzW2ldLmxldmVsICE9IG1heExldmVsKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHByb2Nlc3NlZFNlcXVlbmNlQ2FsbGJhY2sgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgLy8ga2VlcCBhIGxpc3Qgb2Ygd2hpY2ggc2VxdWVuY2VzIHdlcmUgbWF0Y2hlcyBmb3IgbGF0ZXJcbiAgICAgICAgICAgICAgICBkb05vdFJlc2V0W2NhbGxiYWNrc1tpXS5zZXFdID0gMTtcbiAgICAgICAgICAgICAgICBfZmlyZUNhbGxiYWNrKGNhbGxiYWNrc1tpXS5jYWxsYmFjaywgZSwgY2FsbGJhY2tzW2ldLmNvbWJvLCBjYWxsYmFja3NbaV0uc2VxKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhlcmUgd2VyZSBubyBzZXF1ZW5jZSBtYXRjaGVzIGJ1dCB3ZSBhcmUgc3RpbGwgaGVyZVxuICAgICAgICAgICAgLy8gdGhhdCBtZWFucyB0aGlzIGlzIGEgcmVndWxhciBtYXRjaCBzbyB3ZSBzaG91bGQgZmlyZSB0aGF0XG4gICAgICAgICAgICBpZiAoIXByb2Nlc3NlZFNlcXVlbmNlQ2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBfZmlyZUNhbGxiYWNrKGNhbGxiYWNrc1tpXS5jYWxsYmFjaywgZSwgY2FsbGJhY2tzW2ldLmNvbWJvKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIHRoZSBrZXkgeW91IHByZXNzZWQgbWF0Y2hlcyB0aGUgdHlwZSBvZiBzZXF1ZW5jZSB3aXRob3V0XG4gICAgICAgIC8vIGJlaW5nIGEgbW9kaWZpZXIgKGllIFwia2V5dXBcIiBvciBcImtleXByZXNzXCIpIHRoZW4gd2Ugc2hvdWxkXG4gICAgICAgIC8vIHJlc2V0IGFsbCBzZXF1ZW5jZXMgdGhhdCB3ZXJlIG5vdCBtYXRjaGVkIGJ5IHRoaXMgZXZlbnRcbiAgICAgICAgLy9cbiAgICAgICAgLy8gdGhpcyBpcyBzbywgZm9yIGV4YW1wbGUsIGlmIHlvdSBoYXZlIHRoZSBzZXF1ZW5jZSBcImggYSB0XCIgYW5kIHlvdVxuICAgICAgICAvLyB0eXBlIFwiaCBlIGEgciB0XCIgaXQgZG9lcyBub3QgbWF0Y2guICBpbiB0aGlzIGNhc2UgdGhlIFwiZVwiIHdpbGxcbiAgICAgICAgLy8gY2F1c2UgdGhlIHNlcXVlbmNlIHRvIHJlc2V0XG4gICAgICAgIC8vXG4gICAgICAgIC8vIG1vZGlmaWVyIGtleXMgYXJlIGlnbm9yZWQgYmVjYXVzZSB5b3UgY2FuIGhhdmUgYSBzZXF1ZW5jZVxuICAgICAgICAvLyB0aGF0IGNvbnRhaW5zIG1vZGlmaWVycyBzdWNoIGFzIFwiZW50ZXIgY3RybCtzcGFjZVwiIGFuZCBpbiBtb3N0XG4gICAgICAgIC8vIGNhc2VzIHRoZSBtb2RpZmllciBrZXkgd2lsbCBiZSBwcmVzc2VkIGJlZm9yZSB0aGUgbmV4dCBrZXlcbiAgICAgICAgLy9cbiAgICAgICAgLy8gYWxzbyBpZiB5b3UgaGF2ZSBhIHNlcXVlbmNlIHN1Y2ggYXMgXCJjdHJsK2IgYVwiIHRoZW4gcHJlc3NpbmcgdGhlXG4gICAgICAgIC8vIFwiYlwiIGtleSB3aWxsIHRyaWdnZXIgYSBcImtleXByZXNzXCIgYW5kIGEgXCJrZXlkb3duXCJcbiAgICAgICAgLy9cbiAgICAgICAgLy8gdGhlIFwia2V5ZG93blwiIGlzIGV4cGVjdGVkIHdoZW4gdGhlcmUgaXMgYSBtb2RpZmllciwgYnV0IHRoZVxuICAgICAgICAvLyBcImtleXByZXNzXCIgZW5kcyB1cCBtYXRjaGluZyB0aGUgX25leHRFeHBlY3RlZEFjdGlvbiBzaW5jZSBpdCBvY2N1cnNcbiAgICAgICAgLy8gYWZ0ZXIgYW5kIHRoYXQgY2F1c2VzIHRoZSBzZXF1ZW5jZSB0byByZXNldFxuICAgICAgICAvL1xuICAgICAgICAvLyB3ZSBpZ25vcmUga2V5cHJlc3NlcyBpbiBhIHNlcXVlbmNlIHRoYXQgZGlyZWN0bHkgZm9sbG93IGEga2V5ZG93blxuICAgICAgICAvLyBmb3IgdGhlIHNhbWUgY2hhcmFjdGVyXG4gICAgICAgIHZhciBpZ25vcmVUaGlzS2V5cHJlc3MgPSBlLnR5cGUgPT0gJ2tleXByZXNzJyAmJiBfaWdub3JlTmV4dEtleXByZXNzO1xuICAgICAgICBpZiAoZS50eXBlID09IF9uZXh0RXhwZWN0ZWRBY3Rpb24gJiYgIV9pc01vZGlmaWVyKGNoYXJhY3RlcikgJiYgIWlnbm9yZVRoaXNLZXlwcmVzcykge1xuICAgICAgICAgICAgX3Jlc2V0U2VxdWVuY2VzKGRvTm90UmVzZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgX2lnbm9yZU5leHRLZXlwcmVzcyA9IHByb2Nlc3NlZFNlcXVlbmNlQ2FsbGJhY2sgJiYgZS50eXBlID09ICdrZXlkb3duJztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBoYW5kbGVzIGEga2V5ZG93biBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfaGFuZGxlS2V5RXZlbnQoZSkge1xuXG4gICAgICAgIC8vIG5vcm1hbGl6ZSBlLndoaWNoIGZvciBrZXkgZXZlbnRzXG4gICAgICAgIC8vIEBzZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy80Mjg1NjI3L2phdmFzY3JpcHQta2V5Y29kZS12cy1jaGFyY29kZS11dHRlci1jb25mdXNpb25cbiAgICAgICAgaWYgKHR5cGVvZiBlLndoaWNoICE9PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgZS53aGljaCA9IGUua2V5Q29kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjaGFyYWN0ZXIgPSBfY2hhcmFjdGVyRnJvbUV2ZW50KGUpO1xuXG4gICAgICAgIC8vIG5vIGNoYXJhY3RlciBmb3VuZCB0aGVuIHN0b3BcbiAgICAgICAgaWYgKCFjaGFyYWN0ZXIpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG5lZWQgdG8gdXNlID09PSBmb3IgdGhlIGNoYXJhY3RlciBjaGVjayBiZWNhdXNlIHRoZSBjaGFyYWN0ZXIgY2FuIGJlIDBcbiAgICAgICAgaWYgKGUudHlwZSA9PSAna2V5dXAnICYmIF9pZ25vcmVOZXh0S2V5dXAgPT09IGNoYXJhY3Rlcikge1xuICAgICAgICAgICAgX2lnbm9yZU5leHRLZXl1cCA9IGZhbHNlO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgTW91c2V0cmFwLmhhbmRsZUtleShjaGFyYWN0ZXIsIF9ldmVudE1vZGlmaWVycyhlKSwgZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZGV0ZXJtaW5lcyBpZiB0aGUga2V5Y29kZSBzcGVjaWZpZWQgaXMgYSBtb2RpZmllciBrZXkgb3Igbm90XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5XG4gICAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2lzTW9kaWZpZXIoa2V5KSB7XG4gICAgICAgIHJldHVybiBrZXkgPT0gJ3NoaWZ0JyB8fCBrZXkgPT0gJ2N0cmwnIHx8IGtleSA9PSAnYWx0JyB8fCBrZXkgPT0gJ21ldGEnO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNhbGxlZCB0byBzZXQgYSAxIHNlY29uZCB0aW1lb3V0IG9uIHRoZSBzcGVjaWZpZWQgc2VxdWVuY2VcbiAgICAgKlxuICAgICAqIHRoaXMgaXMgc28gYWZ0ZXIgZWFjaCBrZXkgcHJlc3MgaW4gdGhlIHNlcXVlbmNlIHlvdSBoYXZlIDEgc2Vjb25kXG4gICAgICogdG8gcHJlc3MgdGhlIG5leHQga2V5IGJlZm9yZSB5b3UgaGF2ZSB0byBzdGFydCBvdmVyXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3Jlc2V0U2VxdWVuY2VUaW1lcigpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KF9yZXNldFRpbWVyKTtcbiAgICAgICAgX3Jlc2V0VGltZXIgPSBzZXRUaW1lb3V0KF9yZXNldFNlcXVlbmNlcywgMTAwMCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcmV2ZXJzZXMgdGhlIG1hcCBsb29rdXAgc28gdGhhdCB3ZSBjYW4gbG9vayBmb3Igc3BlY2lmaWMga2V5c1xuICAgICAqIHRvIHNlZSB3aGF0IGNhbiBhbmQgY2FuJ3QgdXNlIGtleXByZXNzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2dldFJldmVyc2VNYXAoKSB7XG4gICAgICAgIGlmICghX1JFVkVSU0VfTUFQKSB7XG4gICAgICAgICAgICBfUkVWRVJTRV9NQVAgPSB7fTtcbiAgICAgICAgICAgIGZvciAodmFyIGtleSBpbiBfTUFQKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBwdWxsIG91dCB0aGUgbnVtZXJpYyBrZXlwYWQgZnJvbSBoZXJlIGNhdXNlIGtleXByZXNzIHNob3VsZFxuICAgICAgICAgICAgICAgIC8vIGJlIGFibGUgdG8gZGV0ZWN0IHRoZSBrZXlzIGZyb20gdGhlIGNoYXJhY3RlclxuICAgICAgICAgICAgICAgIGlmIChrZXkgPiA5NSAmJiBrZXkgPCAxMTIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKF9NQVAuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgICAgICBfUkVWRVJTRV9NQVBbX01BUFtrZXldXSA9IGtleTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9SRVZFUlNFX01BUDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBwaWNrcyB0aGUgYmVzdCBhY3Rpb24gYmFzZWQgb24gdGhlIGtleSBjb21iaW5hdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIGNoYXJhY3RlciBmb3Iga2V5XG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb24gcGFzc2VkIGluXG4gICAgICovXG4gICAgZnVuY3Rpb24gX3BpY2tCZXN0QWN0aW9uKGtleSwgbW9kaWZpZXJzLCBhY3Rpb24pIHtcblxuICAgICAgICAvLyBpZiBubyBhY3Rpb24gd2FzIHBpY2tlZCBpbiB3ZSBzaG91bGQgdHJ5IHRvIHBpY2sgdGhlIG9uZVxuICAgICAgICAvLyB0aGF0IHdlIHRoaW5rIHdvdWxkIHdvcmsgYmVzdCBmb3IgdGhpcyBrZXlcbiAgICAgICAgaWYgKCFhY3Rpb24pIHtcbiAgICAgICAgICAgIGFjdGlvbiA9IF9nZXRSZXZlcnNlTWFwKClba2V5XSA/ICdrZXlkb3duJyA6ICdrZXlwcmVzcyc7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtb2RpZmllciBrZXlzIGRvbid0IHdvcmsgYXMgZXhwZWN0ZWQgd2l0aCBrZXlwcmVzcyxcbiAgICAgICAgLy8gc3dpdGNoIHRvIGtleWRvd25cbiAgICAgICAgaWYgKGFjdGlvbiA9PSAna2V5cHJlc3MnICYmIG1vZGlmaWVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGFjdGlvbiA9ICdrZXlkb3duJztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYmluZHMgYSBrZXkgc2VxdWVuY2UgdG8gYW4gZXZlbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb21ibyAtIGNvbWJvIHNwZWNpZmllZCBpbiBiaW5kIGNhbGxcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBrZXlzXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgKiBAcGFyYW0ge3N0cmluZz19IGFjdGlvblxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfYmluZFNlcXVlbmNlKGNvbWJvLCBrZXlzLCBjYWxsYmFjaywgYWN0aW9uKSB7XG5cbiAgICAgICAgLy8gc3RhcnQgb2ZmIGJ5IGFkZGluZyBhIHNlcXVlbmNlIGxldmVsIHJlY29yZCBmb3IgdGhpcyBjb21iaW5hdGlvblxuICAgICAgICAvLyBhbmQgc2V0dGluZyB0aGUgbGV2ZWwgdG8gMFxuICAgICAgICBfc2VxdWVuY2VMZXZlbHNbY29tYm9dID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogY2FsbGJhY2sgdG8gaW5jcmVhc2UgdGhlIHNlcXVlbmNlIGxldmVsIGZvciB0aGlzIHNlcXVlbmNlIGFuZCByZXNldFxuICAgICAgICAgKiBhbGwgb3RoZXIgc2VxdWVuY2VzIHRoYXQgd2VyZSBhY3RpdmVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5leHRBY3Rpb25cbiAgICAgICAgICogQHJldHVybnMge0Z1bmN0aW9ufVxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2luY3JlYXNlU2VxdWVuY2UobmV4dEFjdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIF9uZXh0RXhwZWN0ZWRBY3Rpb24gPSBuZXh0QWN0aW9uO1xuICAgICAgICAgICAgICAgICsrX3NlcXVlbmNlTGV2ZWxzW2NvbWJvXTtcbiAgICAgICAgICAgICAgICBfcmVzZXRTZXF1ZW5jZVRpbWVyKCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHdyYXBzIHRoZSBzcGVjaWZpZWQgY2FsbGJhY2sgaW5zaWRlIG9mIGFub3RoZXIgZnVuY3Rpb24gaW4gb3JkZXJcbiAgICAgICAgICogdG8gcmVzZXQgYWxsIHNlcXVlbmNlIGNvdW50ZXJzIGFzIHNvb24gYXMgdGhpcyBzZXF1ZW5jZSBpcyBkb25lXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2NhbGxiYWNrQW5kUmVzZXQoZSkge1xuICAgICAgICAgICAgX2ZpcmVDYWxsYmFjayhjYWxsYmFjaywgZSwgY29tYm8pO1xuXG4gICAgICAgICAgICAvLyB3ZSBzaG91bGQgaWdub3JlIHRoZSBuZXh0IGtleSB1cCBpZiB0aGUgYWN0aW9uIGlzIGtleSBkb3duXG4gICAgICAgICAgICAvLyBvciBrZXlwcmVzcy4gIHRoaXMgaXMgc28gaWYgeW91IGZpbmlzaCBhIHNlcXVlbmNlIGFuZFxuICAgICAgICAgICAgLy8gcmVsZWFzZSB0aGUga2V5IHRoZSBmaW5hbCBrZXkgd2lsbCBub3QgdHJpZ2dlciBhIGtleXVwXG4gICAgICAgICAgICBpZiAoYWN0aW9uICE9PSAna2V5dXAnKSB7XG4gICAgICAgICAgICAgICAgX2lnbm9yZU5leHRLZXl1cCA9IF9jaGFyYWN0ZXJGcm9tRXZlbnQoZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHdlaXJkIHJhY2UgY29uZGl0aW9uIGlmIGEgc2VxdWVuY2UgZW5kcyB3aXRoIHRoZSBrZXlcbiAgICAgICAgICAgIC8vIGFub3RoZXIgc2VxdWVuY2UgYmVnaW5zIHdpdGhcbiAgICAgICAgICAgIHNldFRpbWVvdXQoX3Jlc2V0U2VxdWVuY2VzLCAxMCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb29wIHRocm91Z2gga2V5cyBvbmUgYXQgYSB0aW1lIGFuZCBiaW5kIHRoZSBhcHByb3ByaWF0ZSBjYWxsYmFja1xuICAgICAgICAvLyBmdW5jdGlvbi4gIGZvciBhbnkga2V5IGxlYWRpbmcgdXAgdG8gdGhlIGZpbmFsIG9uZSBpdCBzaG91bGRcbiAgICAgICAgLy8gaW5jcmVhc2UgdGhlIHNlcXVlbmNlLiBhZnRlciB0aGUgZmluYWwsIGl0IHNob3VsZCByZXNldCBhbGwgc2VxdWVuY2VzXG4gICAgICAgIC8vXG4gICAgICAgIC8vIGlmIGFuIGFjdGlvbiBpcyBzcGVjaWZpZWQgaW4gdGhlIG9yaWdpbmFsIGJpbmQgY2FsbCB0aGVuIHRoYXQgd2lsbFxuICAgICAgICAvLyBiZSB1c2VkIHRocm91Z2hvdXQuICBvdGhlcndpc2Ugd2Ugd2lsbCBwYXNzIHRoZSBhY3Rpb24gdGhhdCB0aGVcbiAgICAgICAgLy8gbmV4dCBrZXkgaW4gdGhlIHNlcXVlbmNlIHNob3VsZCBtYXRjaC4gIHRoaXMgYWxsb3dzIGEgc2VxdWVuY2VcbiAgICAgICAgLy8gdG8gbWl4IGFuZCBtYXRjaCBrZXlwcmVzcyBhbmQga2V5ZG93biBldmVudHMgZGVwZW5kaW5nIG9uIHdoaWNoXG4gICAgICAgIC8vIG9uZXMgYXJlIGJldHRlciBzdWl0ZWQgdG8gdGhlIGtleSBwcm92aWRlZFxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBpc0ZpbmFsID0gaSArIDEgPT09IGtleXMubGVuZ3RoO1xuICAgICAgICAgICAgdmFyIHdyYXBwZWRDYWxsYmFjayA9IGlzRmluYWwgPyBfY2FsbGJhY2tBbmRSZXNldCA6IF9pbmNyZWFzZVNlcXVlbmNlKGFjdGlvbiB8fCBfZ2V0S2V5SW5mbyhrZXlzW2kgKyAxXSkuYWN0aW9uKTtcbiAgICAgICAgICAgIF9iaW5kU2luZ2xlKGtleXNbaV0sIHdyYXBwZWRDYWxsYmFjaywgYWN0aW9uLCBjb21ibywgaSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBmcm9tIGEgc3RyaW5nIGtleSBjb21iaW5hdGlvbiB0byBhbiBhcnJheVxuICAgICAqXG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBjb21iaW5hdGlvbiBsaWtlIFwiY29tbWFuZCtzaGlmdCtsXCJcbiAgICAgKiBAcmV0dXJuIHtBcnJheX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfa2V5c0Zyb21TdHJpbmcoY29tYmluYXRpb24pIHtcbiAgICAgICAgaWYgKGNvbWJpbmF0aW9uID09PSAnKycpIHtcbiAgICAgICAgICAgIHJldHVybiBbJysnXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb21iaW5hdGlvbi5zcGxpdCgnKycpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgaW5mbyBmb3IgYSBzcGVjaWZpYyBrZXkgY29tYmluYXRpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gY29tYmluYXRpb24ga2V5IGNvbWJpbmF0aW9uIChcImNvbW1hbmQrc1wiIG9yIFwiYVwiIG9yIFwiKlwiKVxuICAgICAqIEBwYXJhbSAge3N0cmluZz19IGFjdGlvblxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2dldEtleUluZm8oY29tYmluYXRpb24sIGFjdGlvbikge1xuICAgICAgICB2YXIga2V5cyxcbiAgICAgICAgICAgIGtleSxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBtb2RpZmllcnMgPSBbXTtcblxuICAgICAgICAvLyB0YWtlIHRoZSBrZXlzIGZyb20gdGhpcyBwYXR0ZXJuIGFuZCBmaWd1cmUgb3V0IHdoYXQgdGhlIGFjdHVhbFxuICAgICAgICAvLyBwYXR0ZXJuIGlzIGFsbCBhYm91dFxuICAgICAgICBrZXlzID0gX2tleXNGcm9tU3RyaW5nKGNvbWJpbmF0aW9uKTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAga2V5ID0ga2V5c1tpXTtcblxuICAgICAgICAgICAgLy8gbm9ybWFsaXplIGtleSBuYW1lc1xuICAgICAgICAgICAgaWYgKF9TUEVDSUFMX0FMSUFTRVNba2V5XSkge1xuICAgICAgICAgICAgICAgIGtleSA9IF9TUEVDSUFMX0FMSUFTRVNba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhpcyBpcyBub3QgYSBrZXlwcmVzcyBldmVudCB0aGVuIHdlIHNob3VsZFxuICAgICAgICAgICAgLy8gYmUgc21hcnQgYWJvdXQgdXNpbmcgc2hpZnQga2V5c1xuICAgICAgICAgICAgLy8gdGhpcyB3aWxsIG9ubHkgd29yayBmb3IgVVMga2V5Ym9hcmRzIGhvd2V2ZXJcbiAgICAgICAgICAgIGlmIChhY3Rpb24gJiYgYWN0aW9uICE9ICdrZXlwcmVzcycgJiYgX1NISUZUX01BUFtrZXldKSB7XG4gICAgICAgICAgICAgICAga2V5ID0gX1NISUZUX01BUFtrZXldO1xuICAgICAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKCdzaGlmdCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGtleSBpcyBhIG1vZGlmaWVyIHRoZW4gYWRkIGl0IHRvIHRoZSBsaXN0IG9mIG1vZGlmaWVyc1xuICAgICAgICAgICAgaWYgKF9pc01vZGlmaWVyKGtleSkpIHtcbiAgICAgICAgICAgICAgICBtb2RpZmllcnMucHVzaChrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVwZW5kaW5nIG9uIHdoYXQgdGhlIGtleSBjb21iaW5hdGlvbiBpc1xuICAgICAgICAvLyB3ZSB3aWxsIHRyeSB0byBwaWNrIHRoZSBiZXN0IGV2ZW50IGZvciBpdFxuICAgICAgICBhY3Rpb24gPSBfcGlja0Jlc3RBY3Rpb24oa2V5LCBtb2RpZmllcnMsIGFjdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgbW9kaWZpZXJzOiBtb2RpZmllcnMsXG4gICAgICAgICAgICBhY3Rpb246IGFjdGlvblxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGJpbmRzIGEgc2luZ2xlIGtleWJvYXJkIGNvbWJpbmF0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29tYmluYXRpb25cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gYWN0aW9uXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBzZXF1ZW5jZU5hbWUgLSBuYW1lIG9mIHNlcXVlbmNlIGlmIHBhcnQgb2Ygc2VxdWVuY2VcbiAgICAgKiBAcGFyYW0ge251bWJlcj19IGxldmVsIC0gd2hhdCBwYXJ0IG9mIHRoZSBzZXF1ZW5jZSB0aGUgY29tbWFuZCBpc1xuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfYmluZFNpbmdsZShjb21iaW5hdGlvbiwgY2FsbGJhY2ssIGFjdGlvbiwgc2VxdWVuY2VOYW1lLCBsZXZlbCkge1xuXG4gICAgICAgIC8vIHN0b3JlIGEgZGlyZWN0IG1hcHBlZCByZWZlcmVuY2UgZm9yIHVzZSB3aXRoIE1vdXNldHJhcC50cmlnZ2VyXG4gICAgICAgIF9kaXJlY3RNYXBbY29tYmluYXRpb24gKyAnOicgKyBhY3Rpb25dID0gY2FsbGJhY2s7XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIG11bHRpcGxlIHNwYWNlcyBpbiBhIHJvdyBiZWNvbWUgYSBzaW5nbGUgc3BhY2VcbiAgICAgICAgY29tYmluYXRpb24gPSBjb21iaW5hdGlvbi5yZXBsYWNlKC9cXHMrL2csICcgJyk7XG5cbiAgICAgICAgdmFyIHNlcXVlbmNlID0gY29tYmluYXRpb24uc3BsaXQoJyAnKSxcbiAgICAgICAgICAgIGluZm87XG5cbiAgICAgICAgLy8gaWYgdGhpcyBwYXR0ZXJuIGlzIGEgc2VxdWVuY2Ugb2Yga2V5cyB0aGVuIHJ1biB0aHJvdWdoIHRoaXMgbWV0aG9kXG4gICAgICAgIC8vIHRvIHJlcHJvY2VzcyBlYWNoIHBhdHRlcm4gb25lIGtleSBhdCBhIHRpbWVcbiAgICAgICAgaWYgKHNlcXVlbmNlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIF9iaW5kU2VxdWVuY2UoY29tYmluYXRpb24sIHNlcXVlbmNlLCBjYWxsYmFjaywgYWN0aW9uKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGluZm8gPSBfZ2V0S2V5SW5mbyhjb21iaW5hdGlvbiwgYWN0aW9uKTtcblxuICAgICAgICAvLyBtYWtlIHN1cmUgdG8gaW5pdGlhbGl6ZSBhcnJheSBpZiB0aGlzIGlzIHRoZSBmaXJzdCB0aW1lXG4gICAgICAgIC8vIGEgY2FsbGJhY2sgaXMgYWRkZWQgZm9yIHRoaXMga2V5XG4gICAgICAgIF9jYWxsYmFja3NbaW5mby5rZXldID0gX2NhbGxiYWNrc1tpbmZvLmtleV0gfHwgW107XG5cbiAgICAgICAgLy8gcmVtb3ZlIGFuIGV4aXN0aW5nIG1hdGNoIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgICBfZ2V0TWF0Y2hlcyhpbmZvLmtleSwgaW5mby5tb2RpZmllcnMsIHt0eXBlOiBpbmZvLmFjdGlvbn0sIHNlcXVlbmNlTmFtZSwgY29tYmluYXRpb24sIGxldmVsKTtcblxuICAgICAgICAvLyBhZGQgdGhpcyBjYWxsIGJhY2sgdG8gdGhlIGFycmF5XG4gICAgICAgIC8vIGlmIGl0IGlzIGEgc2VxdWVuY2UgcHV0IGl0IGF0IHRoZSBiZWdpbm5pbmdcbiAgICAgICAgLy8gaWYgbm90IHB1dCBpdCBhdCB0aGUgZW5kXG4gICAgICAgIC8vXG4gICAgICAgIC8vIHRoaXMgaXMgaW1wb3J0YW50IGJlY2F1c2UgdGhlIHdheSB0aGVzZSBhcmUgcHJvY2Vzc2VkIGV4cGVjdHNcbiAgICAgICAgLy8gdGhlIHNlcXVlbmNlIG9uZXMgdG8gY29tZSBmaXJzdFxuICAgICAgICBfY2FsbGJhY2tzW2luZm8ua2V5XVtzZXF1ZW5jZU5hbWUgPyAndW5zaGlmdCcgOiAncHVzaCddKHtcbiAgICAgICAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcbiAgICAgICAgICAgIG1vZGlmaWVyczogaW5mby5tb2RpZmllcnMsXG4gICAgICAgICAgICBhY3Rpb246IGluZm8uYWN0aW9uLFxuICAgICAgICAgICAgc2VxOiBzZXF1ZW5jZU5hbWUsXG4gICAgICAgICAgICBsZXZlbDogbGV2ZWwsXG4gICAgICAgICAgICBjb21ibzogY29tYmluYXRpb25cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYmluZHMgbXVsdGlwbGUgY29tYmluYXRpb25zIHRvIHRoZSBzYW1lIGNhbGxiYWNrXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBjb21iaW5hdGlvbnNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfHVuZGVmaW5lZH0gYWN0aW9uXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9iaW5kTXVsdGlwbGUoY29tYmluYXRpb25zLCBjYWxsYmFjaywgYWN0aW9uKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29tYmluYXRpb25zLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBfYmluZFNpbmdsZShjb21iaW5hdGlvbnNbaV0sIGNhbGxiYWNrLCBhY3Rpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc3RhcnQhXG4gICAgX2FkZEV2ZW50KGRvY3VtZW50LCAna2V5cHJlc3MnLCBfaGFuZGxlS2V5RXZlbnQpO1xuICAgIF9hZGRFdmVudChkb2N1bWVudCwgJ2tleWRvd24nLCBfaGFuZGxlS2V5RXZlbnQpO1xuICAgIF9hZGRFdmVudChkb2N1bWVudCwgJ2tleXVwJywgX2hhbmRsZUtleUV2ZW50KTtcblxuICAgIHZhciBNb3VzZXRyYXAgPSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGJpbmRzIGFuIGV2ZW50IHRvIG1vdXNldHJhcFxuICAgICAgICAgKlxuICAgICAgICAgKiBjYW4gYmUgYSBzaW5nbGUga2V5LCBhIGNvbWJpbmF0aW9uIG9mIGtleXMgc2VwYXJhdGVkIHdpdGggKyxcbiAgICAgICAgICogYW4gYXJyYXkgb2Yga2V5cywgb3IgYSBzZXF1ZW5jZSBvZiBrZXlzIHNlcGFyYXRlZCBieSBzcGFjZXNcbiAgICAgICAgICpcbiAgICAgICAgICogYmUgc3VyZSB0byBsaXN0IHRoZSBtb2RpZmllciBrZXlzIGZpcnN0IHRvIG1ha2Ugc3VyZSB0aGF0IHRoZVxuICAgICAgICAgKiBjb3JyZWN0IGtleSBlbmRzIHVwIGdldHRpbmcgYm91bmQgKHRoZSBsYXN0IGtleSBpbiB0aGUgcGF0dGVybilcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd8QXJyYXl9IGtleXNcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb24gLSAna2V5cHJlc3MnLCAna2V5ZG93bicsIG9yICdrZXl1cCdcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgYmluZDogZnVuY3Rpb24oa2V5cywgY2FsbGJhY2ssIGFjdGlvbikge1xuICAgICAgICAgICAga2V5cyA9IGtleXMgaW5zdGFuY2VvZiBBcnJheSA/IGtleXMgOiBba2V5c107XG4gICAgICAgICAgICBfYmluZE11bHRpcGxlKGtleXMsIGNhbGxiYWNrLCBhY3Rpb24pO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHVuYmluZHMgYW4gZXZlbnQgdG8gbW91c2V0cmFwXG4gICAgICAgICAqXG4gICAgICAgICAqIHRoZSB1bmJpbmRpbmcgc2V0cyB0aGUgY2FsbGJhY2sgZnVuY3Rpb24gb2YgdGhlIHNwZWNpZmllZCBrZXkgY29tYm9cbiAgICAgICAgICogdG8gYW4gZW1wdHkgZnVuY3Rpb24gYW5kIGRlbGV0ZXMgdGhlIGNvcnJlc3BvbmRpbmcga2V5IGluIHRoZVxuICAgICAgICAgKiBfZGlyZWN0TWFwIGRpY3QuXG4gICAgICAgICAqXG4gICAgICAgICAqIFRPRE86IGFjdHVhbGx5IHJlbW92ZSB0aGlzIGZyb20gdGhlIF9jYWxsYmFja3MgZGljdGlvbmFyeSBpbnN0ZWFkXG4gICAgICAgICAqIG9mIGJpbmRpbmcgYW4gZW1wdHkgZnVuY3Rpb25cbiAgICAgICAgICpcbiAgICAgICAgICogdGhlIGtleWNvbWJvK2FjdGlvbiBoYXMgdG8gYmUgZXhhY3RseSB0aGUgc2FtZSBhc1xuICAgICAgICAgKiBpdCB3YXMgZGVmaW5lZCBpbiB0aGUgYmluZCBtZXRob2RcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd8QXJyYXl9IGtleXNcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvblxuICAgICAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICB1bmJpbmQ6IGZ1bmN0aW9uKGtleXMsIGFjdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIE1vdXNldHJhcC5iaW5kKGtleXMsIGZ1bmN0aW9uKCkge30sIGFjdGlvbik7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRyaWdnZXJzIGFuIGV2ZW50IHRoYXQgaGFzIGFscmVhZHkgYmVlbiBib3VuZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5c1xuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZz19IGFjdGlvblxuICAgICAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICB0cmlnZ2VyOiBmdW5jdGlvbihrZXlzLCBhY3Rpb24pIHtcbiAgICAgICAgICAgIGlmIChfZGlyZWN0TWFwW2tleXMgKyAnOicgKyBhY3Rpb25dKSB7XG4gICAgICAgICAgICAgICAgX2RpcmVjdE1hcFtrZXlzICsgJzonICsgYWN0aW9uXSh7fSwga2V5cyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmVzZXRzIHRoZSBsaWJyYXJ5IGJhY2sgdG8gaXRzIGluaXRpYWwgc3RhdGUuICB0aGlzIGlzIHVzZWZ1bFxuICAgICAgICAgKiBpZiB5b3Ugd2FudCB0byBjbGVhciBvdXQgdGhlIGN1cnJlbnQga2V5Ym9hcmQgc2hvcnRjdXRzIGFuZCBiaW5kXG4gICAgICAgICAqIG5ldyBvbmVzIC0gZm9yIGV4YW1wbGUgaWYgeW91IHN3aXRjaCB0byBhbm90aGVyIHBhZ2VcbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgcmVzZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgX2NhbGxiYWNrcyA9IHt9O1xuICAgICAgICAgICAgX2RpcmVjdE1hcCA9IHt9O1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0sXG5cbiAgICAgICAvKipcbiAgICAgICAgKiBzaG91bGQgd2Ugc3RvcCB0aGlzIGV2ZW50IGJlZm9yZSBmaXJpbmcgb2ZmIGNhbGxiYWNrc1xuICAgICAgICAqXG4gICAgICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAgICAqIEBwYXJhbSB7RWxlbWVudH0gZWxlbWVudFxuICAgICAgICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAgICAgICovXG4gICAgICAgIHN0b3BDYWxsYmFjazogZnVuY3Rpb24oZSwgZWxlbWVudCkge1xuXG4gICAgICAgICAgICAvLyBpZiB0aGUgZWxlbWVudCBoYXMgdGhlIGNsYXNzIFwibW91c2V0cmFwXCIgdGhlbiBubyBuZWVkIHRvIHN0b3BcbiAgICAgICAgICAgIGlmICgoJyAnICsgZWxlbWVudC5jbGFzc05hbWUgKyAnICcpLmluZGV4T2YoJyBtb3VzZXRyYXAgJykgPiAtMSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3RvcCBmb3IgaW5wdXQsIHNlbGVjdCwgYW5kIHRleHRhcmVhXG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudC50YWdOYW1lID09ICdJTlBVVCcgfHwgZWxlbWVudC50YWdOYW1lID09ICdTRUxFQ1QnIHx8IGVsZW1lbnQudGFnTmFtZSA9PSAnVEVYVEFSRUEnIHx8IGVsZW1lbnQuaXNDb250ZW50RWRpdGFibGU7XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGV4cG9zZXMgX2hhbmRsZUtleSBwdWJsaWNseSBzbyBpdCBjYW4gYmUgb3ZlcndyaXR0ZW4gYnkgZXh0ZW5zaW9uc1xuICAgICAgICAgKi9cbiAgICAgICAgaGFuZGxlS2V5OiBfaGFuZGxlS2V5XG4gICAgfTtcblxuICAgIC8vIGV4cG9zZSBtb3VzZXRyYXAgdG8gdGhlIGdsb2JhbCBvYmplY3RcbiAgICB3aW5kb3cuTW91c2V0cmFwID0gTW91c2V0cmFwO1xuXG4gICAgLy8gZXhwb3NlIG1vdXNldHJhcCBhcyBhbiBBTUQgbW9kdWxlXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICBkZWZpbmUoTW91c2V0cmFwKTtcbiAgICB9XG59KSAod2luZG93LCBkb2N1bWVudCk7XG4iXX0=
