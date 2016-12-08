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
var app = angular.module("ntuApp", ['LocalStorageModule', 'angular-marquee']);


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


    //Marquee

    $scope.duration = 10000;

    function addMarquee(musicLists) {
        if (musicLists.length > 0)
            musicLists.forEach(function(m, i) {
                m.marquee.scroll = false;

            });
    }


    // $scope.musicLists = [{
    //     _id: "i5LOV6r45i8",
    //     title: "【ALIVE Live Session】滅火器－基隆路",
    //     url: "https://www.youtube.com/embed/i5LOV6r45i8",
    //     image: "http://img.youtube.com/vi/i5LOV6r45i8/0.jpg",
    //     description: "聽說，今天發佈的是新歌。 聽說，滅火器在【ALIVE系列演唱會】會披露【更多新歌】 4/1晚上8點@Legacy Taipei，一定要來！ 啟售時間預計2月中下旬公布...",
    //     isSelect: false,
    //     isFavorite: false
    // }, {
    //     _id: "i5LOV6r45i8",
    //     title: "【ALIVE Live Session】滅火器－基隆路",
    //     url: "https://www.youtube.com/embed/i5LOV6r45i8",
    //     image: "http://img.youtube.com/vi/i5LOV6r45i8/0.jpg",
    //     description: "聽說，今天發佈的是新歌。 聽說，滅火器在【ALIVE系列演唱會】會披露【更多新歌】 4/1晚上8點@Legacy Taipei，一定要來！ 啟售時間預計2月中下旬公布...",
    //     isSelect: false,
    //     isFavorite: false
    // }, {
    //     _id: "i5LOV6r45i8",
    //     title: "【ALIVE Live Session】滅火器－基隆路",
    //     url: "https://www.youtube.com/embed/i5LOV6r45i8",
    //     image: "http://img.youtube.com/vi/i5LOV6r45i8/0.jpg",
    //     description: "聽說，今天發佈的是新歌。 聽說，滅火器在【ALIVE系列演唱會】會披露【更多新歌】 4/1晚上8點@Legacy Taipei，一定要來！ 啟售時間預計2月中下旬公布...",
    //     isSelect: false,
    //     isFavorite: false
    // }, {
    //     _id: "i5LOV6r45i8",
    //     title: "【ALIVE Live Session】滅火器－基隆路",
    //     url: "https://www.youtube.com/embed/i5LOV6r45i8",
    //     image: "http://img.youtube.com/vi/i5LOV6r45i8/0.jpg",
    //     description: "聽說，今天發佈的是新歌。 聽說，滅火器在【ALIVE系列演唱會】會披露【更多新歌】 4/1晚上8點@Legacy Taipei，一定要來！ 啟售時間預計2月中下旬公布...",
    //     isSelect: false,
    //     isFavorite: false
    // }];

    $scope.init = function() {
        $scope.musicLists = loadSearch();
        var favoriteLists = loadFavorite();
        if (favoriteLists)
            $scope.musicLists.forEach(function(m, i) {
                favoriteLists.forEach(function(f, j) {
                    if (m._id == f._id) m.isFavorite = true;
                });
            });
        addMarquee($scope.musicLists);

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

    }

    $scope.addToMyFavorite = function(event, musicCard) {
        event.preventDefault();
        event.stopPropagation();
        musicCard.isFavorite = !musicCard.isFavorite;
        // saveSearch($scope.musicLists);


        var favoriteLists = $scope.musicLists.filter(function(m) {
            if (m.isFavorite)
                return m;
            else
                return 0;
        });
        saveFavorite(favoriteLists);



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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFuZ3VsYXItbG9jYWwtc3RvcmFnZS5qcyIsImFuZ3VsYXItbWFycXVlZS5qcyIsImFwcC5qcyIsImJhc2UuanMiLCJtb3VzZXRyYXAuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25pQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoibWl6VUkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEFuIEFuZ3VsYXIgbW9kdWxlIHRoYXQgZ2l2ZXMgeW91IGFjY2VzcyB0byB0aGUgYnJvd3NlcnMgbG9jYWwgc3RvcmFnZVxuICogQHZlcnNpb24gdjAuNS4yIC0gMjAxNi0wOS0yOFxuICogQGxpbmsgaHR0cHM6Ly9naXRodWIuY29tL2dyZXZvcnkvYW5ndWxhci1sb2NhbC1zdG9yYWdlXG4gKiBAYXV0aG9yIGdyZXZvcnkgPGdyZWdAZ3JlZ3Bpa2UuY2E+XG4gKiBAbGljZW5zZSBNSVQgTGljZW5zZSwgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9NSVRcbiAqL1xuKGZ1bmN0aW9uICh3aW5kb3csIGFuZ3VsYXIpIHtcbnZhciBpc0RlZmluZWQgPSBhbmd1bGFyLmlzRGVmaW5lZCxcbiAgaXNVbmRlZmluZWQgPSBhbmd1bGFyLmlzVW5kZWZpbmVkLFxuICBpc051bWJlciA9IGFuZ3VsYXIuaXNOdW1iZXIsXG4gIGlzT2JqZWN0ID0gYW5ndWxhci5pc09iamVjdCxcbiAgaXNBcnJheSA9IGFuZ3VsYXIuaXNBcnJheSxcbiAgaXNTdHJpbmcgPSBhbmd1bGFyLmlzU3RyaW5nLFxuICBleHRlbmQgPSBhbmd1bGFyLmV4dGVuZCxcbiAgdG9Kc29uID0gYW5ndWxhci50b0pzb247XG5cbmFuZ3VsYXJcbiAgLm1vZHVsZSgnTG9jYWxTdG9yYWdlTW9kdWxlJywgW10pXG4gIC5wcm92aWRlcignbG9jYWxTdG9yYWdlU2VydmljZScsIGZ1bmN0aW9uKCkge1xuICAgIC8vIFlvdSBzaG91bGQgc2V0IGEgcHJlZml4IHRvIGF2b2lkIG92ZXJ3cml0aW5nIGFueSBsb2NhbCBzdG9yYWdlIHZhcmlhYmxlcyBmcm9tIHRoZSByZXN0IG9mIHlvdXIgYXBwXG4gICAgLy8gZS5nLiBsb2NhbFN0b3JhZ2VTZXJ2aWNlUHJvdmlkZXIuc2V0UHJlZml4KCd5b3VyQXBwTmFtZScpO1xuICAgIC8vIFdpdGggcHJvdmlkZXIgeW91IGNhbiB1c2UgY29uZmlnIGFzIHRoaXM6XG4gICAgLy8gbXlBcHAuY29uZmlnKGZ1bmN0aW9uIChsb2NhbFN0b3JhZ2VTZXJ2aWNlUHJvdmlkZXIpIHtcbiAgICAvLyAgICBsb2NhbFN0b3JhZ2VTZXJ2aWNlUHJvdmlkZXIucHJlZml4ID0gJ3lvdXJBcHBOYW1lJztcbiAgICAvLyB9KTtcbiAgICB0aGlzLnByZWZpeCA9ICdscyc7XG5cbiAgICAvLyBZb3UgY291bGQgY2hhbmdlIHdlYiBzdG9yYWdlIHR5cGUgbG9jYWxzdG9yYWdlIG9yIHNlc3Npb25TdG9yYWdlXG4gICAgdGhpcy5zdG9yYWdlVHlwZSA9ICdsb2NhbFN0b3JhZ2UnO1xuXG4gICAgLy8gQ29va2llIG9wdGlvbnMgKHVzdWFsbHkgaW4gY2FzZSBvZiBmYWxsYmFjaylcbiAgICAvLyBleHBpcnkgPSBOdW1iZXIgb2YgZGF5cyBiZWZvcmUgY29va2llcyBleHBpcmUgLy8gMCA9IERvZXMgbm90IGV4cGlyZVxuICAgIC8vIHBhdGggPSBUaGUgd2ViIHBhdGggdGhlIGNvb2tpZSByZXByZXNlbnRzXG4gICAgLy8gc2VjdXJlID0gV2V0aGVyIHRoZSBjb29raWVzIHNob3VsZCBiZSBzZWN1cmUgKGkuZSBvbmx5IHNlbnQgb24gSFRUUFMgcmVxdWVzdHMpXG4gICAgdGhpcy5jb29raWUgPSB7XG4gICAgICBleHBpcnk6IDMwLFxuICAgICAgcGF0aDogJy8nLFxuICAgICAgc2VjdXJlOiBmYWxzZVxuICAgIH07XG5cbiAgICAvLyBEZWNpZGVzIHdldGhlciB3ZSBzaG91bGQgZGVmYXVsdCB0byBjb29raWVzIGlmIGxvY2Fsc3RvcmFnZSBpcyBub3Qgc3VwcG9ydGVkLlxuICAgIHRoaXMuZGVmYXVsdFRvQ29va2llID0gdHJ1ZTtcblxuICAgIC8vIFNlbmQgc2lnbmFscyBmb3IgZWFjaCBvZiB0aGUgZm9sbG93aW5nIGFjdGlvbnM/XG4gICAgdGhpcy5ub3RpZnkgPSB7XG4gICAgICBzZXRJdGVtOiB0cnVlLFxuICAgICAgcmVtb3ZlSXRlbTogZmFsc2VcbiAgICB9O1xuXG4gICAgLy8gU2V0dGVyIGZvciB0aGUgcHJlZml4XG4gICAgdGhpcy5zZXRQcmVmaXggPSBmdW5jdGlvbihwcmVmaXgpIHtcbiAgICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcblxuICAgIC8vIFNldHRlciBmb3IgdGhlIHN0b3JhZ2VUeXBlXG4gICAgdGhpcy5zZXRTdG9yYWdlVHlwZSA9IGZ1bmN0aW9uKHN0b3JhZ2VUeXBlKSB7XG4gICAgICB0aGlzLnN0b3JhZ2VUeXBlID0gc3RvcmFnZVR5cGU7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIC8vIFNldHRlciBmb3IgZGVmYXVsdFRvQ29va2llIHZhbHVlLCBkZWZhdWx0IGlzIHRydWUuXG4gICAgdGhpcy5zZXREZWZhdWx0VG9Db29raWUgPSBmdW5jdGlvbiAoc2hvdWxkRGVmYXVsdCkge1xuICAgICAgdGhpcy5kZWZhdWx0VG9Db29raWUgPSAhIXNob3VsZERlZmF1bHQ7IC8vIERvdWJsZS1ub3QgdG8gbWFrZSBzdXJlIGl0J3MgYSBib29sIHZhbHVlLlxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICAvLyBTZXR0ZXIgZm9yIGNvb2tpZSBjb25maWdcbiAgICB0aGlzLnNldFN0b3JhZ2VDb29raWUgPSBmdW5jdGlvbihleHAsIHBhdGgsIHNlY3VyZSkge1xuICAgICAgdGhpcy5jb29raWUuZXhwaXJ5ID0gZXhwO1xuICAgICAgdGhpcy5jb29raWUucGF0aCA9IHBhdGg7XG4gICAgICB0aGlzLmNvb2tpZS5zZWN1cmUgPSBzZWN1cmU7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLy8gU2V0dGVyIGZvciBjb29raWUgZG9tYWluXG4gICAgdGhpcy5zZXRTdG9yYWdlQ29va2llRG9tYWluID0gZnVuY3Rpb24oZG9tYWluKSB7XG4gICAgICB0aGlzLmNvb2tpZS5kb21haW4gPSBkb21haW47XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLy8gU2V0dGVyIGZvciBub3RpZmljYXRpb24gY29uZmlnXG4gICAgLy8gaXRlbVNldCAmIGl0ZW1SZW1vdmUgc2hvdWxkIGJlIGJvb2xlYW5zXG4gICAgdGhpcy5zZXROb3RpZnkgPSBmdW5jdGlvbihpdGVtU2V0LCBpdGVtUmVtb3ZlKSB7XG4gICAgICB0aGlzLm5vdGlmeSA9IHtcbiAgICAgICAgc2V0SXRlbTogaXRlbVNldCxcbiAgICAgICAgcmVtb3ZlSXRlbTogaXRlbVJlbW92ZVxuICAgICAgfTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG5cbiAgICB0aGlzLiRnZXQgPSBbJyRyb290U2NvcGUnLCAnJHdpbmRvdycsICckZG9jdW1lbnQnLCAnJHBhcnNlJywnJHRpbWVvdXQnLCBmdW5jdGlvbigkcm9vdFNjb3BlLCAkd2luZG93LCAkZG9jdW1lbnQsICRwYXJzZSwgJHRpbWVvdXQpIHtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIHZhciBwcmVmaXggPSBzZWxmLnByZWZpeDtcbiAgICAgIHZhciBjb29raWUgPSBzZWxmLmNvb2tpZTtcbiAgICAgIHZhciBub3RpZnkgPSBzZWxmLm5vdGlmeTtcbiAgICAgIHZhciBzdG9yYWdlVHlwZSA9IHNlbGYuc3RvcmFnZVR5cGU7XG4gICAgICB2YXIgd2ViU3RvcmFnZTtcblxuICAgICAgLy8gV2hlbiBBbmd1bGFyJ3MgJGRvY3VtZW50IGlzIG5vdCBhdmFpbGFibGVcbiAgICAgIGlmICghJGRvY3VtZW50KSB7XG4gICAgICAgICRkb2N1bWVudCA9IGRvY3VtZW50O1xuICAgICAgfSBlbHNlIGlmICgkZG9jdW1lbnRbMF0pIHtcbiAgICAgICAgJGRvY3VtZW50ID0gJGRvY3VtZW50WzBdO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGVyZSBpcyBhIHByZWZpeCBzZXQgaW4gdGhlIGNvbmZpZyBsZXRzIHVzZSB0aGF0IHdpdGggYW4gYXBwZW5kZWQgcGVyaW9kIGZvciByZWFkYWJpbGl0eVxuICAgICAgaWYgKHByZWZpeC5zdWJzdHIoLTEpICE9PSAnLicpIHtcbiAgICAgICAgcHJlZml4ID0gISFwcmVmaXggPyBwcmVmaXggKyAnLicgOiAnJztcbiAgICAgIH1cbiAgICAgIHZhciBkZXJpdmVRdWFsaWZpZWRLZXkgPSBmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgcmV0dXJuIHByZWZpeCArIGtleTtcbiAgICAgIH07XG5cbiAgICAgIC8vIFJlbW92ZXMgcHJlZml4IGZyb20gdGhlIGtleS5cbiAgICAgIHZhciB1bmRlcml2ZVF1YWxpZmllZEtleSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgcmV0dXJuIGtleS5yZXBsYWNlKG5ldyBSZWdFeHAoJ14nICsgcHJlZml4LCAnZycpLCAnJyk7XG4gICAgICB9O1xuXG4gICAgICAvLyBDaGVjayBpZiB0aGUga2V5IGlzIHdpdGhpbiBvdXIgcHJlZml4IG5hbWVzcGFjZS5cbiAgICAgIHZhciBpc0tleVByZWZpeE91cnMgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIHJldHVybiBrZXkuaW5kZXhPZihwcmVmaXgpID09PSAwO1xuICAgICAgfTtcblxuICAgICAgLy8gQ2hlY2tzIHRoZSBicm93c2VyIHRvIHNlZSBpZiBsb2NhbCBzdG9yYWdlIGlzIHN1cHBvcnRlZFxuICAgICAgdmFyIGNoZWNrU3VwcG9ydCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2YXIgc3VwcG9ydGVkID0gKHN0b3JhZ2VUeXBlIGluICR3aW5kb3cgJiYgJHdpbmRvd1tzdG9yYWdlVHlwZV0gIT09IG51bGwpO1xuXG4gICAgICAgICAgLy8gV2hlbiBTYWZhcmkgKE9TIFggb3IgaU9TKSBpcyBpbiBwcml2YXRlIGJyb3dzaW5nIG1vZGUsIGl0IGFwcGVhcnMgYXMgdGhvdWdoIGxvY2FsU3RvcmFnZVxuICAgICAgICAgIC8vIGlzIGF2YWlsYWJsZSwgYnV0IHRyeWluZyB0byBjYWxsIC5zZXRJdGVtIHRocm93cyBhbiBleGNlcHRpb24uXG4gICAgICAgICAgLy9cbiAgICAgICAgICAvLyBcIlFVT1RBX0VYQ0VFREVEX0VSUjogRE9NIEV4Y2VwdGlvbiAyMjogQW4gYXR0ZW1wdCB3YXMgbWFkZSB0byBhZGQgc29tZXRoaW5nIHRvIHN0b3JhZ2VcbiAgICAgICAgICAvLyB0aGF0IGV4Y2VlZGVkIHRoZSBxdW90YS5cIlxuICAgICAgICAgIHZhciBrZXkgPSBkZXJpdmVRdWFsaWZpZWRLZXkoJ19fJyArIE1hdGgucm91bmQoTWF0aC5yYW5kb20oKSAqIDFlNykpO1xuICAgICAgICAgIGlmIChzdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIHdlYlN0b3JhZ2UgPSAkd2luZG93W3N0b3JhZ2VUeXBlXTtcbiAgICAgICAgICAgIHdlYlN0b3JhZ2Uuc2V0SXRlbShrZXksICcnKTtcbiAgICAgICAgICAgIHdlYlN0b3JhZ2UucmVtb3ZlSXRlbShrZXkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBzdXBwb3J0ZWQ7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAvLyBPbmx5IGNoYW5nZSBzdG9yYWdlVHlwZSB0byBjb29raWVzIGlmIGRlZmF1bHRpbmcgaXMgZW5hYmxlZC5cbiAgICAgICAgICBpZiAoc2VsZi5kZWZhdWx0VG9Db29raWUpXG4gICAgICAgICAgICBzdG9yYWdlVHlwZSA9ICdjb29raWUnO1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsIGUubWVzc2FnZSk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgdmFyIGJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSA9IGNoZWNrU3VwcG9ydCgpO1xuXG4gICAgICAvLyBEaXJlY3RseSBhZGRzIGEgdmFsdWUgdG8gbG9jYWwgc3RvcmFnZVxuICAgICAgLy8gSWYgbG9jYWwgc3RvcmFnZSBpcyBub3QgYXZhaWxhYmxlIGluIHRoZSBicm93c2VyIHVzZSBjb29raWVzXG4gICAgICAvLyBFeGFtcGxlIHVzZTogbG9jYWxTdG9yYWdlU2VydmljZS5hZGQoJ2xpYnJhcnknLCdhbmd1bGFyJyk7XG4gICAgICB2YXIgYWRkVG9Mb2NhbFN0b3JhZ2UgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSwgdHlwZSkge1xuICAgICAgICBzZXRTdG9yYWdlVHlwZSh0eXBlKTtcblxuICAgICAgICAvLyBMZXQncyBjb252ZXJ0IHVuZGVmaW5lZCB2YWx1ZXMgdG8gbnVsbCB0byBnZXQgdGhlIHZhbHVlIGNvbnNpc3RlbnRcbiAgICAgICAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSkge1xuICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IHRvSnNvbih2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiB0aGlzIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBsb2NhbCBzdG9yYWdlIHVzZSBjb29raWVzXG4gICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlICYmIHNlbGYuZGVmYXVsdFRvQ29va2llIHx8IHNlbGYuc3RvcmFnZVR5cGUgPT09ICdjb29raWUnKSB7XG4gICAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi53YXJuaW5nJywgJ0xPQ0FMX1NUT1JBR0VfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChub3RpZnkuc2V0SXRlbSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLnNldGl0ZW0nLCB7a2V5OiBrZXksIG5ld3ZhbHVlOiB2YWx1ZSwgc3RvcmFnZVR5cGU6ICdjb29raWUnfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBhZGRUb0Nvb2tpZXMoa2V5LCB2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGlmICh3ZWJTdG9yYWdlKSB7XG4gICAgICAgICAgICB3ZWJTdG9yYWdlLnNldEl0ZW0oZGVyaXZlUXVhbGlmaWVkS2V5KGtleSksIHZhbHVlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKG5vdGlmeS5zZXRJdGVtKSB7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uc2V0aXRlbScsIHtrZXk6IGtleSwgbmV3dmFsdWU6IHZhbHVlLCBzdG9yYWdlVHlwZTogc2VsZi5zdG9yYWdlVHlwZX0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsIGUubWVzc2FnZSk7XG4gICAgICAgICAgcmV0dXJuIGFkZFRvQ29va2llcyhrZXksIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH07XG5cbiAgICAgIC8vIERpcmVjdGx5IGdldCBhIHZhbHVlIGZyb20gbG9jYWwgc3RvcmFnZVxuICAgICAgLy8gRXhhbXBsZSB1c2U6IGxvY2FsU3RvcmFnZVNlcnZpY2UuZ2V0KCdsaWJyYXJ5Jyk7IC8vIHJldHVybnMgJ2FuZ3VsYXInXG4gICAgICB2YXIgZ2V0RnJvbUxvY2FsU3RvcmFnZSA9IGZ1bmN0aW9uIChrZXksIHR5cGUpIHtcbiAgICAgICAgc2V0U3RvcmFnZVR5cGUodHlwZSk7XG5cbiAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UgJiYgc2VsZi5kZWZhdWx0VG9Db29raWUgIHx8IHNlbGYuc3RvcmFnZVR5cGUgPT09ICdjb29raWUnKSB7XG4gICAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi53YXJuaW5nJywgJ0xPQ0FMX1NUT1JBR0VfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBnZXRGcm9tQ29va2llcyhrZXkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGl0ZW0gPSB3ZWJTdG9yYWdlID8gd2ViU3RvcmFnZS5nZXRJdGVtKGRlcml2ZVF1YWxpZmllZEtleShrZXkpKSA6IG51bGw7XG4gICAgICAgIC8vIGFuZ3VsYXIudG9Kc29uIHdpbGwgY29udmVydCBudWxsIHRvICdudWxsJywgc28gYSBwcm9wZXIgY29udmVyc2lvbiBpcyBuZWVkZWRcbiAgICAgICAgLy8gRklYTUUgbm90IGEgcGVyZmVjdCBzb2x1dGlvbiwgc2luY2UgYSB2YWxpZCAnbnVsbCcgc3RyaW5nIGNhbid0IGJlIHN0b3JlZFxuICAgICAgICBpZiAoIWl0ZW0gfHwgaXRlbSA9PT0gJ251bGwnKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGl0ZW0pO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgcmV0dXJuIGl0ZW07XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIFJlbW92ZSBhbiBpdGVtIGZyb20gbG9jYWwgc3RvcmFnZVxuICAgICAgLy8gRXhhbXBsZSB1c2U6IGxvY2FsU3RvcmFnZVNlcnZpY2UucmVtb3ZlKCdsaWJyYXJ5Jyk7IC8vIHJlbW92ZXMgdGhlIGtleS92YWx1ZSBwYWlyIG9mIGxpYnJhcnk9J2FuZ3VsYXInXG4gICAgICAvL1xuICAgICAgLy8gVGhpcyBpcyB2YXItYXJnIHJlbW92YWwsIGNoZWNrIHRoZSBsYXN0IGFyZ3VtZW50IHRvIHNlZSBpZiBpdCBpcyBhIHN0b3JhZ2VUeXBlXG4gICAgICAvLyBhbmQgc2V0IHR5cGUgYWNjb3JkaW5nbHkgYmVmb3JlIHJlbW92aW5nLlxuICAgICAgLy9cbiAgICAgIHZhciByZW1vdmVGcm9tTG9jYWxTdG9yYWdlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBjYW4ndCBwb3Agb24gYXJndW1lbnRzLCBzbyB3ZSBkbyB0aGlzXG4gICAgICAgIHZhciBjb25zdW1lZCA9IDA7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDEgJiZcbiAgICAgICAgICAgIChhcmd1bWVudHNbYXJndW1lbnRzLmxlbmd0aCAtIDFdID09PSAnbG9jYWxTdG9yYWdlJyB8fFxuICAgICAgICAgICAgIGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV0gPT09ICdzZXNzaW9uU3RvcmFnZScpKSB7XG4gICAgICAgICAgY29uc3VtZWQgPSAxO1xuICAgICAgICAgIHNldFN0b3JhZ2VUeXBlKGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGksIGtleTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGggLSBjb25zdW1lZDsgaSsrKSB7XG4gICAgICAgICAga2V5ID0gYXJndW1lbnRzW2ldO1xuICAgICAgICAgIGlmICghYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlICYmIHNlbGYuZGVmYXVsdFRvQ29va2llIHx8IHNlbGYuc3RvcmFnZVR5cGUgPT09ICdjb29raWUnKSB7XG4gICAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24ud2FybmluZycsICdMT0NBTF9TVE9SQUdFX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5vdGlmeS5yZW1vdmVJdGVtKSB7XG4gICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5yZW1vdmVpdGVtJywge2tleToga2V5LCBzdG9yYWdlVHlwZTogJ2Nvb2tpZSd9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlbW92ZUZyb21Db29raWVzKGtleSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgd2ViU3RvcmFnZS5yZW1vdmVJdGVtKGRlcml2ZVF1YWxpZmllZEtleShrZXkpKTtcbiAgICAgICAgICAgICAgaWYgKG5vdGlmeS5yZW1vdmVJdGVtKSB7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLnJlbW92ZWl0ZW0nLCB7XG4gICAgICAgICAgICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgICAgICAgICAgIHN0b3JhZ2VUeXBlOiBzZWxmLnN0b3JhZ2VUeXBlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgcmVtb3ZlRnJvbUNvb2tpZXMoa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIC8vIFJldHVybiBhcnJheSBvZiBrZXlzIGZvciBsb2NhbCBzdG9yYWdlXG4gICAgICAvLyBFeGFtcGxlIHVzZTogdmFyIGtleXMgPSBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmtleXMoKVxuICAgICAgdmFyIGdldEtleXNGb3JMb2NhbFN0b3JhZ2UgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICBzZXRTdG9yYWdlVHlwZSh0eXBlKTtcblxuICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi53YXJuaW5nJywgJ0xPQ0FMX1NUT1JBR0VfTk9UX1NVUFBPUlRFRCcpO1xuICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBwcmVmaXhMZW5ndGggPSBwcmVmaXgubGVuZ3RoO1xuICAgICAgICB2YXIga2V5cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gd2ViU3RvcmFnZSkge1xuICAgICAgICAgIC8vIE9ubHkgcmV0dXJuIGtleXMgdGhhdCBhcmUgZm9yIHRoaXMgYXBwXG4gICAgICAgICAgaWYgKGtleS5zdWJzdHIoMCwgcHJlZml4TGVuZ3RoKSA9PT0gcHJlZml4KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBrZXlzLnB1c2goa2V5LnN1YnN0cihwcmVmaXhMZW5ndGgpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5EZXNjcmlwdGlvbik7XG4gICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtleXM7XG4gICAgICB9O1xuXG4gICAgICAvLyBSZW1vdmUgYWxsIGRhdGEgZm9yIHRoaXMgYXBwIGZyb20gbG9jYWwgc3RvcmFnZVxuICAgICAgLy8gQWxzbyBvcHRpb25hbGx5IHRha2VzIGEgcmVndWxhciBleHByZXNzaW9uIHN0cmluZyBhbmQgcmVtb3ZlcyB0aGUgbWF0Y2hpbmcga2V5LXZhbHVlIHBhaXJzXG4gICAgICAvLyBFeGFtcGxlIHVzZTogbG9jYWxTdG9yYWdlU2VydmljZS5jbGVhckFsbCgpO1xuICAgICAgLy8gU2hvdWxkIGJlIHVzZWQgbW9zdGx5IGZvciBkZXZlbG9wbWVudCBwdXJwb3Nlc1xuICAgICAgdmFyIGNsZWFyQWxsRnJvbUxvY2FsU3RvcmFnZSA9IGZ1bmN0aW9uIChyZWd1bGFyRXhwcmVzc2lvbiwgdHlwZSkge1xuICAgICAgICBzZXRTdG9yYWdlVHlwZSh0eXBlKTtcblxuICAgICAgICAvLyBTZXR0aW5nIGJvdGggcmVndWxhciBleHByZXNzaW9ucyBpbmRlcGVuZGVudGx5XG4gICAgICAgIC8vIEVtcHR5IHN0cmluZ3MgcmVzdWx0IGluIGNhdGNoYWxsIFJlZ0V4cFxuICAgICAgICB2YXIgcHJlZml4UmVnZXggPSAhIXByZWZpeCA/IG5ldyBSZWdFeHAoJ14nICsgcHJlZml4KSA6IG5ldyBSZWdFeHAoKTtcbiAgICAgICAgdmFyIHRlc3RSZWdleCA9ICEhcmVndWxhckV4cHJlc3Npb24gPyBuZXcgUmVnRXhwKHJlZ3VsYXJFeHByZXNzaW9uKSA6IG5ldyBSZWdFeHAoKTtcblxuICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSAmJiBzZWxmLmRlZmF1bHRUb0Nvb2tpZSAgfHwgc2VsZi5zdG9yYWdlVHlwZSA9PT0gJ2Nvb2tpZScpIHtcbiAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLndhcm5pbmcnLCAnTE9DQUxfU1RPUkFHRV9OT1RfU1VQUE9SVEVEJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBjbGVhckFsbEZyb21Db29raWVzKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UgJiYgIXNlbGYuZGVmYXVsdFRvQ29va2llKVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgdmFyIHByZWZpeExlbmd0aCA9IHByZWZpeC5sZW5ndGg7XG5cbiAgICAgICAgZm9yICh2YXIga2V5IGluIHdlYlN0b3JhZ2UpIHtcbiAgICAgICAgICAvLyBPbmx5IHJlbW92ZSBpdGVtcyB0aGF0IGFyZSBmb3IgdGhpcyBhcHAgYW5kIG1hdGNoIHRoZSByZWd1bGFyIGV4cHJlc3Npb25cbiAgICAgICAgICBpZiAocHJlZml4UmVnZXgudGVzdChrZXkpICYmIHRlc3RSZWdleC50ZXN0KGtleS5zdWJzdHIocHJlZml4TGVuZ3RoKSkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJlbW92ZUZyb21Mb2NhbFN0b3JhZ2Uoa2V5LnN1YnN0cihwcmVmaXhMZW5ndGgpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGNsZWFyQWxsRnJvbUNvb2tpZXMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9O1xuXG4gICAgICAvLyBDaGVja3MgdGhlIGJyb3dzZXIgdG8gc2VlIGlmIGNvb2tpZXMgYXJlIHN1cHBvcnRlZFxuICAgICAgdmFyIGJyb3dzZXJTdXBwb3J0c0Nvb2tpZXMgPSAoZnVuY3Rpb24oKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcmV0dXJuICR3aW5kb3cubmF2aWdhdG9yLmNvb2tpZUVuYWJsZWQgfHxcbiAgICAgICAgICAoXCJjb29raWVcIiBpbiAkZG9jdW1lbnQgJiYgKCRkb2N1bWVudC5jb29raWUubGVuZ3RoID4gMCB8fFxuICAgICAgICAgICAgKCRkb2N1bWVudC5jb29raWUgPSBcInRlc3RcIikuaW5kZXhPZi5jYWxsKCRkb2N1bWVudC5jb29raWUsIFwidGVzdFwiKSA+IC0xKSk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0oKSk7XG5cbiAgICAgICAgLy8gRGlyZWN0bHkgYWRkcyBhIHZhbHVlIHRvIGNvb2tpZXNcbiAgICAgICAgLy8gVHlwaWNhbGx5IHVzZWQgYXMgYSBmYWxsYmFjayBpZiBsb2NhbCBzdG9yYWdlIGlzIG5vdCBhdmFpbGFibGUgaW4gdGhlIGJyb3dzZXJcbiAgICAgICAgLy8gRXhhbXBsZSB1c2U6IGxvY2FsU3RvcmFnZVNlcnZpY2UuY29va2llLmFkZCgnbGlicmFyeScsJ2FuZ3VsYXInKTtcbiAgICAgICAgdmFyIGFkZFRvQ29va2llcyA9IGZ1bmN0aW9uIChrZXksIHZhbHVlLCBkYXlzVG9FeHBpcnksIHNlY3VyZSkge1xuXG4gICAgICAgICAgaWYgKGlzVW5kZWZpbmVkKHZhbHVlKSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSBpZihpc0FycmF5KHZhbHVlKSB8fCBpc09iamVjdCh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHZhbHVlID0gdG9Kc29uKHZhbHVlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0Nvb2tpZXMpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsICdDT09LSUVTX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGV4cGlyeSA9ICcnLFxuICAgICAgICAgICAgZXhwaXJ5RGF0ZSA9IG5ldyBEYXRlKCksXG4gICAgICAgICAgICBjb29raWVEb21haW4gPSAnJztcblxuICAgICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIC8vIE1hcmsgdGhhdCB0aGUgY29va2llIGhhcyBleHBpcmVkIG9uZSBkYXkgYWdvXG4gICAgICAgICAgICAgIGV4cGlyeURhdGUuc2V0VGltZShleHBpcnlEYXRlLmdldFRpbWUoKSArICgtMSAqIDI0ICogNjAgKiA2MCAqIDEwMDApKTtcbiAgICAgICAgICAgICAgZXhwaXJ5ID0gXCI7IGV4cGlyZXM9XCIgKyBleHBpcnlEYXRlLnRvR01UU3RyaW5nKCk7XG4gICAgICAgICAgICAgIHZhbHVlID0gJyc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGlzTnVtYmVyKGRheXNUb0V4cGlyeSkgJiYgZGF5c1RvRXhwaXJ5ICE9PSAwKSB7XG4gICAgICAgICAgICAgIGV4cGlyeURhdGUuc2V0VGltZShleHBpcnlEYXRlLmdldFRpbWUoKSArIChkYXlzVG9FeHBpcnkgKiAyNCAqIDYwICogNjAgKiAxMDAwKSk7XG4gICAgICAgICAgICAgIGV4cGlyeSA9IFwiOyBleHBpcmVzPVwiICsgZXhwaXJ5RGF0ZS50b0dNVFN0cmluZygpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb29raWUuZXhwaXJ5ICE9PSAwKSB7XG4gICAgICAgICAgICAgIGV4cGlyeURhdGUuc2V0VGltZShleHBpcnlEYXRlLmdldFRpbWUoKSArIChjb29raWUuZXhwaXJ5ICogMjQgKiA2MCAqIDYwICogMTAwMCkpO1xuICAgICAgICAgICAgICBleHBpcnkgPSBcIjsgZXhwaXJlcz1cIiArIGV4cGlyeURhdGUudG9HTVRTdHJpbmcoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghIWtleSkge1xuICAgICAgICAgICAgICB2YXIgY29va2llUGF0aCA9IFwiOyBwYXRoPVwiICsgY29va2llLnBhdGg7XG4gICAgICAgICAgICAgIGlmIChjb29raWUuZG9tYWluKSB7XG4gICAgICAgICAgICAgICAgY29va2llRG9tYWluID0gXCI7IGRvbWFpbj1cIiArIGNvb2tpZS5kb21haW47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLyogUHJvdmlkaW5nIHRoZSBzZWN1cmUgcGFyYW1ldGVyIGFsd2F5cyB0YWtlcyBwcmVjZWRlbmNlIG92ZXIgY29uZmlnXG4gICAgICAgICAgICAgICAqIChhbGxvd3MgZGV2ZWxvcGVyIHRvIG1peCBhbmQgbWF0Y2ggc2VjdXJlICsgbm9uLXNlY3VyZSkgKi9cbiAgICAgICAgICAgICAgaWYgKHR5cGVvZiBzZWN1cmUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgICAgICAgaWYgKHNlY3VyZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgIC8qIFdlJ3ZlIGV4cGxpY2l0bHkgc3BlY2lmaWVkIHNlY3VyZSxcbiAgICAgICAgICAgICAgICAgICAgICAgKiBhZGQgdGhlIHNlY3VyZSBhdHRyaWJ1dGUgdG8gdGhlIGNvb2tpZSAoYWZ0ZXIgZG9tYWluKSAqL1xuICAgICAgICAgICAgICAgICAgICAgIGNvb2tpZURvbWFpbiArPSBcIjsgc2VjdXJlXCI7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAvLyBlbHNlIC0gc2VjdXJlIGhhcyBiZWVuIHN1cHBsaWVkIGJ1dCBpc24ndCB0cnVlIC0gc28gZG9uJ3Qgc2V0IHNlY3VyZSBmbGFnLCByZWdhcmRsZXNzIG9mIHdoYXQgY29uZmlnIHNheXNcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIGlmIChjb29raWUuc2VjdXJlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAvLyBzZWN1cmUgcGFyYW1ldGVyIHdhc24ndCBzcGVjaWZpZWQsIGdldCBkZWZhdWx0IGZyb20gY29uZmlnXG4gICAgICAgICAgICAgICAgICBjb29raWVEb21haW4gKz0gXCI7IHNlY3VyZVwiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICRkb2N1bWVudC5jb29raWUgPSBkZXJpdmVRdWFsaWZpZWRLZXkoa2V5KSArIFwiPVwiICsgZW5jb2RlVVJJQ29tcG9uZW50KHZhbHVlKSArIGV4cGlyeSArIGNvb2tpZVBhdGggKyBjb29raWVEb21haW47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KCdMb2NhbFN0b3JhZ2VNb2R1bGUubm90aWZpY2F0aW9uLmVycm9yJywgZS5tZXNzYWdlKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gRGlyZWN0bHkgZ2V0IGEgdmFsdWUgZnJvbSBhIGNvb2tpZVxuICAgICAgICAvLyBFeGFtcGxlIHVzZTogbG9jYWxTdG9yYWdlU2VydmljZS5jb29raWUuZ2V0KCdsaWJyYXJ5Jyk7IC8vIHJldHVybnMgJ2FuZ3VsYXInXG4gICAgICAgIHZhciBnZXRGcm9tQ29va2llcyA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICBpZiAoIWJyb3dzZXJTdXBwb3J0c0Nvb2tpZXMpIHtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdCgnTG9jYWxTdG9yYWdlTW9kdWxlLm5vdGlmaWNhdGlvbi5lcnJvcicsICdDT09LSUVTX05PVF9TVVBQT1JURUQnKTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgY29va2llcyA9ICRkb2N1bWVudC5jb29raWUgJiYgJGRvY3VtZW50LmNvb2tpZS5zcGxpdCgnOycpIHx8IFtdO1xuICAgICAgICAgIGZvcih2YXIgaT0wOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIHRoaXNDb29raWUgPSBjb29raWVzW2ldO1xuICAgICAgICAgICAgd2hpbGUgKHRoaXNDb29raWUuY2hhckF0KDApID09PSAnICcpIHtcbiAgICAgICAgICAgICAgdGhpc0Nvb2tpZSA9IHRoaXNDb29raWUuc3Vic3RyaW5nKDEsdGhpc0Nvb2tpZS5sZW5ndGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXNDb29raWUuaW5kZXhPZihkZXJpdmVRdWFsaWZpZWRLZXkoa2V5KSArICc9JykgPT09IDApIHtcbiAgICAgICAgICAgICAgdmFyIHN0b3JlZFZhbHVlcyA9IGRlY29kZVVSSUNvbXBvbmVudCh0aGlzQ29va2llLnN1YnN0cmluZyhwcmVmaXgubGVuZ3RoICsga2V5Lmxlbmd0aCArIDEsIHRoaXNDb29raWUubGVuZ3RoKSk7XG4gICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgdmFyIHBhcnNlZFZhbHVlID0gSlNPTi5wYXJzZShzdG9yZWRWYWx1ZXMpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YocGFyc2VkVmFsdWUpID09PSAnbnVtYmVyJyA/IHN0b3JlZFZhbHVlcyA6IHBhcnNlZFZhbHVlO1xuICAgICAgICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RvcmVkVmFsdWVzO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciByZW1vdmVGcm9tQ29va2llcyA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICBhZGRUb0Nvb2tpZXMoa2V5LG51bGwpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBjbGVhckFsbEZyb21Db29raWVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciB0aGlzQ29va2llID0gbnVsbDtcbiAgICAgICAgICB2YXIgcHJlZml4TGVuZ3RoID0gcHJlZml4Lmxlbmd0aDtcbiAgICAgICAgICB2YXIgY29va2llcyA9ICRkb2N1bWVudC5jb29raWUuc3BsaXQoJzsnKTtcbiAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpc0Nvb2tpZSA9IGNvb2tpZXNbaV07XG5cbiAgICAgICAgICAgIHdoaWxlICh0aGlzQ29va2llLmNoYXJBdCgwKSA9PT0gJyAnKSB7XG4gICAgICAgICAgICAgIHRoaXNDb29raWUgPSB0aGlzQ29va2llLnN1YnN0cmluZygxLCB0aGlzQ29va2llLmxlbmd0aCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBrZXkgPSB0aGlzQ29va2llLnN1YnN0cmluZyhwcmVmaXhMZW5ndGgsIHRoaXNDb29raWUuaW5kZXhPZignPScpKTtcbiAgICAgICAgICAgIHJlbW92ZUZyb21Db29raWVzKGtleSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHZhciBnZXRTdG9yYWdlVHlwZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiBzdG9yYWdlVHlwZTtcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgc2V0U3RvcmFnZVR5cGUgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgICAgICAgaWYgKHR5cGUgJiYgc3RvcmFnZVR5cGUgIT09IHR5cGUpIHtcbiAgICAgICAgICAgIHN0b3JhZ2VUeXBlID0gdHlwZTtcbiAgICAgICAgICAgIGJyb3dzZXJTdXBwb3J0c0xvY2FsU3RvcmFnZSA9IGNoZWNrU3VwcG9ydCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIEFkZCBhIGxpc3RlbmVyIG9uIHNjb3BlIHZhcmlhYmxlIHRvIHNhdmUgaXRzIGNoYW5nZXMgdG8gbG9jYWwgc3RvcmFnZVxuICAgICAgICAvLyBSZXR1cm4gYSBmdW5jdGlvbiB3aGljaCB3aGVuIGNhbGxlZCBjYW5jZWxzIGJpbmRpbmdcbiAgICAgICAgdmFyIGJpbmRUb1Njb3BlID0gZnVuY3Rpb24oc2NvcGUsIGtleSwgZGVmLCBsc0tleSwgdHlwZSkge1xuICAgICAgICAgIGxzS2V5ID0gbHNLZXkgfHwga2V5O1xuICAgICAgICAgIHZhciB2YWx1ZSA9IGdldEZyb21Mb2NhbFN0b3JhZ2UobHNLZXksIHR5cGUpO1xuXG4gICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsICYmIGlzRGVmaW5lZChkZWYpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGRlZjtcbiAgICAgICAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KHZhbHVlKSAmJiBpc09iamVjdChkZWYpKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IGV4dGVuZCh2YWx1ZSwgZGVmKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAkcGFyc2Uoa2V5KS5hc3NpZ24oc2NvcGUsIHZhbHVlKTtcblxuICAgICAgICAgIHJldHVybiBzY29wZS4kd2F0Y2goa2V5LCBmdW5jdGlvbihuZXdWYWwpIHtcbiAgICAgICAgICAgIGFkZFRvTG9jYWxTdG9yYWdlKGxzS2V5LCBuZXdWYWwsIHR5cGUpO1xuICAgICAgICAgIH0sIGlzT2JqZWN0KHNjb3BlW2tleV0pKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBBZGQgbGlzdGVuZXIgdG8gbG9jYWwgc3RvcmFnZSwgZm9yIHVwZGF0ZSBjYWxsYmFja3MuXG4gICAgICAgIGlmIChicm93c2VyU3VwcG9ydHNMb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgIGlmICgkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICAgICAgICAgICAgICAkd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJzdG9yYWdlXCIsIGhhbmRsZVN0b3JhZ2VDaGFuZ2VDYWxsYmFjaywgZmFsc2UpO1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAkd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJzdG9yYWdlXCIsIGhhbmRsZVN0b3JhZ2VDaGFuZ2VDYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYoJHdpbmRvdy5hdHRhY2hFdmVudCl7XG4gICAgICAgICAgICAgICAgLy8gYXR0YWNoRXZlbnQgYW5kIGRldGFjaEV2ZW50IGFyZSBwcm9wcmlldGFyeSB0byBJRSB2Ni0xMFxuICAgICAgICAgICAgICAgICR3aW5kb3cuYXR0YWNoRXZlbnQoXCJvbnN0b3JhZ2VcIiwgaGFuZGxlU3RvcmFnZUNoYW5nZUNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRvbignJGRlc3Ryb3knLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgJHdpbmRvdy5kZXRhY2hFdmVudChcIm9uc3RvcmFnZVwiLCBoYW5kbGVTdG9yYWdlQ2hhbmdlQ2FsbGJhY2spO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FsbGJhY2sgaGFuZGxlciBmb3Igc3RvcmFnZSBjaGFuZ2VkLlxuICAgICAgICBmdW5jdGlvbiBoYW5kbGVTdG9yYWdlQ2hhbmdlQ2FsbGJhY2soZSkge1xuICAgICAgICAgICAgaWYgKCFlKSB7IGUgPSAkd2luZG93LmV2ZW50OyB9XG4gICAgICAgICAgICBpZiAobm90aWZ5LnNldEl0ZW0pIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNTdHJpbmcoZS5rZXkpICYmIGlzS2V5UHJlZml4T3VycyhlLmtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGtleSA9IHVuZGVyaXZlUXVhbGlmaWVkS2V5KGUua2V5KTtcbiAgICAgICAgICAgICAgICAgICAgLy8gVXNlIHRpbWVvdXQsIHRvIGF2b2lkIHVzaW5nICRyb290U2NvcGUuJGFwcGx5LlxuICAgICAgICAgICAgICAgICAgICAkdGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoJ0xvY2FsU3RvcmFnZU1vZHVsZS5ub3RpZmljYXRpb24uY2hhbmdlZCcsIHsga2V5OiBrZXksIG5ld3ZhbHVlOiBlLm5ld1ZhbHVlLCBzdG9yYWdlVHlwZTogc2VsZi5zdG9yYWdlVHlwZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmV0dXJuIGxvY2FsU3RvcmFnZVNlcnZpY2UubGVuZ3RoXG4gICAgICAgIC8vIGlnbm9yZSBrZXlzIHRoYXQgbm90IG93bmVkXG4gICAgICAgIHZhciBsZW5ndGhPZkxvY2FsU3RvcmFnZSA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgICAgICAgICBzZXRTdG9yYWdlVHlwZSh0eXBlKTtcblxuICAgICAgICAgIHZhciBjb3VudCA9IDA7XG4gICAgICAgICAgdmFyIHN0b3JhZ2UgPSAkd2luZG93W3N0b3JhZ2VUeXBlXTtcbiAgICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgc3RvcmFnZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYoc3RvcmFnZS5rZXkoaSkuaW5kZXhPZihwcmVmaXgpID09PSAwICkge1xuICAgICAgICAgICAgICBjb3VudCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gY291bnQ7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBpc1N1cHBvcnRlZDogYnJvd3NlclN1cHBvcnRzTG9jYWxTdG9yYWdlLFxuICAgICAgICAgIGdldFN0b3JhZ2VUeXBlOiBnZXRTdG9yYWdlVHlwZSxcbiAgICAgICAgICBzZXRTdG9yYWdlVHlwZTogc2V0U3RvcmFnZVR5cGUsXG4gICAgICAgICAgc2V0OiBhZGRUb0xvY2FsU3RvcmFnZSxcbiAgICAgICAgICBhZGQ6IGFkZFRvTG9jYWxTdG9yYWdlLCAvL0RFUFJFQ0FURURcbiAgICAgICAgICBnZXQ6IGdldEZyb21Mb2NhbFN0b3JhZ2UsXG4gICAgICAgICAga2V5czogZ2V0S2V5c0ZvckxvY2FsU3RvcmFnZSxcbiAgICAgICAgICByZW1vdmU6IHJlbW92ZUZyb21Mb2NhbFN0b3JhZ2UsXG4gICAgICAgICAgY2xlYXJBbGw6IGNsZWFyQWxsRnJvbUxvY2FsU3RvcmFnZSxcbiAgICAgICAgICBiaW5kOiBiaW5kVG9TY29wZSxcbiAgICAgICAgICBkZXJpdmVLZXk6IGRlcml2ZVF1YWxpZmllZEtleSxcbiAgICAgICAgICB1bmRlcml2ZUtleTogdW5kZXJpdmVRdWFsaWZpZWRLZXksXG4gICAgICAgICAgbGVuZ3RoOiBsZW5ndGhPZkxvY2FsU3RvcmFnZSxcbiAgICAgICAgICBkZWZhdWx0VG9Db29raWU6IHRoaXMuZGVmYXVsdFRvQ29va2llLFxuICAgICAgICAgIGNvb2tpZToge1xuICAgICAgICAgICAgaXNTdXBwb3J0ZWQ6IGJyb3dzZXJTdXBwb3J0c0Nvb2tpZXMsXG4gICAgICAgICAgICBzZXQ6IGFkZFRvQ29va2llcyxcbiAgICAgICAgICAgIGFkZDogYWRkVG9Db29raWVzLCAvL0RFUFJFQ0FURURcbiAgICAgICAgICAgIGdldDogZ2V0RnJvbUNvb2tpZXMsXG4gICAgICAgICAgICByZW1vdmU6IHJlbW92ZUZyb21Db29raWVzLFxuICAgICAgICAgICAgY2xlYXJBbGw6IGNsZWFyQWxsRnJvbUNvb2tpZXNcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XTtcbiAgfSk7XG59KSh3aW5kb3csIHdpbmRvdy5hbmd1bGFyKTsiLCIoZnVuY3Rpb24oKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuXHRhbmd1bGFyXG5cdFx0Lm1vZHVsZSgnYW5ndWxhci1tYXJxdWVlJywgW10pXG5cdFx0LmRpcmVjdGl2ZSgnYW5ndWxhck1hcnF1ZWUnLCBhbmd1bGFyTWFycXVlZSk7XG5cblx0ZnVuY3Rpb24gYW5ndWxhck1hcnF1ZWUoJHRpbWVvdXQpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRcdHNjb3BlOiB0cnVlLFxuXHRcdFx0Y29tcGlsZTogZnVuY3Rpb24odEVsZW1lbnQsIHRBdHRycykge1xuXHRcdFx0XHRpZiAodEVsZW1lbnQuY2hpbGRyZW4oKS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHR0RWxlbWVudC5hcHBlbmQoJzxkaXY+JyArIHRFbGVtZW50LnRleHQoKSArICc8L2Rpdj4nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgY29udGVudCA9IHRFbGVtZW50LmNoaWxkcmVuKCk7XG4gICAgICBcdHZhciAkZWxlbWVudCA9ICQodEVsZW1lbnQpO1xuXHRcdFx0XHQkKHRFbGVtZW50KS5lbXB0eSgpO1xuXHRcdFx0XHR0RWxlbWVudC5hcHBlbmQoJzxkaXYgY2xhc3M9XCJhbmd1bGFyLW1hcnF1ZWVcIiBzdHlsZT1cImZsb2F0OmxlZnQ7XCI+JyArIGNvbnRlbnQuY2xvbmUoKVswXS5vdXRlckhUTUwgKyAnPC9kaXY+Jyk7XG4gICAgICAgIHZhciAkaXRlbSA9ICRlbGVtZW50LmZpbmQoJy5hbmd1bGFyLW1hcnF1ZWUnKTtcbiAgICAgICAgJGl0ZW0uY2xvbmUoKS5jc3MoJ2Rpc3BsYXknLCdub25lJykuYXBwZW5kVG8oJGVsZW1lbnQpO1xuXHRcdFx0XHQkZWxlbWVudC53cmFwSW5uZXIoJzxkaXYgc3R5bGU9XCJ3aWR0aDoxMDAwMDBweFwiIGNsYXNzPVwiYW5ndWxhci1tYXJxdWVlLXdyYXBwZXJcIj48L2Rpdj4nKTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0cG9zdDogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzKSB7XG5cdFx0XHRcdFx0XHRcdC8vZGlyZWN0aW9uLCBkdXJhdGlvbixcblx0XHRcdFx0XHRcdFx0dmFyICRlbGVtZW50ID0gJChlbGVtZW50KTtcblx0XHRcdFx0XHRcdFx0dmFyICRpdGVtID0gJGVsZW1lbnQuZmluZCgnLmFuZ3VsYXItbWFycXVlZTpmaXJzdCcpO1xuXHRcdFx0XHRcdFx0XHR2YXIgJG1hcnF1ZWUgPSAkZWxlbWVudC5maW5kKCcuYW5ndWxhci1tYXJxdWVlLXdyYXBwZXInKTtcblx0XHRcdFx0XHRcdFx0dmFyICRjbG9uZUl0ZW0gPSAkZWxlbWVudC5maW5kKCcuYW5ndWxhci1tYXJxdWVlOmxhc3QnKTtcblx0XHRcdFx0XHRcdFx0dmFyIGR1cGxpY2F0ZWQgPSBmYWxzZTtcblxuXHRcdFx0XHRcdFx0XHR2YXIgY29udGFpbmVyV2lkdGggPSBwYXJzZUludCgkZWxlbWVudC53aWR0aCgpKTtcblx0XHRcdFx0XHRcdFx0dmFyIGl0ZW1XaWR0aCA9IHBhcnNlSW50KCRpdGVtLndpZHRoKCkpO1xuXHRcdFx0XHRcdFx0XHR2YXIgZGVmYXVsdE9mZnNldCA9IDIwO1xuXHRcdFx0XHRcdFx0XHR2YXIgZHVyYXRpb24gPSAzMDAwO1xuXHRcdFx0XHRcdFx0XHR2YXIgc2Nyb2xsID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdHZhciBhbmltYXRpb25Dc3NOYW1lID0gJyc7XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gY2FsY3VsYXRlV2lkdGhBbmRIZWlnaHQoKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29udGFpbmVyV2lkdGggPSBwYXJzZUludCgkZWxlbWVudC53aWR0aCgpKTtcblx0XHRcdFx0XHRcdFx0XHRpdGVtV2lkdGggPSBwYXJzZUludCgkaXRlbS53aWR0aCgpKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoaXRlbVdpZHRoID4gY29udGFpbmVyV2lkdGgpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGR1cGxpY2F0ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRkdXBsaWNhdGVkID0gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0aWYgKGR1cGxpY2F0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHQkY2xvbmVJdGVtLnNob3coKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0JGNsb25lSXRlbS5oaWRlKCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0JGVsZW1lbnQuaGVpZ2h0KCRpdGVtLmhlaWdodCgpKTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIF9vYmpUb1N0cmluZyhvYmopIHtcblx0XHRcdFx0XHRcdFx0XHR2YXIgdGFianNvbiA9IFtdO1xuXHRcdFx0XHRcdFx0XHRcdGZvciAodmFyIHAgaW4gb2JqKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmIChvYmouaGFzT3duUHJvcGVydHkocCkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHRhYmpzb24ucHVzaChwICsgJzonICsgb2JqW3BdKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR0YWJqc29uLnB1c2goKTtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gJ3snICsgdGFianNvbi5qb2luKCcsJykgKyAnfSc7XG5cdFx0XHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gY2FsY3VsYXRlQW5pbWF0aW9uRHVyYXRpb24obmV3RHVyYXRpb24pIHtcblx0XHRcdFx0XHRcdFx0XHR2YXIgcmVzdWx0ID0gKGl0ZW1XaWR0aCArIGNvbnRhaW5lcldpZHRoKSAvIGNvbnRhaW5lcldpZHRoICogbmV3RHVyYXRpb24gLyAxMDAwO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChkdXBsaWNhdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXN1bHQgPSByZXN1bHQgLyAyO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gZ2V0QW5pbWF0aW9uUHJlZml4KCkge1xuXHRcdFx0XHRcdFx0XHRcdHZhciBlbG0gPSBkb2N1bWVudC5ib2R5IHx8IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0XHRcdFx0XHRcdHZhciBkb21QcmVmaXhlcyA9IFsnd2Via2l0JywgJ21veicsJ08nLCdtcycsJ0todG1sJ107XG5cblx0XHRcdFx0XHRcdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGRvbVByZWZpeGVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZWxtLnN0eWxlW2RvbVByZWZpeGVzW2ldICsgJ0FuaW1hdGlvbk5hbWUnXSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHZhciBwcmVmaXggPSBkb21QcmVmaXhlc1tpXS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gcHJlZml4O1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGZ1bmN0aW9uIGNyZWF0ZUtleWZyYW1lKG51bWJlcikge1xuXHRcdFx0XHRcdFx0XHRcdHZhciBwcmVmaXggPSBnZXRBbmltYXRpb25QcmVmaXgoKTtcblxuXHRcdFx0XHRcdFx0XHRcdHZhciBtYXJnaW4gPSBpdGVtV2lkdGg7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gaWYgKGR1cGxpY2F0ZWQpIHtcblx0XHRcdFx0XHRcdFx0XHQvLyBcdG1hcmdpbiA9IGl0ZW1XaWR0aFxuXHRcdFx0XHRcdFx0XHRcdC8vIH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gXHRtYXJnaW4gPSBpdGVtV2lkdGggKyBjb250YWluZXJXaWR0aDtcblx0XHRcdFx0XHRcdFx0XHQvLyB9XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGtleWZyYW1lU3RyaW5nID0gJ0AtJyArIHByZWZpeCArICcta2V5ZnJhbWVzICcgKyAnc2ltcGxlTWFycXVlZScgKyBudW1iZXI7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGNzcyA9IHtcblx0XHRcdFx0XHRcdFx0XHRcdCdtYXJnaW4tbGVmdCc6IC0gKG1hcmdpbikgKydweCdcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0dmFyIGtleWZyYW1lQ3NzID0ga2V5ZnJhbWVTdHJpbmcgKyAneyAxMDAlJyArIF9vYmpUb1N0cmluZyhjc3MpICsgJ30nO1xuXHRcdFx0XHRcdFx0XHRcdHZhciAkc3R5bGVzID0gJCgnc3R5bGUnKTtcblxuXHRcdFx0XHRcdFx0XHRcdC8vTm93IGFkZCB0aGUga2V5ZnJhbWUgYW5pbWF0aW9uIHRvIHRoZSBoZWFkXG5cdFx0XHRcdFx0XHRcdFx0aWYgKCRzdHlsZXMubGVuZ3RoICE9PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdC8vQnVnIGZpeGVkIGZvciBqUXVlcnkgMS4zLnggLSBJbnN0ZWFkIG9mIHVzaW5nIC5sYXN0KCksIHVzZSBmb2xsb3dpbmdcblx0XHRcdFx0XHRcdFx0XHRcdFx0JHN0eWxlcy5maWx0ZXIoXCI6bGFzdFwiKS5hcHBlbmQoa2V5ZnJhbWVDc3MpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdCQoJ2hlYWQnKS5hcHBlbmQoJzxzdHlsZT4nICsga2V5ZnJhbWVDc3MgKyAnPC9zdHlsZT4nKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBzdG9wQW5pbWF0aW9uKCkge1xuXHRcdFx0XHRcdFx0XHRcdCRtYXJxdWVlLmNzcygnbWFyZ2luLWxlZnQnLDApO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChhbmltYXRpb25Dc3NOYW1lICE9ICcnKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQkbWFycXVlZS5jc3MoYW5pbWF0aW9uQ3NzTmFtZSwgJycpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHR9XG5cblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBjcmVhdGVBbmltYXRpb25Dc3MobnVtYmVyKSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIHRpbWUgPSBjYWxjdWxhdGVBbmltYXRpb25EdXJhdGlvbihkdXJhdGlvbik7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIHByZWZpeCA9IGdldEFuaW1hdGlvblByZWZpeCgpO1xuXHRcdFx0XHRcdFx0XHRcdGFuaW1hdGlvbkNzc05hbWUgPSAnLScgKyBwcmVmaXggKyctYW5pbWF0aW9uJztcblx0XHRcdFx0XHRcdFx0XHR2YXIgY3NzVmFsdWUgPSAnc2ltcGxlTWFycXVlZScgKyBudW1iZXIgKyAnICcgKyB0aW1lICsgJ3MgMHMgbGluZWFyIGluZmluaXRlJztcblx0XHRcdFx0XHRcdFx0XHQkbWFycXVlZS5jc3MoYW5pbWF0aW9uQ3NzTmFtZSwgY3NzVmFsdWUpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChkdXBsaWNhdGVkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQkbWFycXVlZS5jc3MoJ21hcmdpbi1sZWZ0JywgMCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBtYXJnaW4gPSBjb250YWluZXJXaWR0aCArIGRlZmF1bHRPZmZzZXQ7XG5cdFx0XHRcdFx0XHRcdFx0XHQkbWFycXVlZS5jc3MoJ21hcmdpbi1sZWZ0JywgbWFyZ2luKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRmdW5jdGlvbiBhbmltYXRlKCkge1xuXHRcdFx0XHRcdFx0XHRcdC8vY3JlYXRlIGNzcyBzdHlsZVxuXHRcdFx0XHRcdFx0XHRcdC8vY3JlYXRlIGtleWZyYW1lXG5cdFx0XHRcdFx0XHRcdFx0Y2FsY3VsYXRlV2lkdGhBbmRIZWlnaHQoKTtcblx0XHRcdFx0XHRcdFx0XHR2YXIgbnVtYmVyID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDAwMCk7XG5cdFx0XHRcdFx0XHRcdFx0Y3JlYXRlS2V5ZnJhbWUobnVtYmVyKTtcblx0XHRcdFx0XHRcdFx0XHRjcmVhdGVBbmltYXRpb25Dc3MobnVtYmVyKTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHNjb3BlLiR3YXRjaChhdHRycy5zY3JvbGwsIGZ1bmN0aW9uKHNjcm9sbEF0dHJWYWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRcdHNjcm9sbCA9IHNjcm9sbEF0dHJWYWx1ZTtcblx0XHRcdFx0XHRcdFx0XHRyZWNhbGN1bGF0ZU1hcnF1ZWUoKTtcblx0XHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdFx0ZnVuY3Rpb24gcmVjYWxjdWxhdGVNYXJxdWVlKCkge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChzY3JvbGwpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGFuaW1hdGUoKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0c3RvcEFuaW1hdGlvbigpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdHZhciB0aW1lcjtcblx0XHRcdFx0XHRcdFx0c2NvcGUuJG9uKCdyZWNhbGN1bGF0ZU1hcnF1ZWUnLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCdyZWNlaXZlIHJlY2FsY3VsYXRlTWFycXVlZSBldmVudCcpO1xuXHRcdFx0XHRcdFx0XHRcdGlmICh0aW1lcikge1xuXHRcdFx0XHRcdFx0XHRcdFx0JHRpbWVvdXQuY2FuY2VsKHRpbWVyKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0dGltZXIgPSAkdGltZW91dChmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJlY2FsY3VsYXRlTWFycXVlZSgpO1xuXHRcdFx0XHRcdFx0XHRcdH0sIDUwMCk7XG5cblx0XHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdFx0c2NvcGUuJHdhdGNoKGF0dHJzLmR1cmF0aW9uLCBmdW5jdGlvbihkdXJhdGlvblRleHQpIHtcblx0XHRcdFx0XHRcdFx0XHRkdXJhdGlvbiA9IHBhcnNlSW50KGR1cmF0aW9uVGV4dCk7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHNjcm9sbCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0YW5pbWF0ZSgpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHR9XG5cbn0pKCk7IiwidmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKFwibnR1QXBwXCIsIFsnTG9jYWxTdG9yYWdlTW9kdWxlJywgJ2FuZ3VsYXItbWFycXVlZSddKTtcblxuXG5hcHAuY29uZmlnKGZ1bmN0aW9uKGxvY2FsU3RvcmFnZVNlcnZpY2VQcm92aWRlcikge1xuICAgIGxvY2FsU3RvcmFnZVNlcnZpY2VQcm92aWRlclxuICAgICAgICAuc2V0UHJlZml4KCdOVFUtSUNBTi1QTEFZRVInKTtcbn0pO1xuXG5hcHAuZGlyZWN0aXZlKCdwcmVzc0VudGVyJywgZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRycykge1xuICAgICAgICBlbGVtZW50LmJpbmQoXCJrZXlkb3duIGtleXByZXNzXCIsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQud2hpY2ggPT09IDEzKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICBzY29wZS4kZXZhbChhdHRycy5wcmVzc0VudGVyKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH07XG59KTtcbmFwcC5jb250cm9sbGVyKFwiTXVzaWNQbGF5ZXJDb250cm9sbGVyXCIsIGZ1bmN0aW9uKCRzY29wZSwgJHRpbWVvdXQsICRsb2NhdGlvbiwgJGh0dHAsIFBsYXllckZhY3RvcnksIGdvb2dsZVNlcnZpY2UsIGxvY2FsU3RvcmFnZVNlcnZpY2UpIHtcbiAgICAkc2NvcGUuc2VhcmNoaW5nID0gZmFsc2U7XG4gICAgJHNjb3BlLm11c2ljTGlzdHMgPSBbXTtcbiAgICAkc2NvcGUuc2VhcmNoUXVlcnkgPSBcIlwiO1xuXG5cbiAgICAvL01hcnF1ZWVcblxuICAgICRzY29wZS5kdXJhdGlvbiA9IDEwMDAwO1xuXG4gICAgZnVuY3Rpb24gYWRkTWFycXVlZShtdXNpY0xpc3RzKSB7XG4gICAgICAgIGlmIChtdXNpY0xpc3RzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICBtdXNpY0xpc3RzLmZvckVhY2goZnVuY3Rpb24obSwgaSkge1xuICAgICAgICAgICAgICAgIG0ubWFycXVlZS5zY3JvbGwgPSBmYWxzZTtcblxuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICAvLyAkc2NvcGUubXVzaWNMaXN0cyA9IFt7XG4gICAgLy8gICAgIF9pZDogXCJpNUxPVjZyNDVpOFwiLFxuICAgIC8vICAgICB0aXRsZTogXCLjgJBBTElWRSBMaXZlIFNlc3Npb27jgJHmu4XngavlmajvvI3ln7rpmobot69cIixcbiAgICAvLyAgICAgdXJsOiBcImh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL2VtYmVkL2k1TE9WNnI0NWk4XCIsXG4gICAgLy8gICAgIGltYWdlOiBcImh0dHA6Ly9pbWcueW91dHViZS5jb20vdmkvaTVMT1Y2cjQ1aTgvMC5qcGdcIixcbiAgICAvLyAgICAgZGVzY3JpcHRpb246IFwi6IG96Kqq77yM5LuK5aSp55m85L2I55qE5piv5paw5q2M44CCIOiBveiqqu+8jOa7heeBq+WZqOWcqOOAkEFMSVZF57O75YiX5ryU5ZSx5pyD44CR5pyD5oqr6Zyy44CQ5pu05aSa5paw5q2M44CRIDQvMeaZmuS4ijjpu55ATGVnYWN5IFRhaXBlae+8jOS4gOWumuimgeS+hu+8gSDllZ/llK7mmYLplpPpoJDoqIgy5pyI5Lit5LiL5pes5YWs5biDLi4uXCIsXG4gICAgLy8gICAgIGlzU2VsZWN0OiBmYWxzZSxcbiAgICAvLyAgICAgaXNGYXZvcml0ZTogZmFsc2VcbiAgICAvLyB9LCB7XG4gICAgLy8gICAgIF9pZDogXCJpNUxPVjZyNDVpOFwiLFxuICAgIC8vICAgICB0aXRsZTogXCLjgJBBTElWRSBMaXZlIFNlc3Npb27jgJHmu4XngavlmajvvI3ln7rpmobot69cIixcbiAgICAvLyAgICAgdXJsOiBcImh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL2VtYmVkL2k1TE9WNnI0NWk4XCIsXG4gICAgLy8gICAgIGltYWdlOiBcImh0dHA6Ly9pbWcueW91dHViZS5jb20vdmkvaTVMT1Y2cjQ1aTgvMC5qcGdcIixcbiAgICAvLyAgICAgZGVzY3JpcHRpb246IFwi6IG96Kqq77yM5LuK5aSp55m85L2I55qE5piv5paw5q2M44CCIOiBveiqqu+8jOa7heeBq+WZqOWcqOOAkEFMSVZF57O75YiX5ryU5ZSx5pyD44CR5pyD5oqr6Zyy44CQ5pu05aSa5paw5q2M44CRIDQvMeaZmuS4ijjpu55ATGVnYWN5IFRhaXBlae+8jOS4gOWumuimgeS+hu+8gSDllZ/llK7mmYLplpPpoJDoqIgy5pyI5Lit5LiL5pes5YWs5biDLi4uXCIsXG4gICAgLy8gICAgIGlzU2VsZWN0OiBmYWxzZSxcbiAgICAvLyAgICAgaXNGYXZvcml0ZTogZmFsc2VcbiAgICAvLyB9LCB7XG4gICAgLy8gICAgIF9pZDogXCJpNUxPVjZyNDVpOFwiLFxuICAgIC8vICAgICB0aXRsZTogXCLjgJBBTElWRSBMaXZlIFNlc3Npb27jgJHmu4XngavlmajvvI3ln7rpmobot69cIixcbiAgICAvLyAgICAgdXJsOiBcImh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL2VtYmVkL2k1TE9WNnI0NWk4XCIsXG4gICAgLy8gICAgIGltYWdlOiBcImh0dHA6Ly9pbWcueW91dHViZS5jb20vdmkvaTVMT1Y2cjQ1aTgvMC5qcGdcIixcbiAgICAvLyAgICAgZGVzY3JpcHRpb246IFwi6IG96Kqq77yM5LuK5aSp55m85L2I55qE5piv5paw5q2M44CCIOiBveiqqu+8jOa7heeBq+WZqOWcqOOAkEFMSVZF57O75YiX5ryU5ZSx5pyD44CR5pyD5oqr6Zyy44CQ5pu05aSa5paw5q2M44CRIDQvMeaZmuS4ijjpu55ATGVnYWN5IFRhaXBlae+8jOS4gOWumuimgeS+hu+8gSDllZ/llK7mmYLplpPpoJDoqIgy5pyI5Lit5LiL5pes5YWs5biDLi4uXCIsXG4gICAgLy8gICAgIGlzU2VsZWN0OiBmYWxzZSxcbiAgICAvLyAgICAgaXNGYXZvcml0ZTogZmFsc2VcbiAgICAvLyB9LCB7XG4gICAgLy8gICAgIF9pZDogXCJpNUxPVjZyNDVpOFwiLFxuICAgIC8vICAgICB0aXRsZTogXCLjgJBBTElWRSBMaXZlIFNlc3Npb27jgJHmu4XngavlmajvvI3ln7rpmobot69cIixcbiAgICAvLyAgICAgdXJsOiBcImh0dHBzOi8vd3d3LnlvdXR1YmUuY29tL2VtYmVkL2k1TE9WNnI0NWk4XCIsXG4gICAgLy8gICAgIGltYWdlOiBcImh0dHA6Ly9pbWcueW91dHViZS5jb20vdmkvaTVMT1Y2cjQ1aTgvMC5qcGdcIixcbiAgICAvLyAgICAgZGVzY3JpcHRpb246IFwi6IG96Kqq77yM5LuK5aSp55m85L2I55qE5piv5paw5q2M44CCIOiBveiqqu+8jOa7heeBq+WZqOWcqOOAkEFMSVZF57O75YiX5ryU5ZSx5pyD44CR5pyD5oqr6Zyy44CQ5pu05aSa5paw5q2M44CRIDQvMeaZmuS4ijjpu55ATGVnYWN5IFRhaXBlae+8jOS4gOWumuimgeS+hu+8gSDllZ/llK7mmYLplpPpoJDoqIgy5pyI5Lit5LiL5pes5YWs5biDLi4uXCIsXG4gICAgLy8gICAgIGlzU2VsZWN0OiBmYWxzZSxcbiAgICAvLyAgICAgaXNGYXZvcml0ZTogZmFsc2VcbiAgICAvLyB9XTtcblxuICAgICRzY29wZS5pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICRzY29wZS5tdXNpY0xpc3RzID0gbG9hZFNlYXJjaCgpO1xuICAgICAgICB2YXIgZmF2b3JpdGVMaXN0cyA9IGxvYWRGYXZvcml0ZSgpO1xuICAgICAgICBpZiAoZmF2b3JpdGVMaXN0cylcbiAgICAgICAgICAgICRzY29wZS5tdXNpY0xpc3RzLmZvckVhY2goZnVuY3Rpb24obSwgaSkge1xuICAgICAgICAgICAgICAgIGZhdm9yaXRlTGlzdHMuZm9yRWFjaChmdW5jdGlvbihmLCBqKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtLl9pZCA9PSBmLl9pZCkgbS5pc0Zhdm9yaXRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICBhZGRNYXJxdWVlKCRzY29wZS5tdXNpY0xpc3RzKTtcblxuICAgIH1cblxuXG4gICAgJHNjb3BlLnNlYXJjaCA9IGZ1bmN0aW9uKHF1ZXJ5KSB7XG5cbiAgICAgICAgJHNjb3BlLm11c2ljTGlzdHMgPSBbXTtcbiAgICAgICAgJHNjb3BlLnNlYXJjaGluZyA9IHRydWU7XG4gICAgICAgIGdvb2dsZVNlcnZpY2UuZ29vZ2xlQXBpQ2xpZW50UmVhZHkocXVlcnkpLnRoZW4oZnVuY3Rpb24oZGF0YSkge1xuXG4gICAgICAgICAgICBpZiAoZGF0YS5pdGVtcykge1xuICAgICAgICAgICAgICAgIGRhdGEuaXRlbXMuZm9yRWFjaChmdW5jdGlvbihpdGVtLCBpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpdGVtWydpZCddWyd2aWRlb0lkJ10pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBtdXNpY0NhcmQgPSB7fTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC5faWQgPSBpdGVtWydpZCddWyd2aWRlb0lkJ107XG4gICAgICAgICAgICAgICAgICAgICAgICBtdXNpY0NhcmQudGl0bGUgPSBpdGVtWydzbmlwcGV0J11bJ3RpdGxlJ107XG4gICAgICAgICAgICAgICAgICAgICAgICBtdXNpY0NhcmQudXJsID0gXCJodHRwczovL3d3dy55b3V0dWJlLmNvbS9lbWJlZC9cIiArIG11c2ljQ2FyZC5faWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBtdXNpY0NhcmQuaW1hZ2UgPSBcImh0dHA6Ly9pbWcueW91dHViZS5jb20vdmkvXCIgKyBtdXNpY0NhcmQuX2lkICsgXCIvMC5qcGdcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC5kZXNjcmlwdGlvbiA9IGl0ZW1bJ3NuaXBwZXQnXVsnZGVzY3JpcHRpb24nXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG11c2ljQ2FyZC5pc1NlbGVjdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbXVzaWNDYXJkLmlzRmF2b3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICRzY29wZS5tdXNpY0xpc3RzLnB1c2gobXVzaWNDYXJkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuXG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYWxlcnQoXCLmkJzlsIvpjK/oqqRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAkc2NvcGUuc2VhcmNoaW5nID0gZmFsc2U7XG4gICAgICAgICAgICBzYXZlU2VhcmNoKCRzY29wZS5tdXNpY0xpc3RzKTtcbiAgICAgICAgICAgIGFkZE1hcnF1ZWUoJHNjb3BlLm11c2ljTGlzdHMpO1xuICAgICAgICB9KTtcblxuXG4gICAgfVxuXG5cbiAgICBmdW5jdGlvbiBsb2FkU2VhcmNoKCkge1xuICAgICAgICBjb25zb2xlLmxvZyhcIuiugOWPluS4iuasoeaQnOWwi+eLgOaFiy4uXCIpO1xuICAgICAgICBpZiAobG9jYWxTdG9yYWdlU2VydmljZS5pc1N1cHBvcnRlZCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldExvY2FsU3RvcmdlKCdOVFUtSUNBTi1QTEFZRVItU0VBUkNIJyk7XG4gICAgICAgIH1cblxuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gc2F2ZVNlYXJjaChtdXNpY0xpc3RzKSB7XG5cbiAgICAgICAgaWYgKGxvY2FsU3RvcmFnZVNlcnZpY2UuaXNTdXBwb3J0ZWQpIHtcblxuICAgICAgICAgICAgc2V0TG9jYWxTdG9yZ2UoJ05UVS1JQ0FOLVBMQVlFUi1TRUFSQ0gnLCBtdXNpY0xpc3RzKVxuICAgICAgICB9XG5cblxuICAgIH1cblxuXG5cbiAgICAkc2NvcGUucGxheVZpZGVvID0gZnVuY3Rpb24oZXZlbnQsIG11c2ljQ2FyZCkge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgY29uc29sZS5sb2cobXVzaWNDYXJkKTtcblxuICAgIH1cblxuICAgICRzY29wZS5hZGRUb015RmF2b3JpdGUgPSBmdW5jdGlvbihldmVudCwgbXVzaWNDYXJkKSB7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBtdXNpY0NhcmQuaXNGYXZvcml0ZSA9ICFtdXNpY0NhcmQuaXNGYXZvcml0ZTtcbiAgICAgICAgLy8gc2F2ZVNlYXJjaCgkc2NvcGUubXVzaWNMaXN0cyk7XG5cblxuICAgICAgICB2YXIgZmF2b3JpdGVMaXN0cyA9ICRzY29wZS5tdXNpY0xpc3RzLmZpbHRlcihmdW5jdGlvbihtKSB7XG4gICAgICAgICAgICBpZiAobS5pc0Zhdm9yaXRlKVxuICAgICAgICAgICAgICAgIHJldHVybiBtO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICB9KTtcbiAgICAgICAgc2F2ZUZhdm9yaXRlKGZhdm9yaXRlTGlzdHMpO1xuXG5cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvYWRGYXZvcml0ZSgpIHtcbiAgICAgICAgaWYgKGxvY2FsU3RvcmFnZVNlcnZpY2UuaXNTdXBwb3J0ZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRMb2NhbFN0b3JnZSgnTlRVLUlDQU4tUExBWUVSLUZBVk9SSVRFJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzYXZlRmF2b3JpdGUobXVzaWNMaXN0cykge1xuXG4gICAgICAgIGlmIChsb2NhbFN0b3JhZ2VTZXJ2aWNlLmlzU3VwcG9ydGVkKSB7XG5cbiAgICAgICAgICAgIHNldExvY2FsU3RvcmdlKCdOVFUtSUNBTi1QTEFZRVItRkFWT1JJVEUnLCBtdXNpY0xpc3RzKVxuICAgICAgICB9XG5cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNldExvY2FsU3RvcmdlKGtleSwgdmFsKSB7XG4gICAgICAgIHJldHVybiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLnNldChrZXksIHZhbCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0TG9jYWxTdG9yZ2Uoa2V5KSB7XG4gICAgICAgIHJldHVybiBsb2NhbFN0b3JhZ2VTZXJ2aWNlLmdldChrZXkpO1xuICAgIH1cblxuXG4gICAgJHNjb3BlLmFkZFRvUGxheWVyTGlzdCA9IGZ1bmN0aW9uKGV2ZW50LCBtdXNpY0NhcmQpIHtcbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblxuXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKG11c2ljQ2FyZCk7XG5cbiAgICB9XG5cblxuXG4gICAgJHNjb3BlLnNlbGVjdE11c2ljQ2FyZCA9IGZ1bmN0aW9uKG11c2ljQ2FyZCkge1xuICAgICAgICB2YXIgdG9nZ2xlID0gdHJ1ZTtcbiAgICAgICAgaWYgKG11c2ljQ2FyZC5pc1NlbGVjdCA9PSB0cnVlKVxuICAgICAgICAgICAgdG9nZ2xlID0gZmFsc2U7XG5cbiAgICAgICAgY2xlYW5TZWxlY3RlZCgpO1xuXG4gICAgICAgIG11c2ljQ2FyZC5pc1NlbGVjdCA9IHRvZ2dsZTtcblxuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gc2F2ZU15RmF2b3JpdGUoKSB7XG4gICAgICAgICRzY29wZS5tdXNpY0xpc3RzLmZvckVhY2goZnVuY3Rpb24obXVzaWNDYXJkLCBpKSB7XG4gICAgICAgICAgICBtdXNpY0NhcmQuaXNTZWxlY3QgPSBmYWxzZTtcblxuICAgICAgICB9KTtcblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNsZWFuU2VsZWN0ZWQoKSB7XG4gICAgICAgICRzY29wZS5tdXNpY0xpc3RzLmZvckVhY2goZnVuY3Rpb24obXVzaWNDYXJkLCBpKSB7XG4gICAgICAgICAgICBtdXNpY0NhcmQuaXNTZWxlY3QgPSBmYWxzZTtcblxuICAgICAgICB9KTtcblxuICAgIH1cblxufSk7XG5cbmFwcC5mYWN0b3J5KCdQbGF5ZXJGYWN0b3J5JywgZnVuY3Rpb24oJHEsICRodHRwKSB7XG5cbiAgICB2YXIgX2ZhY3RvcnkgPSB7fTtcbiAgICBfZmFjdG9yeS5saXN0SW52aXRlcyA9IGZ1bmN0aW9uKHByb2plY3RJZCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KFwiL2FwaS9pbnZpdGUvbGlzdC1pbnZpdGVzP3Byb2plY3RJZD1cIiArIHByb2plY3RJZCk7XG4gICAgfTtcblxuICAgIF9mYWN0b3J5LmFjY2VwdEluaXZ0ZSA9IGZ1bmN0aW9uKGludml0ZUlkKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5wb3N0KFwiL2FwaS9pbnZpdGUvYWNjZXB0XCIsIHtcbiAgICAgICAgICAgIGlkOiBpbnZpdGVJZFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIF9mYWN0b3J5O1xufSk7XG5cbmFwcC5mYWN0b3J5KCdnb29nbGVTZXJ2aWNlJywgZnVuY3Rpb24oJHEsICRodHRwKSB7XG5cbiAgICB2YXIgX2ZhY3RvcnkgPSB7fTtcbiAgICBfZmFjdG9yeS5saXN0SW52aXRlcyA9IGZ1bmN0aW9uKHByb2plY3RJZCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KFwiL2FwaS9pbnZpdGUvbGlzdC1pbnZpdGVzP3Byb2plY3RJZD1cIiArIHByb2plY3RJZCk7XG4gICAgfTtcblxuICAgIF9mYWN0b3J5LmFjY2VwdEluaXZ0ZSA9IGZ1bmN0aW9uKGludml0ZUlkKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5wb3N0KFwiL2FwaS9pbnZpdGUvYWNjZXB0XCIsIHtcbiAgICAgICAgICAgIGlkOiBpbnZpdGVJZFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgX2ZhY3RvcnkuZ29vZ2xlQXBpQ2xpZW50UmVhZHkgPSBmdW5jdGlvbihxdWVyeSkge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSAkcS5kZWZlcigpO1xuXG4gICAgICAgIGdhcGkuY2xpZW50LmxvYWQoJ3lvdXR1YmUnLCAndjMnLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIGdhcGkuY2xpZW50LnNldEFwaUtleSgnQUl6YVN5Q1J3TXVHUDUwYU92cnB0eVhSWnR2ZUU1MGZhT0xiOFIwJyk7XG4gICAgICAgICAgICB2YXIgcmVxdWVzdCA9IGdhcGkuY2xpZW50LnlvdXR1YmUuc2VhcmNoLmxpc3Qoe1xuICAgICAgICAgICAgICAgIHBhcnQ6ICdzbmlwcGV0JyxcbiAgICAgICAgICAgICAgICBxOiBxdWVyeSxcbiAgICAgICAgICAgICAgICBtYXhSZXN1bHRzOiAyNFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXF1ZXN0LmV4ZWN1dGUoZnVuY3Rpb24ocmVzcG9uc2UpIHtcblxuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocmVzcG9uc2UucmVzdWx0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIF9mYWN0b3J5O1xufSk7XG5cblxuXG52YXIgZGVib3VuY2UgPSBmdW5jdGlvbihmdW5jLCB3YWl0KSB7XG4gICAgLy8gd2UgbmVlZCB0byBzYXZlIHRoZXNlIGluIHRoZSBjbG9zdXJlXG4gICAgdmFyIHRpbWVvdXQsIGFyZ3MsIGNvbnRleHQsIHRpbWVzdGFtcDtcblxuICAgIHJldHVybiBmdW5jdGlvbigpIHtcblxuICAgICAgICAvLyBzYXZlIGRldGFpbHMgb2YgbGF0ZXN0IGNhbGxcbiAgICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICAgIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gICAgICAgIHRpbWVzdGFtcCA9IG5ldyBEYXRlKCk7XG5cbiAgICAgICAgLy8gdGhpcyBpcyB3aGVyZSB0aGUgbWFnaWMgaGFwcGVuc1xuICAgICAgICB2YXIgbGF0ZXIgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgLy8gaG93IGxvbmcgYWdvIHdhcyB0aGUgbGFzdCBjYWxsXG4gICAgICAgICAgICB2YXIgbGFzdCA9IChuZXcgRGF0ZSgpKSAtIHRpbWVzdGFtcDtcblxuICAgICAgICAgICAgLy8gaWYgdGhlIGxhdGVzdCBjYWxsIHdhcyBsZXNzIHRoYXQgdGhlIHdhaXQgcGVyaW9kIGFnb1xuICAgICAgICAgICAgLy8gdGhlbiB3ZSByZXNldCB0aGUgdGltZW91dCB0byB3YWl0IGZvciB0aGUgZGlmZmVyZW5jZVxuICAgICAgICAgICAgaWYgKGxhc3QgPCB3YWl0KSB7XG4gICAgICAgICAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KTtcblxuICAgICAgICAgICAgICAgIC8vIG9yIGlmIG5vdCB3ZSBjYW4gbnVsbCBvdXQgdGhlIHRpbWVyIGFuZCBydW4gdGhlIGxhdGVzdFxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aW1lb3V0ID0gbnVsbDtcbiAgICAgICAgICAgICAgICBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHdlIG9ubHkgbmVlZCB0byBzZXQgdGhlIHRpbWVyIG5vdyBpZiBvbmUgaXNuJ3QgYWxyZWFkeSBydW5uaW5nXG4gICAgICAgIGlmICghdGltZW91dCkge1xuICAgICAgICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQpO1xuICAgICAgICB9XG4gICAgfVxufTtcbiIsIi8qIVxuICogTWl6SnMgdjEuMC4wIFxuICogQ29weXJpZ2h0IE1pelRlY2hcbiAqIExpY2Vuc2VkIE1pa2VaaGVuZ1xuICogaHR0cDovL21pa2UtemhlbmcuZ2l0aHViLmlvL1xuICovXG4gXG4vLyAhIGpRdWVyeSB2MS45LjEgfCAoYykgMjAwNSwgMjAxMiBqUXVlcnkgRm91bmRhdGlvbiwgSW5jLiB8IGpxdWVyeS5vcmcvbGljZW5zZVxuLy9AIHNvdXJjZU1hcHBpbmdVUkw9anF1ZXJ5Lm1pbi5tYXBcbihmdW5jdGlvbihlLHQpe3ZhciBuLHIsaT10eXBlb2YgdCxvPWUuZG9jdW1lbnQsYT1lLmxvY2F0aW9uLHM9ZS5qUXVlcnksdT1lLiQsbD17fSxjPVtdLHA9XCIxLjkuMVwiLGY9Yy5jb25jYXQsZD1jLnB1c2gsaD1jLnNsaWNlLGc9Yy5pbmRleE9mLG09bC50b1N0cmluZyx5PWwuaGFzT3duUHJvcGVydHksdj1wLnRyaW0sYj1mdW5jdGlvbihlLHQpe3JldHVybiBuZXcgYi5mbi5pbml0KGUsdCxyKX0seD0vWystXT8oPzpcXGQqXFwufClcXGQrKD86W2VFXVsrLV0/XFxkK3wpLy5zb3VyY2Usdz0vXFxTKy9nLFQ9L15bXFxzXFx1RkVGRlxceEEwXSt8W1xcc1xcdUZFRkZcXHhBMF0rJC9nLE49L14oPzooPFtcXHdcXFddKz4pW14+XSp8IyhbXFx3LV0qKSkkLyxDPS9ePChcXHcrKVxccypcXC8/Pig/OjxcXC9cXDE+fCkkLyxrPS9eW1xcXSw6e31cXHNdKiQvLEU9Lyg/Ol58OnwsKSg/OlxccypcXFspKy9nLFM9L1xcXFwoPzpbXCJcXFxcXFwvYmZucnRdfHVbXFxkYS1mQS1GXXs0fSkvZyxBPS9cIlteXCJcXFxcXFxyXFxuXSpcInx0cnVlfGZhbHNlfG51bGx8LT8oPzpcXGQrXFwufClcXGQrKD86W2VFXVsrLV0/XFxkK3wpL2csaj0vXi1tcy0vLEQ9Ly0oW1xcZGEtel0pL2dpLEw9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gdC50b1VwcGVyQ2FzZSgpfSxIPWZ1bmN0aW9uKGUpeyhvLmFkZEV2ZW50TGlzdGVuZXJ8fFwibG9hZFwiPT09ZS50eXBlfHxcImNvbXBsZXRlXCI9PT1vLnJlYWR5U3RhdGUpJiYocSgpLGIucmVhZHkoKSl9LHE9ZnVuY3Rpb24oKXtvLmFkZEV2ZW50TGlzdGVuZXI/KG8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIixILCExKSxlLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsSCwhMSkpOihvLmRldGFjaEV2ZW50KFwib25yZWFkeXN0YXRlY2hhbmdlXCIsSCksZS5kZXRhY2hFdmVudChcIm9ubG9hZFwiLEgpKX07Yi5mbj1iLnByb3RvdHlwZT17anF1ZXJ5OnAsY29uc3RydWN0b3I6Yixpbml0OmZ1bmN0aW9uKGUsbixyKXt2YXIgaSxhO2lmKCFlKXJldHVybiB0aGlzO2lmKFwic3RyaW5nXCI9PXR5cGVvZiBlKXtpZihpPVwiPFwiPT09ZS5jaGFyQXQoMCkmJlwiPlwiPT09ZS5jaGFyQXQoZS5sZW5ndGgtMSkmJmUubGVuZ3RoPj0zP1tudWxsLGUsbnVsbF06Ti5leGVjKGUpLCFpfHwhaVsxXSYmbilyZXR1cm4hbnx8bi5qcXVlcnk/KG58fHIpLmZpbmQoZSk6dGhpcy5jb25zdHJ1Y3RvcihuKS5maW5kKGUpO2lmKGlbMV0pe2lmKG49biBpbnN0YW5jZW9mIGI/blswXTpuLGIubWVyZ2UodGhpcyxiLnBhcnNlSFRNTChpWzFdLG4mJm4ubm9kZVR5cGU/bi5vd25lckRvY3VtZW50fHxuOm8sITApKSxDLnRlc3QoaVsxXSkmJmIuaXNQbGFpbk9iamVjdChuKSlmb3IoaSBpbiBuKWIuaXNGdW5jdGlvbih0aGlzW2ldKT90aGlzW2ldKG5baV0pOnRoaXMuYXR0cihpLG5baV0pO3JldHVybiB0aGlzfWlmKGE9by5nZXRFbGVtZW50QnlJZChpWzJdKSxhJiZhLnBhcmVudE5vZGUpe2lmKGEuaWQhPT1pWzJdKXJldHVybiByLmZpbmQoZSk7dGhpcy5sZW5ndGg9MSx0aGlzWzBdPWF9cmV0dXJuIHRoaXMuY29udGV4dD1vLHRoaXMuc2VsZWN0b3I9ZSx0aGlzfXJldHVybiBlLm5vZGVUeXBlPyh0aGlzLmNvbnRleHQ9dGhpc1swXT1lLHRoaXMubGVuZ3RoPTEsdGhpcyk6Yi5pc0Z1bmN0aW9uKGUpP3IucmVhZHkoZSk6KGUuc2VsZWN0b3IhPT10JiYodGhpcy5zZWxlY3Rvcj1lLnNlbGVjdG9yLHRoaXMuY29udGV4dD1lLmNvbnRleHQpLGIubWFrZUFycmF5KGUsdGhpcykpfSxzZWxlY3RvcjpcIlwiLGxlbmd0aDowLHNpemU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5sZW5ndGh9LHRvQXJyYXk6ZnVuY3Rpb24oKXtyZXR1cm4gaC5jYWxsKHRoaXMpfSxnZXQ6ZnVuY3Rpb24oZSl7cmV0dXJuIG51bGw9PWU/dGhpcy50b0FycmF5KCk6MD5lP3RoaXNbdGhpcy5sZW5ndGgrZV06dGhpc1tlXX0scHVzaFN0YWNrOmZ1bmN0aW9uKGUpe3ZhciB0PWIubWVyZ2UodGhpcy5jb25zdHJ1Y3RvcigpLGUpO3JldHVybiB0LnByZXZPYmplY3Q9dGhpcyx0LmNvbnRleHQ9dGhpcy5jb250ZXh0LHR9LGVhY2g6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gYi5lYWNoKHRoaXMsZSx0KX0scmVhZHk6ZnVuY3Rpb24oZSl7cmV0dXJuIGIucmVhZHkucHJvbWlzZSgpLmRvbmUoZSksdGhpc30sc2xpY2U6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5wdXNoU3RhY2soaC5hcHBseSh0aGlzLGFyZ3VtZW50cykpfSxmaXJzdDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmVxKDApfSxsYXN0OmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZXEoLTEpfSxlcTpmdW5jdGlvbihlKXt2YXIgdD10aGlzLmxlbmd0aCxuPStlKygwPmU/dDowKTtyZXR1cm4gdGhpcy5wdXNoU3RhY2sobj49MCYmdD5uP1t0aGlzW25dXTpbXSl9LG1hcDpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5wdXNoU3RhY2soYi5tYXAodGhpcyxmdW5jdGlvbih0LG4pe3JldHVybiBlLmNhbGwodCxuLHQpfSkpfSxlbmQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5wcmV2T2JqZWN0fHx0aGlzLmNvbnN0cnVjdG9yKG51bGwpfSxwdXNoOmQsc29ydDpbXS5zb3J0LHNwbGljZTpbXS5zcGxpY2V9LGIuZm4uaW5pdC5wcm90b3R5cGU9Yi5mbixiLmV4dGVuZD1iLmZuLmV4dGVuZD1mdW5jdGlvbigpe3ZhciBlLG4scixpLG8sYSxzPWFyZ3VtZW50c1swXXx8e30sdT0xLGw9YXJndW1lbnRzLmxlbmd0aCxjPSExO2ZvcihcImJvb2xlYW5cIj09dHlwZW9mIHMmJihjPXMscz1hcmd1bWVudHNbMV18fHt9LHU9MiksXCJvYmplY3RcIj09dHlwZW9mIHN8fGIuaXNGdW5jdGlvbihzKXx8KHM9e30pLGw9PT11JiYocz10aGlzLC0tdSk7bD51O3UrKylpZihudWxsIT0obz1hcmd1bWVudHNbdV0pKWZvcihpIGluIG8pZT1zW2ldLHI9b1tpXSxzIT09ciYmKGMmJnImJihiLmlzUGxhaW5PYmplY3Qocil8fChuPWIuaXNBcnJheShyKSkpPyhuPyhuPSExLGE9ZSYmYi5pc0FycmF5KGUpP2U6W10pOmE9ZSYmYi5pc1BsYWluT2JqZWN0KGUpP2U6e30sc1tpXT1iLmV4dGVuZChjLGEscikpOnIhPT10JiYoc1tpXT1yKSk7cmV0dXJuIHN9LGIuZXh0ZW5kKHtub0NvbmZsaWN0OmZ1bmN0aW9uKHQpe3JldHVybiBlLiQ9PT1iJiYoZS4kPXUpLHQmJmUualF1ZXJ5PT09YiYmKGUualF1ZXJ5PXMpLGJ9LGlzUmVhZHk6ITEscmVhZHlXYWl0OjEsaG9sZFJlYWR5OmZ1bmN0aW9uKGUpe2U/Yi5yZWFkeVdhaXQrKzpiLnJlYWR5KCEwKX0scmVhZHk6ZnVuY3Rpb24oZSl7aWYoZT09PSEwPyEtLWIucmVhZHlXYWl0OiFiLmlzUmVhZHkpe2lmKCFvLmJvZHkpcmV0dXJuIHNldFRpbWVvdXQoYi5yZWFkeSk7Yi5pc1JlYWR5PSEwLGUhPT0hMCYmLS1iLnJlYWR5V2FpdD4wfHwobi5yZXNvbHZlV2l0aChvLFtiXSksYi5mbi50cmlnZ2VyJiZiKG8pLnRyaWdnZXIoXCJyZWFkeVwiKS5vZmYoXCJyZWFkeVwiKSl9fSxpc0Z1bmN0aW9uOmZ1bmN0aW9uKGUpe3JldHVyblwiZnVuY3Rpb25cIj09PWIudHlwZShlKX0saXNBcnJheTpBcnJheS5pc0FycmF5fHxmdW5jdGlvbihlKXtyZXR1cm5cImFycmF5XCI9PT1iLnR5cGUoZSl9LGlzV2luZG93OmZ1bmN0aW9uKGUpe3JldHVybiBudWxsIT1lJiZlPT1lLndpbmRvd30saXNOdW1lcmljOmZ1bmN0aW9uKGUpe3JldHVybiFpc05hTihwYXJzZUZsb2F0KGUpKSYmaXNGaW5pdGUoZSl9LHR5cGU6ZnVuY3Rpb24oZSl7cmV0dXJuIG51bGw9PWU/ZStcIlwiOlwib2JqZWN0XCI9PXR5cGVvZiBlfHxcImZ1bmN0aW9uXCI9PXR5cGVvZiBlP2xbbS5jYWxsKGUpXXx8XCJvYmplY3RcIjp0eXBlb2YgZX0saXNQbGFpbk9iamVjdDpmdW5jdGlvbihlKXtpZighZXx8XCJvYmplY3RcIiE9PWIudHlwZShlKXx8ZS5ub2RlVHlwZXx8Yi5pc1dpbmRvdyhlKSlyZXR1cm4hMTt0cnl7aWYoZS5jb25zdHJ1Y3RvciYmIXkuY2FsbChlLFwiY29uc3RydWN0b3JcIikmJiF5LmNhbGwoZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGUsXCJpc1Byb3RvdHlwZU9mXCIpKXJldHVybiExfWNhdGNoKG4pe3JldHVybiExfXZhciByO2ZvcihyIGluIGUpO3JldHVybiByPT09dHx8eS5jYWxsKGUscil9LGlzRW1wdHlPYmplY3Q6ZnVuY3Rpb24oZSl7dmFyIHQ7Zm9yKHQgaW4gZSlyZXR1cm4hMTtyZXR1cm4hMH0sZXJyb3I6ZnVuY3Rpb24oZSl7dGhyb3cgRXJyb3IoZSl9LHBhcnNlSFRNTDpmdW5jdGlvbihlLHQsbil7aWYoIWV8fFwic3RyaW5nXCIhPXR5cGVvZiBlKXJldHVybiBudWxsO1wiYm9vbGVhblwiPT10eXBlb2YgdCYmKG49dCx0PSExKSx0PXR8fG87dmFyIHI9Qy5leGVjKGUpLGk9IW4mJltdO3JldHVybiByP1t0LmNyZWF0ZUVsZW1lbnQoclsxXSldOihyPWIuYnVpbGRGcmFnbWVudChbZV0sdCxpKSxpJiZiKGkpLnJlbW92ZSgpLGIubWVyZ2UoW10sci5jaGlsZE5vZGVzKSl9LHBhcnNlSlNPTjpmdW5jdGlvbihuKXtyZXR1cm4gZS5KU09OJiZlLkpTT04ucGFyc2U/ZS5KU09OLnBhcnNlKG4pOm51bGw9PT1uP246XCJzdHJpbmdcIj09dHlwZW9mIG4mJihuPWIudHJpbShuKSxuJiZrLnRlc3Qobi5yZXBsYWNlKFMsXCJAXCIpLnJlcGxhY2UoQSxcIl1cIikucmVwbGFjZShFLFwiXCIpKSk/RnVuY3Rpb24oXCJyZXR1cm4gXCIrbikoKTooYi5lcnJvcihcIkludmFsaWQgSlNPTjogXCIrbiksdCl9LHBhcnNlWE1MOmZ1bmN0aW9uKG4pe3ZhciByLGk7aWYoIW58fFwic3RyaW5nXCIhPXR5cGVvZiBuKXJldHVybiBudWxsO3RyeXtlLkRPTVBhcnNlcj8oaT1uZXcgRE9NUGFyc2VyLHI9aS5wYXJzZUZyb21TdHJpbmcobixcInRleHQveG1sXCIpKToocj1uZXcgQWN0aXZlWE9iamVjdChcIk1pY3Jvc29mdC5YTUxET01cIiksci5hc3luYz1cImZhbHNlXCIsci5sb2FkWE1MKG4pKX1jYXRjaChvKXtyPXR9cmV0dXJuIHImJnIuZG9jdW1lbnRFbGVtZW50JiYhci5nZXRFbGVtZW50c0J5VGFnTmFtZShcInBhcnNlcmVycm9yXCIpLmxlbmd0aHx8Yi5lcnJvcihcIkludmFsaWQgWE1MOiBcIituKSxyfSxub29wOmZ1bmN0aW9uKCl7fSxnbG9iYWxFdmFsOmZ1bmN0aW9uKHQpe3QmJmIudHJpbSh0KSYmKGUuZXhlY1NjcmlwdHx8ZnVuY3Rpb24odCl7ZS5ldmFsLmNhbGwoZSx0KX0pKHQpfSxjYW1lbENhc2U6ZnVuY3Rpb24oZSl7cmV0dXJuIGUucmVwbGFjZShqLFwibXMtXCIpLnJlcGxhY2UoRCxMKX0sbm9kZU5hbWU6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZS5ub2RlTmFtZSYmZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09dC50b0xvd2VyQ2FzZSgpfSxlYWNoOmZ1bmN0aW9uKGUsdCxuKXt2YXIgcixpPTAsbz1lLmxlbmd0aCxhPU0oZSk7aWYobil7aWYoYSl7Zm9yKDtvPmk7aSsrKWlmKHI9dC5hcHBseShlW2ldLG4pLHI9PT0hMSlicmVha31lbHNlIGZvcihpIGluIGUpaWYocj10LmFwcGx5KGVbaV0sbikscj09PSExKWJyZWFrfWVsc2UgaWYoYSl7Zm9yKDtvPmk7aSsrKWlmKHI9dC5jYWxsKGVbaV0saSxlW2ldKSxyPT09ITEpYnJlYWt9ZWxzZSBmb3IoaSBpbiBlKWlmKHI9dC5jYWxsKGVbaV0saSxlW2ldKSxyPT09ITEpYnJlYWs7cmV0dXJuIGV9LHRyaW06diYmIXYuY2FsbChcIlxcdWZlZmZcXHUwMGEwXCIpP2Z1bmN0aW9uKGUpe3JldHVybiBudWxsPT1lP1wiXCI6di5jYWxsKGUpfTpmdW5jdGlvbihlKXtyZXR1cm4gbnVsbD09ZT9cIlwiOihlK1wiXCIpLnJlcGxhY2UoVCxcIlwiKX0sbWFrZUFycmF5OmZ1bmN0aW9uKGUsdCl7dmFyIG49dHx8W107cmV0dXJuIG51bGwhPWUmJihNKE9iamVjdChlKSk/Yi5tZXJnZShuLFwic3RyaW5nXCI9PXR5cGVvZiBlP1tlXTplKTpkLmNhbGwobixlKSksbn0saW5BcnJheTpmdW5jdGlvbihlLHQsbil7dmFyIHI7aWYodCl7aWYoZylyZXR1cm4gZy5jYWxsKHQsZSxuKTtmb3Iocj10Lmxlbmd0aCxuPW4/MD5uP01hdGgubWF4KDAscituKTpuOjA7cj5uO24rKylpZihuIGluIHQmJnRbbl09PT1lKXJldHVybiBufXJldHVybi0xfSxtZXJnZTpmdW5jdGlvbihlLG4pe3ZhciByPW4ubGVuZ3RoLGk9ZS5sZW5ndGgsbz0wO2lmKFwibnVtYmVyXCI9PXR5cGVvZiByKWZvcig7cj5vO28rKyllW2krK109bltvXTtlbHNlIHdoaWxlKG5bb10hPT10KWVbaSsrXT1uW28rK107cmV0dXJuIGUubGVuZ3RoPWksZX0sZ3JlcDpmdW5jdGlvbihlLHQsbil7dmFyIHIsaT1bXSxvPTAsYT1lLmxlbmd0aDtmb3Iobj0hIW47YT5vO28rKylyPSEhdChlW29dLG8pLG4hPT1yJiZpLnB1c2goZVtvXSk7cmV0dXJuIGl9LG1hcDpmdW5jdGlvbihlLHQsbil7dmFyIHIsaT0wLG89ZS5sZW5ndGgsYT1NKGUpLHM9W107aWYoYSlmb3IoO28+aTtpKyspcj10KGVbaV0saSxuKSxudWxsIT1yJiYoc1tzLmxlbmd0aF09cik7ZWxzZSBmb3IoaSBpbiBlKXI9dChlW2ldLGksbiksbnVsbCE9ciYmKHNbcy5sZW5ndGhdPXIpO3JldHVybiBmLmFwcGx5KFtdLHMpfSxndWlkOjEscHJveHk6ZnVuY3Rpb24oZSxuKXt2YXIgcixpLG87cmV0dXJuXCJzdHJpbmdcIj09dHlwZW9mIG4mJihvPWVbbl0sbj1lLGU9byksYi5pc0Z1bmN0aW9uKGUpPyhyPWguY2FsbChhcmd1bWVudHMsMiksaT1mdW5jdGlvbigpe3JldHVybiBlLmFwcGx5KG58fHRoaXMsci5jb25jYXQoaC5jYWxsKGFyZ3VtZW50cykpKX0saS5ndWlkPWUuZ3VpZD1lLmd1aWR8fGIuZ3VpZCsrLGkpOnR9LGFjY2VzczpmdW5jdGlvbihlLG4scixpLG8sYSxzKXt2YXIgdT0wLGw9ZS5sZW5ndGgsYz1udWxsPT1yO2lmKFwib2JqZWN0XCI9PT1iLnR5cGUocikpe289ITA7Zm9yKHUgaW4gciliLmFjY2VzcyhlLG4sdSxyW3VdLCEwLGEscyl9ZWxzZSBpZihpIT09dCYmKG89ITAsYi5pc0Z1bmN0aW9uKGkpfHwocz0hMCksYyYmKHM/KG4uY2FsbChlLGkpLG49bnVsbCk6KGM9bixuPWZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gYy5jYWxsKGIoZSksbil9KSksbikpZm9yKDtsPnU7dSsrKW4oZVt1XSxyLHM/aTppLmNhbGwoZVt1XSx1LG4oZVt1XSxyKSkpO3JldHVybiBvP2U6Yz9uLmNhbGwoZSk6bD9uKGVbMF0scik6YX0sbm93OmZ1bmN0aW9uKCl7cmV0dXJuKG5ldyBEYXRlKS5nZXRUaW1lKCl9fSksYi5yZWFkeS5wcm9taXNlPWZ1bmN0aW9uKHQpe2lmKCFuKWlmKG49Yi5EZWZlcnJlZCgpLFwiY29tcGxldGVcIj09PW8ucmVhZHlTdGF0ZSlzZXRUaW1lb3V0KGIucmVhZHkpO2Vsc2UgaWYoby5hZGRFdmVudExpc3RlbmVyKW8uYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIixILCExKSxlLmFkZEV2ZW50TGlzdGVuZXIoXCJsb2FkXCIsSCwhMSk7ZWxzZXtvLmF0dGFjaEV2ZW50KFwib25yZWFkeXN0YXRlY2hhbmdlXCIsSCksZS5hdHRhY2hFdmVudChcIm9ubG9hZFwiLEgpO3ZhciByPSExO3RyeXtyPW51bGw9PWUuZnJhbWVFbGVtZW50JiZvLmRvY3VtZW50RWxlbWVudH1jYXRjaChpKXt9ciYmci5kb1Njcm9sbCYmZnVuY3Rpb24gYSgpe2lmKCFiLmlzUmVhZHkpe3RyeXtyLmRvU2Nyb2xsKFwibGVmdFwiKX1jYXRjaChlKXtyZXR1cm4gc2V0VGltZW91dChhLDUwKX1xKCksYi5yZWFkeSgpfX0oKX1yZXR1cm4gbi5wcm9taXNlKHQpfSxiLmVhY2goXCJCb29sZWFuIE51bWJlciBTdHJpbmcgRnVuY3Rpb24gQXJyYXkgRGF0ZSBSZWdFeHAgT2JqZWN0IEVycm9yXCIuc3BsaXQoXCIgXCIpLGZ1bmN0aW9uKGUsdCl7bFtcIltvYmplY3QgXCIrdCtcIl1cIl09dC50b0xvd2VyQ2FzZSgpfSk7ZnVuY3Rpb24gTShlKXt2YXIgdD1lLmxlbmd0aCxuPWIudHlwZShlKTtyZXR1cm4gYi5pc1dpbmRvdyhlKT8hMToxPT09ZS5ub2RlVHlwZSYmdD8hMDpcImFycmF5XCI9PT1ufHxcImZ1bmN0aW9uXCIhPT1uJiYoMD09PXR8fFwibnVtYmVyXCI9PXR5cGVvZiB0JiZ0PjAmJnQtMSBpbiBlKX1yPWIobyk7dmFyIF89e307ZnVuY3Rpb24gRihlKXt2YXIgdD1fW2VdPXt9O3JldHVybiBiLmVhY2goZS5tYXRjaCh3KXx8W10sZnVuY3Rpb24oZSxuKXt0W25dPSEwfSksdH1iLkNhbGxiYWNrcz1mdW5jdGlvbihlKXtlPVwic3RyaW5nXCI9PXR5cGVvZiBlP19bZV18fEYoZSk6Yi5leHRlbmQoe30sZSk7dmFyIG4scixpLG8sYSxzLHU9W10sbD0hZS5vbmNlJiZbXSxjPWZ1bmN0aW9uKHQpe2ZvcihyPWUubWVtb3J5JiZ0LGk9ITAsYT1zfHwwLHM9MCxvPXUubGVuZ3RoLG49ITA7dSYmbz5hO2ErKylpZih1W2FdLmFwcGx5KHRbMF0sdFsxXSk9PT0hMSYmZS5zdG9wT25GYWxzZSl7cj0hMTticmVha31uPSExLHUmJihsP2wubGVuZ3RoJiZjKGwuc2hpZnQoKSk6cj91PVtdOnAuZGlzYWJsZSgpKX0scD17YWRkOmZ1bmN0aW9uKCl7aWYodSl7dmFyIHQ9dS5sZW5ndGg7KGZ1bmN0aW9uIGkodCl7Yi5lYWNoKHQsZnVuY3Rpb24odCxuKXt2YXIgcj1iLnR5cGUobik7XCJmdW5jdGlvblwiPT09cj9lLnVuaXF1ZSYmcC5oYXMobil8fHUucHVzaChuKTpuJiZuLmxlbmd0aCYmXCJzdHJpbmdcIiE9PXImJmkobil9KX0pKGFyZ3VtZW50cyksbj9vPXUubGVuZ3RoOnImJihzPXQsYyhyKSl9cmV0dXJuIHRoaXN9LHJlbW92ZTpmdW5jdGlvbigpe3JldHVybiB1JiZiLmVhY2goYXJndW1lbnRzLGZ1bmN0aW9uKGUsdCl7dmFyIHI7d2hpbGUoKHI9Yi5pbkFycmF5KHQsdSxyKSk+LTEpdS5zcGxpY2UociwxKSxuJiYobz49ciYmby0tLGE+PXImJmEtLSl9KSx0aGlzfSxoYXM6ZnVuY3Rpb24oZSl7cmV0dXJuIGU/Yi5pbkFycmF5KGUsdSk+LTE6ISghdXx8IXUubGVuZ3RoKX0sZW1wdHk6ZnVuY3Rpb24oKXtyZXR1cm4gdT1bXSx0aGlzfSxkaXNhYmxlOmZ1bmN0aW9uKCl7cmV0dXJuIHU9bD1yPXQsdGhpc30sZGlzYWJsZWQ6ZnVuY3Rpb24oKXtyZXR1cm4hdX0sbG9jazpmdW5jdGlvbigpe3JldHVybiBsPXQscnx8cC5kaXNhYmxlKCksdGhpc30sbG9ja2VkOmZ1bmN0aW9uKCl7cmV0dXJuIWx9LGZpcmVXaXRoOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIHQ9dHx8W10sdD1bZSx0LnNsaWNlP3Quc2xpY2UoKTp0XSwhdXx8aSYmIWx8fChuP2wucHVzaCh0KTpjKHQpKSx0aGlzfSxmaXJlOmZ1bmN0aW9uKCl7cmV0dXJuIHAuZmlyZVdpdGgodGhpcyxhcmd1bWVudHMpLHRoaXN9LGZpcmVkOmZ1bmN0aW9uKCl7cmV0dXJuISFpfX07cmV0dXJuIHB9LGIuZXh0ZW5kKHtEZWZlcnJlZDpmdW5jdGlvbihlKXt2YXIgdD1bW1wicmVzb2x2ZVwiLFwiZG9uZVwiLGIuQ2FsbGJhY2tzKFwib25jZSBtZW1vcnlcIiksXCJyZXNvbHZlZFwiXSxbXCJyZWplY3RcIixcImZhaWxcIixiLkNhbGxiYWNrcyhcIm9uY2UgbWVtb3J5XCIpLFwicmVqZWN0ZWRcIl0sW1wibm90aWZ5XCIsXCJwcm9ncmVzc1wiLGIuQ2FsbGJhY2tzKFwibWVtb3J5XCIpXV0sbj1cInBlbmRpbmdcIixyPXtzdGF0ZTpmdW5jdGlvbigpe3JldHVybiBufSxhbHdheXM6ZnVuY3Rpb24oKXtyZXR1cm4gaS5kb25lKGFyZ3VtZW50cykuZmFpbChhcmd1bWVudHMpLHRoaXN9LHRoZW46ZnVuY3Rpb24oKXt2YXIgZT1hcmd1bWVudHM7cmV0dXJuIGIuRGVmZXJyZWQoZnVuY3Rpb24obil7Yi5lYWNoKHQsZnVuY3Rpb24odCxvKXt2YXIgYT1vWzBdLHM9Yi5pc0Z1bmN0aW9uKGVbdF0pJiZlW3RdO2lbb1sxXV0oZnVuY3Rpb24oKXt2YXIgZT1zJiZzLmFwcGx5KHRoaXMsYXJndW1lbnRzKTtlJiZiLmlzRnVuY3Rpb24oZS5wcm9taXNlKT9lLnByb21pc2UoKS5kb25lKG4ucmVzb2x2ZSkuZmFpbChuLnJlamVjdCkucHJvZ3Jlc3Mobi5ub3RpZnkpOm5bYStcIldpdGhcIl0odGhpcz09PXI/bi5wcm9taXNlKCk6dGhpcyxzP1tlXTphcmd1bWVudHMpfSl9KSxlPW51bGx9KS5wcm9taXNlKCl9LHByb21pc2U6ZnVuY3Rpb24oZSl7cmV0dXJuIG51bGwhPWU/Yi5leHRlbmQoZSxyKTpyfX0saT17fTtyZXR1cm4gci5waXBlPXIudGhlbixiLmVhY2godCxmdW5jdGlvbihlLG8pe3ZhciBhPW9bMl0scz1vWzNdO3Jbb1sxXV09YS5hZGQscyYmYS5hZGQoZnVuY3Rpb24oKXtuPXN9LHRbMV5lXVsyXS5kaXNhYmxlLHRbMl1bMl0ubG9jayksaVtvWzBdXT1mdW5jdGlvbigpe3JldHVybiBpW29bMF0rXCJXaXRoXCJdKHRoaXM9PT1pP3I6dGhpcyxhcmd1bWVudHMpLHRoaXN9LGlbb1swXStcIldpdGhcIl09YS5maXJlV2l0aH0pLHIucHJvbWlzZShpKSxlJiZlLmNhbGwoaSxpKSxpfSx3aGVuOmZ1bmN0aW9uKGUpe3ZhciB0PTAsbj1oLmNhbGwoYXJndW1lbnRzKSxyPW4ubGVuZ3RoLGk9MSE9PXJ8fGUmJmIuaXNGdW5jdGlvbihlLnByb21pc2UpP3I6MCxvPTE9PT1pP2U6Yi5EZWZlcnJlZCgpLGE9ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBmdW5jdGlvbihyKXt0W2VdPXRoaXMsbltlXT1hcmd1bWVudHMubGVuZ3RoPjE/aC5jYWxsKGFyZ3VtZW50cyk6cixuPT09cz9vLm5vdGlmeVdpdGgodCxuKTotLWl8fG8ucmVzb2x2ZVdpdGgodCxuKX19LHMsdSxsO2lmKHI+MSlmb3Iocz1BcnJheShyKSx1PUFycmF5KHIpLGw9QXJyYXkocik7cj50O3QrKyluW3RdJiZiLmlzRnVuY3Rpb24oblt0XS5wcm9taXNlKT9uW3RdLnByb21pc2UoKS5kb25lKGEodCxsLG4pKS5mYWlsKG8ucmVqZWN0KS5wcm9ncmVzcyhhKHQsdSxzKSk6LS1pO3JldHVybiBpfHxvLnJlc29sdmVXaXRoKGwsbiksby5wcm9taXNlKCl9fSksYi5zdXBwb3J0PWZ1bmN0aW9uKCl7dmFyIHQsbixyLGEscyx1LGwsYyxwLGYsZD1vLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7aWYoZC5zZXRBdHRyaWJ1dGUoXCJjbGFzc05hbWVcIixcInRcIiksZC5pbm5lckhUTUw9XCIgIDxsaW5rLz48dGFibGU+PC90YWJsZT48YSBocmVmPScvYSc+YTwvYT48aW5wdXQgdHlwZT0nY2hlY2tib3gnLz5cIixuPWQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCIqXCIpLHI9ZC5nZXRFbGVtZW50c0J5VGFnTmFtZShcImFcIilbMF0sIW58fCFyfHwhbi5sZW5ndGgpcmV0dXJue307cz1vLmNyZWF0ZUVsZW1lbnQoXCJzZWxlY3RcIiksbD1zLmFwcGVuZENoaWxkKG8uY3JlYXRlRWxlbWVudChcIm9wdGlvblwiKSksYT1kLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwiaW5wdXRcIilbMF0sci5zdHlsZS5jc3NUZXh0PVwidG9wOjFweDtmbG9hdDpsZWZ0O29wYWNpdHk6LjVcIix0PXtnZXRTZXRBdHRyaWJ1dGU6XCJ0XCIhPT1kLmNsYXNzTmFtZSxsZWFkaW5nV2hpdGVzcGFjZTozPT09ZC5maXJzdENoaWxkLm5vZGVUeXBlLHRib2R5OiFkLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwidGJvZHlcIikubGVuZ3RoLGh0bWxTZXJpYWxpemU6ISFkLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwibGlua1wiKS5sZW5ndGgsc3R5bGU6L3RvcC8udGVzdChyLmdldEF0dHJpYnV0ZShcInN0eWxlXCIpKSxocmVmTm9ybWFsaXplZDpcIi9hXCI9PT1yLmdldEF0dHJpYnV0ZShcImhyZWZcIiksb3BhY2l0eTovXjAuNS8udGVzdChyLnN0eWxlLm9wYWNpdHkpLGNzc0Zsb2F0OiEhci5zdHlsZS5jc3NGbG9hdCxjaGVja09uOiEhYS52YWx1ZSxvcHRTZWxlY3RlZDpsLnNlbGVjdGVkLGVuY3R5cGU6ISFvLmNyZWF0ZUVsZW1lbnQoXCJmb3JtXCIpLmVuY3R5cGUsaHRtbDVDbG9uZTpcIjw6bmF2PjwvOm5hdj5cIiE9PW8uY3JlYXRlRWxlbWVudChcIm5hdlwiKS5jbG9uZU5vZGUoITApLm91dGVySFRNTCxib3hNb2RlbDpcIkNTUzFDb21wYXRcIj09PW8uY29tcGF0TW9kZSxkZWxldGVFeHBhbmRvOiEwLG5vQ2xvbmVFdmVudDohMCxpbmxpbmVCbG9ja05lZWRzTGF5b3V0OiExLHNocmlua1dyYXBCbG9ja3M6ITEscmVsaWFibGVNYXJnaW5SaWdodDohMCxib3hTaXppbmdSZWxpYWJsZTohMCxwaXhlbFBvc2l0aW9uOiExfSxhLmNoZWNrZWQ9ITAsdC5ub0Nsb25lQ2hlY2tlZD1hLmNsb25lTm9kZSghMCkuY2hlY2tlZCxzLmRpc2FibGVkPSEwLHQub3B0RGlzYWJsZWQ9IWwuZGlzYWJsZWQ7dHJ5e2RlbGV0ZSBkLnRlc3R9Y2F0Y2goaCl7dC5kZWxldGVFeHBhbmRvPSExfWE9by5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIiksYS5zZXRBdHRyaWJ1dGUoXCJ2YWx1ZVwiLFwiXCIpLHQuaW5wdXQ9XCJcIj09PWEuZ2V0QXR0cmlidXRlKFwidmFsdWVcIiksYS52YWx1ZT1cInRcIixhLnNldEF0dHJpYnV0ZShcInR5cGVcIixcInJhZGlvXCIpLHQucmFkaW9WYWx1ZT1cInRcIj09PWEudmFsdWUsYS5zZXRBdHRyaWJ1dGUoXCJjaGVja2VkXCIsXCJ0XCIpLGEuc2V0QXR0cmlidXRlKFwibmFtZVwiLFwidFwiKSx1PW8uY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpLHUuYXBwZW5kQ2hpbGQoYSksdC5hcHBlbmRDaGVja2VkPWEuY2hlY2tlZCx0LmNoZWNrQ2xvbmU9dS5jbG9uZU5vZGUoITApLmNsb25lTm9kZSghMCkubGFzdENoaWxkLmNoZWNrZWQsZC5hdHRhY2hFdmVudCYmKGQuYXR0YWNoRXZlbnQoXCJvbmNsaWNrXCIsZnVuY3Rpb24oKXt0Lm5vQ2xvbmVFdmVudD0hMX0pLGQuY2xvbmVOb2RlKCEwKS5jbGljaygpKTtmb3IoZiBpbntzdWJtaXQ6ITAsY2hhbmdlOiEwLGZvY3VzaW46ITB9KWQuc2V0QXR0cmlidXRlKGM9XCJvblwiK2YsXCJ0XCIpLHRbZitcIkJ1YmJsZXNcIl09YyBpbiBlfHxkLmF0dHJpYnV0ZXNbY10uZXhwYW5kbz09PSExO3JldHVybiBkLnN0eWxlLmJhY2tncm91bmRDbGlwPVwiY29udGVudC1ib3hcIixkLmNsb25lTm9kZSghMCkuc3R5bGUuYmFja2dyb3VuZENsaXA9XCJcIix0LmNsZWFyQ2xvbmVTdHlsZT1cImNvbnRlbnQtYm94XCI9PT1kLnN0eWxlLmJhY2tncm91bmRDbGlwLGIoZnVuY3Rpb24oKXt2YXIgbixyLGEscz1cInBhZGRpbmc6MDttYXJnaW46MDtib3JkZXI6MDtkaXNwbGF5OmJsb2NrO2JveC1zaXppbmc6Y29udGVudC1ib3g7LW1vei1ib3gtc2l6aW5nOmNvbnRlbnQtYm94Oy13ZWJraXQtYm94LXNpemluZzpjb250ZW50LWJveDtcIix1PW8uZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJib2R5XCIpWzBdO3UmJihuPW8uY3JlYXRlRWxlbWVudChcImRpdlwiKSxuLnN0eWxlLmNzc1RleHQ9XCJib3JkZXI6MDt3aWR0aDowO2hlaWdodDowO3Bvc2l0aW9uOmFic29sdXRlO3RvcDowO2xlZnQ6LTk5OTlweDttYXJnaW4tdG9wOjFweFwiLHUuYXBwZW5kQ2hpbGQobikuYXBwZW5kQ2hpbGQoZCksZC5pbm5lckhUTUw9XCI8dGFibGU+PHRyPjx0ZD48L3RkPjx0ZD50PC90ZD48L3RyPjwvdGFibGU+XCIsYT1kLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwidGRcIiksYVswXS5zdHlsZS5jc3NUZXh0PVwicGFkZGluZzowO21hcmdpbjowO2JvcmRlcjowO2Rpc3BsYXk6bm9uZVwiLHA9MD09PWFbMF0ub2Zmc2V0SGVpZ2h0LGFbMF0uc3R5bGUuZGlzcGxheT1cIlwiLGFbMV0uc3R5bGUuZGlzcGxheT1cIm5vbmVcIix0LnJlbGlhYmxlSGlkZGVuT2Zmc2V0cz1wJiYwPT09YVswXS5vZmZzZXRIZWlnaHQsZC5pbm5lckhUTUw9XCJcIixkLnN0eWxlLmNzc1RleHQ9XCJib3gtc2l6aW5nOmJvcmRlci1ib3g7LW1vei1ib3gtc2l6aW5nOmJvcmRlci1ib3g7LXdlYmtpdC1ib3gtc2l6aW5nOmJvcmRlci1ib3g7cGFkZGluZzoxcHg7Ym9yZGVyOjFweDtkaXNwbGF5OmJsb2NrO3dpZHRoOjRweDttYXJnaW4tdG9wOjElO3Bvc2l0aW9uOmFic29sdXRlO3RvcDoxJTtcIix0LmJveFNpemluZz00PT09ZC5vZmZzZXRXaWR0aCx0LmRvZXNOb3RJbmNsdWRlTWFyZ2luSW5Cb2R5T2Zmc2V0PTEhPT11Lm9mZnNldFRvcCxlLmdldENvbXB1dGVkU3R5bGUmJih0LnBpeGVsUG9zaXRpb249XCIxJVwiIT09KGUuZ2V0Q29tcHV0ZWRTdHlsZShkLG51bGwpfHx7fSkudG9wLHQuYm94U2l6aW5nUmVsaWFibGU9XCI0cHhcIj09PShlLmdldENvbXB1dGVkU3R5bGUoZCxudWxsKXx8e3dpZHRoOlwiNHB4XCJ9KS53aWR0aCxyPWQuYXBwZW5kQ2hpbGQoby5jcmVhdGVFbGVtZW50KFwiZGl2XCIpKSxyLnN0eWxlLmNzc1RleHQ9ZC5zdHlsZS5jc3NUZXh0PXMsci5zdHlsZS5tYXJnaW5SaWdodD1yLnN0eWxlLndpZHRoPVwiMFwiLGQuc3R5bGUud2lkdGg9XCIxcHhcIix0LnJlbGlhYmxlTWFyZ2luUmlnaHQ9IXBhcnNlRmxvYXQoKGUuZ2V0Q29tcHV0ZWRTdHlsZShyLG51bGwpfHx7fSkubWFyZ2luUmlnaHQpKSx0eXBlb2YgZC5zdHlsZS56b29tIT09aSYmKGQuaW5uZXJIVE1MPVwiXCIsZC5zdHlsZS5jc3NUZXh0PXMrXCJ3aWR0aDoxcHg7cGFkZGluZzoxcHg7ZGlzcGxheTppbmxpbmU7em9vbToxXCIsdC5pbmxpbmVCbG9ja05lZWRzTGF5b3V0PTM9PT1kLm9mZnNldFdpZHRoLGQuc3R5bGUuZGlzcGxheT1cImJsb2NrXCIsZC5pbm5lckhUTUw9XCI8ZGl2PjwvZGl2PlwiLGQuZmlyc3RDaGlsZC5zdHlsZS53aWR0aD1cIjVweFwiLHQuc2hyaW5rV3JhcEJsb2Nrcz0zIT09ZC5vZmZzZXRXaWR0aCx0LmlubGluZUJsb2NrTmVlZHNMYXlvdXQmJih1LnN0eWxlLnpvb209MSkpLHUucmVtb3ZlQ2hpbGQobiksbj1kPWE9cj1udWxsKX0pLG49cz11PWw9cj1hPW51bGwsdH0oKTt2YXIgTz0vKD86XFx7W1xcc1xcU10qXFx9fFxcW1tcXHNcXFNdKlxcXSkkLyxCPS8oW0EtWl0pL2c7ZnVuY3Rpb24gUChlLG4scixpKXtpZihiLmFjY2VwdERhdGEoZSkpe3ZhciBvLGEscz1iLmV4cGFuZG8sdT1cInN0cmluZ1wiPT10eXBlb2YgbixsPWUubm9kZVR5cGUscD1sP2IuY2FjaGU6ZSxmPWw/ZVtzXTplW3NdJiZzO2lmKGYmJnBbZl0mJihpfHxwW2ZdLmRhdGEpfHwhdXx8ciE9PXQpcmV0dXJuIGZ8fChsP2Vbc109Zj1jLnBvcCgpfHxiLmd1aWQrKzpmPXMpLHBbZl18fChwW2ZdPXt9LGx8fChwW2ZdLnRvSlNPTj1iLm5vb3ApKSwoXCJvYmplY3RcIj09dHlwZW9mIG58fFwiZnVuY3Rpb25cIj09dHlwZW9mIG4pJiYoaT9wW2ZdPWIuZXh0ZW5kKHBbZl0sbik6cFtmXS5kYXRhPWIuZXh0ZW5kKHBbZl0uZGF0YSxuKSksbz1wW2ZdLGl8fChvLmRhdGF8fChvLmRhdGE9e30pLG89by5kYXRhKSxyIT09dCYmKG9bYi5jYW1lbENhc2UobildPXIpLHU/KGE9b1tuXSxudWxsPT1hJiYoYT1vW2IuY2FtZWxDYXNlKG4pXSkpOmE9byxhfX1mdW5jdGlvbiBSKGUsdCxuKXtpZihiLmFjY2VwdERhdGEoZSkpe3ZhciByLGksbyxhPWUubm9kZVR5cGUscz1hP2IuY2FjaGU6ZSx1PWE/ZVtiLmV4cGFuZG9dOmIuZXhwYW5kbztpZihzW3VdKXtpZih0JiYobz1uP3NbdV06c1t1XS5kYXRhKSl7Yi5pc0FycmF5KHQpP3Q9dC5jb25jYXQoYi5tYXAodCxiLmNhbWVsQ2FzZSkpOnQgaW4gbz90PVt0XToodD1iLmNhbWVsQ2FzZSh0KSx0PXQgaW4gbz9bdF06dC5zcGxpdChcIiBcIikpO2ZvcihyPTAsaT10Lmxlbmd0aDtpPnI7cisrKWRlbGV0ZSBvW3Rbcl1dO2lmKCEobj8kOmIuaXNFbXB0eU9iamVjdCkobykpcmV0dXJufShufHwoZGVsZXRlIHNbdV0uZGF0YSwkKHNbdV0pKSkmJihhP2IuY2xlYW5EYXRhKFtlXSwhMCk6Yi5zdXBwb3J0LmRlbGV0ZUV4cGFuZG98fHMhPXMud2luZG93P2RlbGV0ZSBzW3VdOnNbdV09bnVsbCl9fX1iLmV4dGVuZCh7Y2FjaGU6e30sZXhwYW5kbzpcImpRdWVyeVwiKyhwK01hdGgucmFuZG9tKCkpLnJlcGxhY2UoL1xcRC9nLFwiXCIpLG5vRGF0YTp7ZW1iZWQ6ITAsb2JqZWN0OlwiY2xzaWQ6RDI3Q0RCNkUtQUU2RC0xMWNmLTk2QjgtNDQ0NTUzNTQwMDAwXCIsYXBwbGV0OiEwfSxoYXNEYXRhOmZ1bmN0aW9uKGUpe3JldHVybiBlPWUubm9kZVR5cGU/Yi5jYWNoZVtlW2IuZXhwYW5kb11dOmVbYi5leHBhbmRvXSwhIWUmJiEkKGUpfSxkYXRhOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gUChlLHQsbil9LHJlbW92ZURhdGE6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gUihlLHQpfSxfZGF0YTpmdW5jdGlvbihlLHQsbil7cmV0dXJuIFAoZSx0LG4sITApfSxfcmVtb3ZlRGF0YTpmdW5jdGlvbihlLHQpe3JldHVybiBSKGUsdCwhMCl9LGFjY2VwdERhdGE6ZnVuY3Rpb24oZSl7aWYoZS5ub2RlVHlwZSYmMSE9PWUubm9kZVR5cGUmJjkhPT1lLm5vZGVUeXBlKXJldHVybiExO3ZhciB0PWUubm9kZU5hbWUmJmIubm9EYXRhW2Uubm9kZU5hbWUudG9Mb3dlckNhc2UoKV07cmV0dXJuIXR8fHQhPT0hMCYmZS5nZXRBdHRyaWJ1dGUoXCJjbGFzc2lkXCIpPT09dH19KSxiLmZuLmV4dGVuZCh7ZGF0YTpmdW5jdGlvbihlLG4pe3ZhciByLGksbz10aGlzWzBdLGE9MCxzPW51bGw7aWYoZT09PXQpe2lmKHRoaXMubGVuZ3RoJiYocz1iLmRhdGEobyksMT09PW8ubm9kZVR5cGUmJiFiLl9kYXRhKG8sXCJwYXJzZWRBdHRyc1wiKSkpe2ZvcihyPW8uYXR0cmlidXRlcztyLmxlbmd0aD5hO2ErKylpPXJbYV0ubmFtZSxpLmluZGV4T2YoXCJkYXRhLVwiKXx8KGk9Yi5jYW1lbENhc2UoaS5zbGljZSg1KSksVyhvLGksc1tpXSkpO2IuX2RhdGEobyxcInBhcnNlZEF0dHJzXCIsITApfXJldHVybiBzfXJldHVyblwib2JqZWN0XCI9PXR5cGVvZiBlP3RoaXMuZWFjaChmdW5jdGlvbigpe2IuZGF0YSh0aGlzLGUpfSk6Yi5hY2Nlc3ModGhpcyxmdW5jdGlvbihuKXtyZXR1cm4gbj09PXQ/bz9XKG8sZSxiLmRhdGEobyxlKSk6bnVsbDoodGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5kYXRhKHRoaXMsZSxuKX0pLHQpfSxudWxsLG4sYXJndW1lbnRzLmxlbmd0aD4xLG51bGwsITApfSxyZW1vdmVEYXRhOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXtiLnJlbW92ZURhdGEodGhpcyxlKX0pfX0pO2Z1bmN0aW9uIFcoZSxuLHIpe2lmKHI9PT10JiYxPT09ZS5ub2RlVHlwZSl7dmFyIGk9XCJkYXRhLVwiK24ucmVwbGFjZShCLFwiLSQxXCIpLnRvTG93ZXJDYXNlKCk7aWYocj1lLmdldEF0dHJpYnV0ZShpKSxcInN0cmluZ1wiPT10eXBlb2Ygcil7dHJ5e3I9XCJ0cnVlXCI9PT1yPyEwOlwiZmFsc2VcIj09PXI/ITE6XCJudWxsXCI9PT1yP251bGw6K3IrXCJcIj09PXI/K3I6Ty50ZXN0KHIpP2IucGFyc2VKU09OKHIpOnJ9Y2F0Y2gobyl7fWIuZGF0YShlLG4scil9ZWxzZSByPXR9cmV0dXJuIHJ9ZnVuY3Rpb24gJChlKXt2YXIgdDtmb3IodCBpbiBlKWlmKChcImRhdGFcIiE9PXR8fCFiLmlzRW1wdHlPYmplY3QoZVt0XSkpJiZcInRvSlNPTlwiIT09dClyZXR1cm4hMTtyZXR1cm4hMH1iLmV4dGVuZCh7cXVldWU6ZnVuY3Rpb24oZSxuLHIpe3ZhciBpO3JldHVybiBlPyhuPShufHxcImZ4XCIpK1wicXVldWVcIixpPWIuX2RhdGEoZSxuKSxyJiYoIWl8fGIuaXNBcnJheShyKT9pPWIuX2RhdGEoZSxuLGIubWFrZUFycmF5KHIpKTppLnB1c2gocikpLGl8fFtdKTp0fSxkZXF1ZXVlOmZ1bmN0aW9uKGUsdCl7dD10fHxcImZ4XCI7dmFyIG49Yi5xdWV1ZShlLHQpLHI9bi5sZW5ndGgsaT1uLnNoaWZ0KCksbz1iLl9xdWV1ZUhvb2tzKGUsdCksYT1mdW5jdGlvbigpe2IuZGVxdWV1ZShlLHQpfTtcImlucHJvZ3Jlc3NcIj09PWkmJihpPW4uc2hpZnQoKSxyLS0pLG8uY3VyPWksaSYmKFwiZnhcIj09PXQmJm4udW5zaGlmdChcImlucHJvZ3Jlc3NcIiksZGVsZXRlIG8uc3RvcCxpLmNhbGwoZSxhLG8pKSwhciYmbyYmby5lbXB0eS5maXJlKCl9LF9xdWV1ZUhvb2tzOmZ1bmN0aW9uKGUsdCl7dmFyIG49dCtcInF1ZXVlSG9va3NcIjtyZXR1cm4gYi5fZGF0YShlLG4pfHxiLl9kYXRhKGUsbix7ZW1wdHk6Yi5DYWxsYmFja3MoXCJvbmNlIG1lbW9yeVwiKS5hZGQoZnVuY3Rpb24oKXtiLl9yZW1vdmVEYXRhKGUsdCtcInF1ZXVlXCIpLGIuX3JlbW92ZURhdGEoZSxuKX0pfSl9fSksYi5mbi5leHRlbmQoe3F1ZXVlOmZ1bmN0aW9uKGUsbil7dmFyIHI9MjtyZXR1cm5cInN0cmluZ1wiIT10eXBlb2YgZSYmKG49ZSxlPVwiZnhcIixyLS0pLHI+YXJndW1lbnRzLmxlbmd0aD9iLnF1ZXVlKHRoaXNbMF0sZSk6bj09PXQ/dGhpczp0aGlzLmVhY2goZnVuY3Rpb24oKXt2YXIgdD1iLnF1ZXVlKHRoaXMsZSxuKTtiLl9xdWV1ZUhvb2tzKHRoaXMsZSksXCJmeFwiPT09ZSYmXCJpbnByb2dyZXNzXCIhPT10WzBdJiZiLmRlcXVldWUodGhpcyxlKX0pfSxkZXF1ZXVlOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLmVhY2goZnVuY3Rpb24oKXtiLmRlcXVldWUodGhpcyxlKX0pfSxkZWxheTpmdW5jdGlvbihlLHQpe3JldHVybiBlPWIuZng/Yi5meC5zcGVlZHNbZV18fGU6ZSx0PXR8fFwiZnhcIix0aGlzLnF1ZXVlKHQsZnVuY3Rpb24odCxuKXt2YXIgcj1zZXRUaW1lb3V0KHQsZSk7bi5zdG9wPWZ1bmN0aW9uKCl7Y2xlYXJUaW1lb3V0KHIpfX0pfSxjbGVhclF1ZXVlOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLnF1ZXVlKGV8fFwiZnhcIixbXSl9LHByb21pc2U6ZnVuY3Rpb24oZSxuKXt2YXIgcixpPTEsbz1iLkRlZmVycmVkKCksYT10aGlzLHM9dGhpcy5sZW5ndGgsdT1mdW5jdGlvbigpey0taXx8by5yZXNvbHZlV2l0aChhLFthXSl9O1wic3RyaW5nXCIhPXR5cGVvZiBlJiYobj1lLGU9dCksZT1lfHxcImZ4XCI7d2hpbGUocy0tKXI9Yi5fZGF0YShhW3NdLGUrXCJxdWV1ZUhvb2tzXCIpLHImJnIuZW1wdHkmJihpKyssci5lbXB0eS5hZGQodSkpO3JldHVybiB1KCksby5wcm9taXNlKG4pfX0pO3ZhciBJLHosWD0vW1xcdFxcclxcbl0vZyxVPS9cXHIvZyxWPS9eKD86aW5wdXR8c2VsZWN0fHRleHRhcmVhfGJ1dHRvbnxvYmplY3QpJC9pLFk9L14oPzphfGFyZWEpJC9pLEo9L14oPzpjaGVja2VkfHNlbGVjdGVkfGF1dG9mb2N1c3xhdXRvcGxheXxhc3luY3xjb250cm9sc3xkZWZlcnxkaXNhYmxlZHxoaWRkZW58bG9vcHxtdWx0aXBsZXxvcGVufHJlYWRvbmx5fHJlcXVpcmVkfHNjb3BlZCkkL2ksRz0vXig/OmNoZWNrZWR8c2VsZWN0ZWQpJC9pLFE9Yi5zdXBwb3J0LmdldFNldEF0dHJpYnV0ZSxLPWIuc3VwcG9ydC5pbnB1dDtiLmZuLmV4dGVuZCh7YXR0cjpmdW5jdGlvbihlLHQpe3JldHVybiBiLmFjY2Vzcyh0aGlzLGIuYXR0cixlLHQsYXJndW1lbnRzLmxlbmd0aD4xKX0scmVtb3ZlQXR0cjpmdW5jdGlvbihlKXtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5yZW1vdmVBdHRyKHRoaXMsZSl9KX0scHJvcDpmdW5jdGlvbihlLHQpe3JldHVybiBiLmFjY2Vzcyh0aGlzLGIucHJvcCxlLHQsYXJndW1lbnRzLmxlbmd0aD4xKX0scmVtb3ZlUHJvcDpmdW5jdGlvbihlKXtyZXR1cm4gZT1iLnByb3BGaXhbZV18fGUsdGhpcy5lYWNoKGZ1bmN0aW9uKCl7dHJ5e3RoaXNbZV09dCxkZWxldGUgdGhpc1tlXX1jYXRjaChuKXt9fSl9LGFkZENsYXNzOmZ1bmN0aW9uKGUpe3ZhciB0LG4scixpLG8sYT0wLHM9dGhpcy5sZW5ndGgsdT1cInN0cmluZ1wiPT10eXBlb2YgZSYmZTtpZihiLmlzRnVuY3Rpb24oZSkpcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbih0KXtiKHRoaXMpLmFkZENsYXNzKGUuY2FsbCh0aGlzLHQsdGhpcy5jbGFzc05hbWUpKX0pO2lmKHUpZm9yKHQ9KGV8fFwiXCIpLm1hdGNoKHcpfHxbXTtzPmE7YSsrKWlmKG49dGhpc1thXSxyPTE9PT1uLm5vZGVUeXBlJiYobi5jbGFzc05hbWU/KFwiIFwiK24uY2xhc3NOYW1lK1wiIFwiKS5yZXBsYWNlKFgsXCIgXCIpOlwiIFwiKSl7bz0wO3doaWxlKGk9dFtvKytdKTA+ci5pbmRleE9mKFwiIFwiK2krXCIgXCIpJiYocis9aStcIiBcIik7bi5jbGFzc05hbWU9Yi50cmltKHIpfXJldHVybiB0aGlzfSxyZW1vdmVDbGFzczpmdW5jdGlvbihlKXt2YXIgdCxuLHIsaSxvLGE9MCxzPXRoaXMubGVuZ3RoLHU9MD09PWFyZ3VtZW50cy5sZW5ndGh8fFwic3RyaW5nXCI9PXR5cGVvZiBlJiZlO2lmKGIuaXNGdW5jdGlvbihlKSlyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKHQpe2IodGhpcykucmVtb3ZlQ2xhc3MoZS5jYWxsKHRoaXMsdCx0aGlzLmNsYXNzTmFtZSkpfSk7aWYodSlmb3IodD0oZXx8XCJcIikubWF0Y2godyl8fFtdO3M+YTthKyspaWYobj10aGlzW2FdLHI9MT09PW4ubm9kZVR5cGUmJihuLmNsYXNzTmFtZT8oXCIgXCIrbi5jbGFzc05hbWUrXCIgXCIpLnJlcGxhY2UoWCxcIiBcIik6XCJcIikpe289MDt3aGlsZShpPXRbbysrXSl3aGlsZShyLmluZGV4T2YoXCIgXCIraStcIiBcIik+PTApcj1yLnJlcGxhY2UoXCIgXCIraStcIiBcIixcIiBcIik7bi5jbGFzc05hbWU9ZT9iLnRyaW0ocik6XCJcIn1yZXR1cm4gdGhpc30sdG9nZ2xlQ2xhc3M6ZnVuY3Rpb24oZSx0KXt2YXIgbj10eXBlb2YgZSxyPVwiYm9vbGVhblwiPT10eXBlb2YgdDtyZXR1cm4gYi5pc0Z1bmN0aW9uKGUpP3RoaXMuZWFjaChmdW5jdGlvbihuKXtiKHRoaXMpLnRvZ2dsZUNsYXNzKGUuY2FsbCh0aGlzLG4sdGhpcy5jbGFzc05hbWUsdCksdCl9KTp0aGlzLmVhY2goZnVuY3Rpb24oKXtpZihcInN0cmluZ1wiPT09bil7dmFyIG8sYT0wLHM9Yih0aGlzKSx1PXQsbD1lLm1hdGNoKHcpfHxbXTt3aGlsZShvPWxbYSsrXSl1PXI/dTohcy5oYXNDbGFzcyhvKSxzW3U/XCJhZGRDbGFzc1wiOlwicmVtb3ZlQ2xhc3NcIl0obyl9ZWxzZShuPT09aXx8XCJib29sZWFuXCI9PT1uKSYmKHRoaXMuY2xhc3NOYW1lJiZiLl9kYXRhKHRoaXMsXCJfX2NsYXNzTmFtZV9fXCIsdGhpcy5jbGFzc05hbWUpLHRoaXMuY2xhc3NOYW1lPXRoaXMuY2xhc3NOYW1lfHxlPT09ITE/XCJcIjpiLl9kYXRhKHRoaXMsXCJfX2NsYXNzTmFtZV9fXCIpfHxcIlwiKX0pfSxoYXNDbGFzczpmdW5jdGlvbihlKXt2YXIgdD1cIiBcIitlK1wiIFwiLG49MCxyPXRoaXMubGVuZ3RoO2Zvcig7cj5uO24rKylpZigxPT09dGhpc1tuXS5ub2RlVHlwZSYmKFwiIFwiK3RoaXNbbl0uY2xhc3NOYW1lK1wiIFwiKS5yZXBsYWNlKFgsXCIgXCIpLmluZGV4T2YodCk+PTApcmV0dXJuITA7cmV0dXJuITF9LHZhbDpmdW5jdGlvbihlKXt2YXIgbixyLGksbz10aGlzWzBdO3tpZihhcmd1bWVudHMubGVuZ3RoKXJldHVybiBpPWIuaXNGdW5jdGlvbihlKSx0aGlzLmVhY2goZnVuY3Rpb24obil7dmFyIG8sYT1iKHRoaXMpOzE9PT10aGlzLm5vZGVUeXBlJiYobz1pP2UuY2FsbCh0aGlzLG4sYS52YWwoKSk6ZSxudWxsPT1vP289XCJcIjpcIm51bWJlclwiPT10eXBlb2Ygbz9vKz1cIlwiOmIuaXNBcnJheShvKSYmKG89Yi5tYXAobyxmdW5jdGlvbihlKXtyZXR1cm4gbnVsbD09ZT9cIlwiOmUrXCJcIn0pKSxyPWIudmFsSG9va3NbdGhpcy50eXBlXXx8Yi52YWxIb29rc1t0aGlzLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCldLHImJlwic2V0XCJpbiByJiZyLnNldCh0aGlzLG8sXCJ2YWx1ZVwiKSE9PXR8fCh0aGlzLnZhbHVlPW8pKX0pO2lmKG8pcmV0dXJuIHI9Yi52YWxIb29rc1tvLnR5cGVdfHxiLnZhbEhvb2tzW28ubm9kZU5hbWUudG9Mb3dlckNhc2UoKV0sciYmXCJnZXRcImluIHImJihuPXIuZ2V0KG8sXCJ2YWx1ZVwiKSkhPT10P246KG49by52YWx1ZSxcInN0cmluZ1wiPT10eXBlb2Ygbj9uLnJlcGxhY2UoVSxcIlwiKTpudWxsPT1uP1wiXCI6bil9fX0pLGIuZXh0ZW5kKHt2YWxIb29rczp7b3B0aW9uOntnZXQ6ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5hdHRyaWJ1dGVzLnZhbHVlO3JldHVybiF0fHx0LnNwZWNpZmllZD9lLnZhbHVlOmUudGV4dH19LHNlbGVjdDp7Z2V0OmZ1bmN0aW9uKGUpe3ZhciB0LG4scj1lLm9wdGlvbnMsaT1lLnNlbGVjdGVkSW5kZXgsbz1cInNlbGVjdC1vbmVcIj09PWUudHlwZXx8MD5pLGE9bz9udWxsOltdLHM9bz9pKzE6ci5sZW5ndGgsdT0wPmk/czpvP2k6MDtmb3IoO3M+dTt1KyspaWYobj1yW3VdLCEoIW4uc2VsZWN0ZWQmJnUhPT1pfHwoYi5zdXBwb3J0Lm9wdERpc2FibGVkP24uZGlzYWJsZWQ6bnVsbCE9PW4uZ2V0QXR0cmlidXRlKFwiZGlzYWJsZWRcIikpfHxuLnBhcmVudE5vZGUuZGlzYWJsZWQmJmIubm9kZU5hbWUobi5wYXJlbnROb2RlLFwib3B0Z3JvdXBcIikpKXtpZih0PWIobikudmFsKCksbylyZXR1cm4gdDthLnB1c2godCl9cmV0dXJuIGF9LHNldDpmdW5jdGlvbihlLHQpe3ZhciBuPWIubWFrZUFycmF5KHQpO3JldHVybiBiKGUpLmZpbmQoXCJvcHRpb25cIikuZWFjaChmdW5jdGlvbigpe3RoaXMuc2VsZWN0ZWQ9Yi5pbkFycmF5KGIodGhpcykudmFsKCksbik+PTB9KSxuLmxlbmd0aHx8KGUuc2VsZWN0ZWRJbmRleD0tMSksbn19fSxhdHRyOmZ1bmN0aW9uKGUsbixyKXt2YXIgbyxhLHMsdT1lLm5vZGVUeXBlO2lmKGUmJjMhPT11JiY4IT09dSYmMiE9PXUpcmV0dXJuIHR5cGVvZiBlLmdldEF0dHJpYnV0ZT09PWk/Yi5wcm9wKGUsbixyKTooYT0xIT09dXx8IWIuaXNYTUxEb2MoZSksYSYmKG49bi50b0xvd2VyQ2FzZSgpLG89Yi5hdHRySG9va3Nbbl18fChKLnRlc3Qobik/ejpJKSkscj09PXQ/byYmYSYmXCJnZXRcImluIG8mJm51bGwhPT0ocz1vLmdldChlLG4pKT9zOih0eXBlb2YgZS5nZXRBdHRyaWJ1dGUhPT1pJiYocz1lLmdldEF0dHJpYnV0ZShuKSksbnVsbD09cz90OnMpOm51bGwhPT1yP28mJmEmJlwic2V0XCJpbiBvJiYocz1vLnNldChlLHIsbikpIT09dD9zOihlLnNldEF0dHJpYnV0ZShuLHIrXCJcIikscik6KGIucmVtb3ZlQXR0cihlLG4pLHQpKX0scmVtb3ZlQXR0cjpmdW5jdGlvbihlLHQpe3ZhciBuLHIsaT0wLG89dCYmdC5tYXRjaCh3KTtpZihvJiYxPT09ZS5ub2RlVHlwZSl3aGlsZShuPW9baSsrXSlyPWIucHJvcEZpeFtuXXx8bixKLnRlc3Qobik/IVEmJkcudGVzdChuKT9lW2IuY2FtZWxDYXNlKFwiZGVmYXVsdC1cIituKV09ZVtyXT0hMTplW3JdPSExOmIuYXR0cihlLG4sXCJcIiksZS5yZW1vdmVBdHRyaWJ1dGUoUT9uOnIpfSxhdHRySG9va3M6e3R5cGU6e3NldDpmdW5jdGlvbihlLHQpe2lmKCFiLnN1cHBvcnQucmFkaW9WYWx1ZSYmXCJyYWRpb1wiPT09dCYmYi5ub2RlTmFtZShlLFwiaW5wdXRcIikpe3ZhciBuPWUudmFsdWU7cmV0dXJuIGUuc2V0QXR0cmlidXRlKFwidHlwZVwiLHQpLG4mJihlLnZhbHVlPW4pLHR9fX19LHByb3BGaXg6e3RhYmluZGV4OlwidGFiSW5kZXhcIixyZWFkb25seTpcInJlYWRPbmx5XCIsXCJmb3JcIjpcImh0bWxGb3JcIixcImNsYXNzXCI6XCJjbGFzc05hbWVcIixtYXhsZW5ndGg6XCJtYXhMZW5ndGhcIixjZWxsc3BhY2luZzpcImNlbGxTcGFjaW5nXCIsY2VsbHBhZGRpbmc6XCJjZWxsUGFkZGluZ1wiLHJvd3NwYW46XCJyb3dTcGFuXCIsY29sc3BhbjpcImNvbFNwYW5cIix1c2VtYXA6XCJ1c2VNYXBcIixmcmFtZWJvcmRlcjpcImZyYW1lQm9yZGVyXCIsY29udGVudGVkaXRhYmxlOlwiY29udGVudEVkaXRhYmxlXCJ9LHByb3A6ZnVuY3Rpb24oZSxuLHIpe3ZhciBpLG8sYSxzPWUubm9kZVR5cGU7aWYoZSYmMyE9PXMmJjghPT1zJiYyIT09cylyZXR1cm4gYT0xIT09c3x8IWIuaXNYTUxEb2MoZSksYSYmKG49Yi5wcm9wRml4W25dfHxuLG89Yi5wcm9wSG9va3Nbbl0pLHIhPT10P28mJlwic2V0XCJpbiBvJiYoaT1vLnNldChlLHIsbikpIT09dD9pOmVbbl09cjpvJiZcImdldFwiaW4gbyYmbnVsbCE9PShpPW8uZ2V0KGUsbikpP2k6ZVtuXX0scHJvcEhvb2tzOnt0YWJJbmRleDp7Z2V0OmZ1bmN0aW9uKGUpe3ZhciBuPWUuZ2V0QXR0cmlidXRlTm9kZShcInRhYmluZGV4XCIpO3JldHVybiBuJiZuLnNwZWNpZmllZD9wYXJzZUludChuLnZhbHVlLDEwKTpWLnRlc3QoZS5ub2RlTmFtZSl8fFkudGVzdChlLm5vZGVOYW1lKSYmZS5ocmVmPzA6dH19fX0pLHo9e2dldDpmdW5jdGlvbihlLG4pe3ZhciByPWIucHJvcChlLG4pLGk9XCJib29sZWFuXCI9PXR5cGVvZiByJiZlLmdldEF0dHJpYnV0ZShuKSxvPVwiYm9vbGVhblwiPT10eXBlb2Ygcj9LJiZRP251bGwhPWk6Ry50ZXN0KG4pP2VbYi5jYW1lbENhc2UoXCJkZWZhdWx0LVwiK24pXTohIWk6ZS5nZXRBdHRyaWJ1dGVOb2RlKG4pO3JldHVybiBvJiZvLnZhbHVlIT09ITE/bi50b0xvd2VyQ2FzZSgpOnR9LHNldDpmdW5jdGlvbihlLHQsbil7cmV0dXJuIHQ9PT0hMT9iLnJlbW92ZUF0dHIoZSxuKTpLJiZRfHwhRy50ZXN0KG4pP2Uuc2V0QXR0cmlidXRlKCFRJiZiLnByb3BGaXhbbl18fG4sbik6ZVtiLmNhbWVsQ2FzZShcImRlZmF1bHQtXCIrbildPWVbbl09ITAsbn19LEsmJlF8fChiLmF0dHJIb29rcy52YWx1ZT17Z2V0OmZ1bmN0aW9uKGUsbil7dmFyIHI9ZS5nZXRBdHRyaWJ1dGVOb2RlKG4pO3JldHVybiBiLm5vZGVOYW1lKGUsXCJpbnB1dFwiKT9lLmRlZmF1bHRWYWx1ZTpyJiZyLnNwZWNpZmllZD9yLnZhbHVlOnR9LHNldDpmdW5jdGlvbihlLG4scil7cmV0dXJuIGIubm9kZU5hbWUoZSxcImlucHV0XCIpPyhlLmRlZmF1bHRWYWx1ZT1uLHQpOkkmJkkuc2V0KGUsbixyKX19KSxRfHwoST1iLnZhbEhvb2tzLmJ1dHRvbj17Z2V0OmZ1bmN0aW9uKGUsbil7dmFyIHI9ZS5nZXRBdHRyaWJ1dGVOb2RlKG4pO3JldHVybiByJiYoXCJpZFwiPT09bnx8XCJuYW1lXCI9PT1ufHxcImNvb3Jkc1wiPT09bj9cIlwiIT09ci52YWx1ZTpyLnNwZWNpZmllZCk/ci52YWx1ZTp0fSxzZXQ6ZnVuY3Rpb24oZSxuLHIpe3ZhciBpPWUuZ2V0QXR0cmlidXRlTm9kZShyKTtyZXR1cm4gaXx8ZS5zZXRBdHRyaWJ1dGVOb2RlKGk9ZS5vd25lckRvY3VtZW50LmNyZWF0ZUF0dHJpYnV0ZShyKSksaS52YWx1ZT1uKz1cIlwiLFwidmFsdWVcIj09PXJ8fG49PT1lLmdldEF0dHJpYnV0ZShyKT9uOnR9fSxiLmF0dHJIb29rcy5jb250ZW50ZWRpdGFibGU9e2dldDpJLmdldCxzZXQ6ZnVuY3Rpb24oZSx0LG4pe0kuc2V0KGUsXCJcIj09PXQ/ITE6dCxuKX19LGIuZWFjaChbXCJ3aWR0aFwiLFwiaGVpZ2h0XCJdLGZ1bmN0aW9uKGUsbil7Yi5hdHRySG9va3Nbbl09Yi5leHRlbmQoYi5hdHRySG9va3Nbbl0se3NldDpmdW5jdGlvbihlLHIpe3JldHVyblwiXCI9PT1yPyhlLnNldEF0dHJpYnV0ZShuLFwiYXV0b1wiKSxyKTp0fX0pfSkpLGIuc3VwcG9ydC5ocmVmTm9ybWFsaXplZHx8KGIuZWFjaChbXCJocmVmXCIsXCJzcmNcIixcIndpZHRoXCIsXCJoZWlnaHRcIl0sZnVuY3Rpb24oZSxuKXtiLmF0dHJIb29rc1tuXT1iLmV4dGVuZChiLmF0dHJIb29rc1tuXSx7Z2V0OmZ1bmN0aW9uKGUpe3ZhciByPWUuZ2V0QXR0cmlidXRlKG4sMik7cmV0dXJuIG51bGw9PXI/dDpyfX0pfSksYi5lYWNoKFtcImhyZWZcIixcInNyY1wiXSxmdW5jdGlvbihlLHQpe2IucHJvcEhvb2tzW3RdPXtnZXQ6ZnVuY3Rpb24oZSl7cmV0dXJuIGUuZ2V0QXR0cmlidXRlKHQsNCl9fX0pKSxiLnN1cHBvcnQuc3R5bGV8fChiLmF0dHJIb29rcy5zdHlsZT17Z2V0OmZ1bmN0aW9uKGUpe3JldHVybiBlLnN0eWxlLmNzc1RleHR8fHR9LHNldDpmdW5jdGlvbihlLHQpe3JldHVybiBlLnN0eWxlLmNzc1RleHQ9dCtcIlwifX0pLGIuc3VwcG9ydC5vcHRTZWxlY3RlZHx8KGIucHJvcEhvb2tzLnNlbGVjdGVkPWIuZXh0ZW5kKGIucHJvcEhvb2tzLnNlbGVjdGVkLHtnZXQ6ZnVuY3Rpb24oZSl7dmFyIHQ9ZS5wYXJlbnROb2RlO3JldHVybiB0JiYodC5zZWxlY3RlZEluZGV4LHQucGFyZW50Tm9kZSYmdC5wYXJlbnROb2RlLnNlbGVjdGVkSW5kZXgpLG51bGx9fSkpLGIuc3VwcG9ydC5lbmN0eXBlfHwoYi5wcm9wRml4LmVuY3R5cGU9XCJlbmNvZGluZ1wiKSxiLnN1cHBvcnQuY2hlY2tPbnx8Yi5lYWNoKFtcInJhZGlvXCIsXCJjaGVja2JveFwiXSxmdW5jdGlvbigpe2IudmFsSG9va3NbdGhpc109e2dldDpmdW5jdGlvbihlKXtyZXR1cm4gbnVsbD09PWUuZ2V0QXR0cmlidXRlKFwidmFsdWVcIik/XCJvblwiOmUudmFsdWV9fX0pLGIuZWFjaChbXCJyYWRpb1wiLFwiY2hlY2tib3hcIl0sZnVuY3Rpb24oKXtiLnZhbEhvb2tzW3RoaXNdPWIuZXh0ZW5kKGIudmFsSG9va3NbdGhpc10se3NldDpmdW5jdGlvbihlLG4pe3JldHVybiBiLmlzQXJyYXkobik/ZS5jaGVja2VkPWIuaW5BcnJheShiKGUpLnZhbCgpLG4pPj0wOnR9fSl9KTt2YXIgWj0vXig/OmlucHV0fHNlbGVjdHx0ZXh0YXJlYSkkL2ksZXQ9L15rZXkvLHR0PS9eKD86bW91c2V8Y29udGV4dG1lbnUpfGNsaWNrLyxudD0vXig/OmZvY3VzaW5mb2N1c3xmb2N1c291dGJsdXIpJC8scnQ9L14oW14uXSopKD86XFwuKC4rKXwpJC87ZnVuY3Rpb24gaXQoKXtyZXR1cm4hMH1mdW5jdGlvbiBvdCgpe3JldHVybiExfWIuZXZlbnQ9e2dsb2JhbDp7fSxhZGQ6ZnVuY3Rpb24oZSxuLHIsbyxhKXt2YXIgcyx1LGwsYyxwLGYsZCxoLGcsbSx5LHY9Yi5fZGF0YShlKTtpZih2KXtyLmhhbmRsZXImJihjPXIscj1jLmhhbmRsZXIsYT1jLnNlbGVjdG9yKSxyLmd1aWR8fChyLmd1aWQ9Yi5ndWlkKyspLCh1PXYuZXZlbnRzKXx8KHU9di5ldmVudHM9e30pLChmPXYuaGFuZGxlKXx8KGY9di5oYW5kbGU9ZnVuY3Rpb24oZSl7cmV0dXJuIHR5cGVvZiBiPT09aXx8ZSYmYi5ldmVudC50cmlnZ2VyZWQ9PT1lLnR5cGU/dDpiLmV2ZW50LmRpc3BhdGNoLmFwcGx5KGYuZWxlbSxhcmd1bWVudHMpfSxmLmVsZW09ZSksbj0obnx8XCJcIikubWF0Y2godyl8fFtcIlwiXSxsPW4ubGVuZ3RoO3doaWxlKGwtLSlzPXJ0LmV4ZWMobltsXSl8fFtdLGc9eT1zWzFdLG09KHNbMl18fFwiXCIpLnNwbGl0KFwiLlwiKS5zb3J0KCkscD1iLmV2ZW50LnNwZWNpYWxbZ118fHt9LGc9KGE/cC5kZWxlZ2F0ZVR5cGU6cC5iaW5kVHlwZSl8fGcscD1iLmV2ZW50LnNwZWNpYWxbZ118fHt9LGQ9Yi5leHRlbmQoe3R5cGU6ZyxvcmlnVHlwZTp5LGRhdGE6byxoYW5kbGVyOnIsZ3VpZDpyLmd1aWQsc2VsZWN0b3I6YSxuZWVkc0NvbnRleHQ6YSYmYi5leHByLm1hdGNoLm5lZWRzQ29udGV4dC50ZXN0KGEpLG5hbWVzcGFjZTptLmpvaW4oXCIuXCIpfSxjKSwoaD11W2ddKXx8KGg9dVtnXT1bXSxoLmRlbGVnYXRlQ291bnQ9MCxwLnNldHVwJiZwLnNldHVwLmNhbGwoZSxvLG0sZikhPT0hMXx8KGUuYWRkRXZlbnRMaXN0ZW5lcj9lLmFkZEV2ZW50TGlzdGVuZXIoZyxmLCExKTplLmF0dGFjaEV2ZW50JiZlLmF0dGFjaEV2ZW50KFwib25cIitnLGYpKSkscC5hZGQmJihwLmFkZC5jYWxsKGUsZCksZC5oYW5kbGVyLmd1aWR8fChkLmhhbmRsZXIuZ3VpZD1yLmd1aWQpKSxhP2guc3BsaWNlKGguZGVsZWdhdGVDb3VudCsrLDAsZCk6aC5wdXNoKGQpLGIuZXZlbnQuZ2xvYmFsW2ddPSEwO2U9bnVsbH19LHJlbW92ZTpmdW5jdGlvbihlLHQsbixyLGkpe3ZhciBvLGEscyx1LGwsYyxwLGYsZCxoLGcsbT1iLmhhc0RhdGEoZSkmJmIuX2RhdGEoZSk7aWYobSYmKGM9bS5ldmVudHMpKXt0PSh0fHxcIlwiKS5tYXRjaCh3KXx8W1wiXCJdLGw9dC5sZW5ndGg7d2hpbGUobC0tKWlmKHM9cnQuZXhlYyh0W2xdKXx8W10sZD1nPXNbMV0saD0oc1syXXx8XCJcIikuc3BsaXQoXCIuXCIpLnNvcnQoKSxkKXtwPWIuZXZlbnQuc3BlY2lhbFtkXXx8e30sZD0ocj9wLmRlbGVnYXRlVHlwZTpwLmJpbmRUeXBlKXx8ZCxmPWNbZF18fFtdLHM9c1syXSYmUmVnRXhwKFwiKF58XFxcXC4pXCIraC5qb2luKFwiXFxcXC4oPzouKlxcXFwufClcIikrXCIoXFxcXC58JClcIiksdT1vPWYubGVuZ3RoO3doaWxlKG8tLSlhPWZbb10sIWkmJmchPT1hLm9yaWdUeXBlfHxuJiZuLmd1aWQhPT1hLmd1aWR8fHMmJiFzLnRlc3QoYS5uYW1lc3BhY2UpfHxyJiZyIT09YS5zZWxlY3RvciYmKFwiKipcIiE9PXJ8fCFhLnNlbGVjdG9yKXx8KGYuc3BsaWNlKG8sMSksYS5zZWxlY3RvciYmZi5kZWxlZ2F0ZUNvdW50LS0scC5yZW1vdmUmJnAucmVtb3ZlLmNhbGwoZSxhKSk7dSYmIWYubGVuZ3RoJiYocC50ZWFyZG93biYmcC50ZWFyZG93bi5jYWxsKGUsaCxtLmhhbmRsZSkhPT0hMXx8Yi5yZW1vdmVFdmVudChlLGQsbS5oYW5kbGUpLGRlbGV0ZSBjW2RdKX1lbHNlIGZvcihkIGluIGMpYi5ldmVudC5yZW1vdmUoZSxkK3RbbF0sbixyLCEwKTtiLmlzRW1wdHlPYmplY3QoYykmJihkZWxldGUgbS5oYW5kbGUsYi5fcmVtb3ZlRGF0YShlLFwiZXZlbnRzXCIpKX19LHRyaWdnZXI6ZnVuY3Rpb24obixyLGksYSl7dmFyIHMsdSxsLGMscCxmLGQsaD1baXx8b10sZz15LmNhbGwobixcInR5cGVcIik/bi50eXBlOm4sbT15LmNhbGwobixcIm5hbWVzcGFjZVwiKT9uLm5hbWVzcGFjZS5zcGxpdChcIi5cIik6W107aWYobD1mPWk9aXx8bywzIT09aS5ub2RlVHlwZSYmOCE9PWkubm9kZVR5cGUmJiFudC50ZXN0KGcrYi5ldmVudC50cmlnZ2VyZWQpJiYoZy5pbmRleE9mKFwiLlwiKT49MCYmKG09Zy5zcGxpdChcIi5cIiksZz1tLnNoaWZ0KCksbS5zb3J0KCkpLHU9MD5nLmluZGV4T2YoXCI6XCIpJiZcIm9uXCIrZyxuPW5bYi5leHBhbmRvXT9uOm5ldyBiLkV2ZW50KGcsXCJvYmplY3RcIj09dHlwZW9mIG4mJm4pLG4uaXNUcmlnZ2VyPSEwLG4ubmFtZXNwYWNlPW0uam9pbihcIi5cIiksbi5uYW1lc3BhY2VfcmU9bi5uYW1lc3BhY2U/UmVnRXhwKFwiKF58XFxcXC4pXCIrbS5qb2luKFwiXFxcXC4oPzouKlxcXFwufClcIikrXCIoXFxcXC58JClcIik6bnVsbCxuLnJlc3VsdD10LG4udGFyZ2V0fHwobi50YXJnZXQ9aSkscj1udWxsPT1yP1tuXTpiLm1ha2VBcnJheShyLFtuXSkscD1iLmV2ZW50LnNwZWNpYWxbZ118fHt9LGF8fCFwLnRyaWdnZXJ8fHAudHJpZ2dlci5hcHBseShpLHIpIT09ITEpKXtpZighYSYmIXAubm9CdWJibGUmJiFiLmlzV2luZG93KGkpKXtmb3IoYz1wLmRlbGVnYXRlVHlwZXx8ZyxudC50ZXN0KGMrZyl8fChsPWwucGFyZW50Tm9kZSk7bDtsPWwucGFyZW50Tm9kZSloLnB1c2gobCksZj1sO2Y9PT0oaS5vd25lckRvY3VtZW50fHxvKSYmaC5wdXNoKGYuZGVmYXVsdFZpZXd8fGYucGFyZW50V2luZG93fHxlKX1kPTA7d2hpbGUoKGw9aFtkKytdKSYmIW4uaXNQcm9wYWdhdGlvblN0b3BwZWQoKSluLnR5cGU9ZD4xP2M6cC5iaW5kVHlwZXx8ZyxzPShiLl9kYXRhKGwsXCJldmVudHNcIil8fHt9KVtuLnR5cGVdJiZiLl9kYXRhKGwsXCJoYW5kbGVcIikscyYmcy5hcHBseShsLHIpLHM9dSYmbFt1XSxzJiZiLmFjY2VwdERhdGEobCkmJnMuYXBwbHkmJnMuYXBwbHkobCxyKT09PSExJiZuLnByZXZlbnREZWZhdWx0KCk7aWYobi50eXBlPWcsIShhfHxuLmlzRGVmYXVsdFByZXZlbnRlZCgpfHxwLl9kZWZhdWx0JiZwLl9kZWZhdWx0LmFwcGx5KGkub3duZXJEb2N1bWVudCxyKSE9PSExfHxcImNsaWNrXCI9PT1nJiZiLm5vZGVOYW1lKGksXCJhXCIpfHwhYi5hY2NlcHREYXRhKGkpfHwhdXx8IWlbZ118fGIuaXNXaW5kb3coaSkpKXtmPWlbdV0sZiYmKGlbdV09bnVsbCksYi5ldmVudC50cmlnZ2VyZWQ9Zzt0cnl7aVtnXSgpfWNhdGNoKHYpe31iLmV2ZW50LnRyaWdnZXJlZD10LGYmJihpW3VdPWYpfXJldHVybiBuLnJlc3VsdH19LGRpc3BhdGNoOmZ1bmN0aW9uKGUpe2U9Yi5ldmVudC5maXgoZSk7dmFyIG4scixpLG8sYSxzPVtdLHU9aC5jYWxsKGFyZ3VtZW50cyksbD0oYi5fZGF0YSh0aGlzLFwiZXZlbnRzXCIpfHx7fSlbZS50eXBlXXx8W10sYz1iLmV2ZW50LnNwZWNpYWxbZS50eXBlXXx8e307aWYodVswXT1lLGUuZGVsZWdhdGVUYXJnZXQ9dGhpcywhYy5wcmVEaXNwYXRjaHx8Yy5wcmVEaXNwYXRjaC5jYWxsKHRoaXMsZSkhPT0hMSl7cz1iLmV2ZW50LmhhbmRsZXJzLmNhbGwodGhpcyxlLGwpLG49MDt3aGlsZSgobz1zW24rK10pJiYhZS5pc1Byb3BhZ2F0aW9uU3RvcHBlZCgpKXtlLmN1cnJlbnRUYXJnZXQ9by5lbGVtLGE9MDt3aGlsZSgoaT1vLmhhbmRsZXJzW2ErK10pJiYhZS5pc0ltbWVkaWF0ZVByb3BhZ2F0aW9uU3RvcHBlZCgpKSghZS5uYW1lc3BhY2VfcmV8fGUubmFtZXNwYWNlX3JlLnRlc3QoaS5uYW1lc3BhY2UpKSYmKGUuaGFuZGxlT2JqPWksZS5kYXRhPWkuZGF0YSxyPSgoYi5ldmVudC5zcGVjaWFsW2kub3JpZ1R5cGVdfHx7fSkuaGFuZGxlfHxpLmhhbmRsZXIpLmFwcGx5KG8uZWxlbSx1KSxyIT09dCYmKGUucmVzdWx0PXIpPT09ITEmJihlLnByZXZlbnREZWZhdWx0KCksZS5zdG9wUHJvcGFnYXRpb24oKSkpfXJldHVybiBjLnBvc3REaXNwYXRjaCYmYy5wb3N0RGlzcGF0Y2guY2FsbCh0aGlzLGUpLGUucmVzdWx0fX0saGFuZGxlcnM6ZnVuY3Rpb24oZSxuKXt2YXIgcixpLG8sYSxzPVtdLHU9bi5kZWxlZ2F0ZUNvdW50LGw9ZS50YXJnZXQ7aWYodSYmbC5ub2RlVHlwZSYmKCFlLmJ1dHRvbnx8XCJjbGlja1wiIT09ZS50eXBlKSlmb3IoO2whPXRoaXM7bD1sLnBhcmVudE5vZGV8fHRoaXMpaWYoMT09PWwubm9kZVR5cGUmJihsLmRpc2FibGVkIT09ITB8fFwiY2xpY2tcIiE9PWUudHlwZSkpe2ZvcihvPVtdLGE9MDt1PmE7YSsrKWk9blthXSxyPWkuc2VsZWN0b3IrXCIgXCIsb1tyXT09PXQmJihvW3JdPWkubmVlZHNDb250ZXh0P2Iocix0aGlzKS5pbmRleChsKT49MDpiLmZpbmQocix0aGlzLG51bGwsW2xdKS5sZW5ndGgpLG9bcl0mJm8ucHVzaChpKTtvLmxlbmd0aCYmcy5wdXNoKHtlbGVtOmwsaGFuZGxlcnM6b30pfXJldHVybiBuLmxlbmd0aD51JiZzLnB1c2goe2VsZW06dGhpcyxoYW5kbGVyczpuLnNsaWNlKHUpfSksc30sZml4OmZ1bmN0aW9uKGUpe2lmKGVbYi5leHBhbmRvXSlyZXR1cm4gZTt2YXIgdCxuLHIsaT1lLnR5cGUsYT1lLHM9dGhpcy5maXhIb29rc1tpXTtzfHwodGhpcy5maXhIb29rc1tpXT1zPXR0LnRlc3QoaSk/dGhpcy5tb3VzZUhvb2tzOmV0LnRlc3QoaSk/dGhpcy5rZXlIb29rczp7fSkscj1zLnByb3BzP3RoaXMucHJvcHMuY29uY2F0KHMucHJvcHMpOnRoaXMucHJvcHMsZT1uZXcgYi5FdmVudChhKSx0PXIubGVuZ3RoO3doaWxlKHQtLSluPXJbdF0sZVtuXT1hW25dO3JldHVybiBlLnRhcmdldHx8KGUudGFyZ2V0PWEuc3JjRWxlbWVudHx8byksMz09PWUudGFyZ2V0Lm5vZGVUeXBlJiYoZS50YXJnZXQ9ZS50YXJnZXQucGFyZW50Tm9kZSksZS5tZXRhS2V5PSEhZS5tZXRhS2V5LHMuZmlsdGVyP3MuZmlsdGVyKGUsYSk6ZX0scHJvcHM6XCJhbHRLZXkgYnViYmxlcyBjYW5jZWxhYmxlIGN0cmxLZXkgY3VycmVudFRhcmdldCBldmVudFBoYXNlIG1ldGFLZXkgcmVsYXRlZFRhcmdldCBzaGlmdEtleSB0YXJnZXQgdGltZVN0YW1wIHZpZXcgd2hpY2hcIi5zcGxpdChcIiBcIiksZml4SG9va3M6e30sa2V5SG9va3M6e3Byb3BzOlwiY2hhciBjaGFyQ29kZSBrZXkga2V5Q29kZVwiLnNwbGl0KFwiIFwiKSxmaWx0ZXI6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gbnVsbD09ZS53aGljaCYmKGUud2hpY2g9bnVsbCE9dC5jaGFyQ29kZT90LmNoYXJDb2RlOnQua2V5Q29kZSksZX19LG1vdXNlSG9va3M6e3Byb3BzOlwiYnV0dG9uIGJ1dHRvbnMgY2xpZW50WCBjbGllbnRZIGZyb21FbGVtZW50IG9mZnNldFggb2Zmc2V0WSBwYWdlWCBwYWdlWSBzY3JlZW5YIHNjcmVlblkgdG9FbGVtZW50XCIuc3BsaXQoXCIgXCIpLGZpbHRlcjpmdW5jdGlvbihlLG4pe3ZhciByLGksYSxzPW4uYnV0dG9uLHU9bi5mcm9tRWxlbWVudDtyZXR1cm4gbnVsbD09ZS5wYWdlWCYmbnVsbCE9bi5jbGllbnRYJiYoaT1lLnRhcmdldC5vd25lckRvY3VtZW50fHxvLGE9aS5kb2N1bWVudEVsZW1lbnQscj1pLmJvZHksZS5wYWdlWD1uLmNsaWVudFgrKGEmJmEuc2Nyb2xsTGVmdHx8ciYmci5zY3JvbGxMZWZ0fHwwKS0oYSYmYS5jbGllbnRMZWZ0fHxyJiZyLmNsaWVudExlZnR8fDApLGUucGFnZVk9bi5jbGllbnRZKyhhJiZhLnNjcm9sbFRvcHx8ciYmci5zY3JvbGxUb3B8fDApLShhJiZhLmNsaWVudFRvcHx8ciYmci5jbGllbnRUb3B8fDApKSwhZS5yZWxhdGVkVGFyZ2V0JiZ1JiYoZS5yZWxhdGVkVGFyZ2V0PXU9PT1lLnRhcmdldD9uLnRvRWxlbWVudDp1KSxlLndoaWNofHxzPT09dHx8KGUud2hpY2g9MSZzPzE6MiZzPzM6NCZzPzI6MCksZX19LHNwZWNpYWw6e2xvYWQ6e25vQnViYmxlOiEwfSxjbGljazp7dHJpZ2dlcjpmdW5jdGlvbigpe3JldHVybiBiLm5vZGVOYW1lKHRoaXMsXCJpbnB1dFwiKSYmXCJjaGVja2JveFwiPT09dGhpcy50eXBlJiZ0aGlzLmNsaWNrPyh0aGlzLmNsaWNrKCksITEpOnR9fSxmb2N1czp7dHJpZ2dlcjpmdW5jdGlvbigpe2lmKHRoaXMhPT1vLmFjdGl2ZUVsZW1lbnQmJnRoaXMuZm9jdXMpdHJ5e3JldHVybiB0aGlzLmZvY3VzKCksITF9Y2F0Y2goZSl7fX0sZGVsZWdhdGVUeXBlOlwiZm9jdXNpblwifSxibHVyOnt0cmlnZ2VyOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXM9PT1vLmFjdGl2ZUVsZW1lbnQmJnRoaXMuYmx1cj8odGhpcy5ibHVyKCksITEpOnR9LGRlbGVnYXRlVHlwZTpcImZvY3Vzb3V0XCJ9LGJlZm9yZXVubG9hZDp7cG9zdERpc3BhdGNoOmZ1bmN0aW9uKGUpe2UucmVzdWx0IT09dCYmKGUub3JpZ2luYWxFdmVudC5yZXR1cm5WYWx1ZT1lLnJlc3VsdCl9fX0sc2ltdWxhdGU6ZnVuY3Rpb24oZSx0LG4scil7dmFyIGk9Yi5leHRlbmQobmV3IGIuRXZlbnQsbix7dHlwZTplLGlzU2ltdWxhdGVkOiEwLG9yaWdpbmFsRXZlbnQ6e319KTtyP2IuZXZlbnQudHJpZ2dlcihpLG51bGwsdCk6Yi5ldmVudC5kaXNwYXRjaC5jYWxsKHQsaSksaS5pc0RlZmF1bHRQcmV2ZW50ZWQoKSYmbi5wcmV2ZW50RGVmYXVsdCgpfX0sYi5yZW1vdmVFdmVudD1vLnJlbW92ZUV2ZW50TGlzdGVuZXI/ZnVuY3Rpb24oZSx0LG4pe2UucmVtb3ZlRXZlbnRMaXN0ZW5lciYmZS5yZW1vdmVFdmVudExpc3RlbmVyKHQsbiwhMSl9OmZ1bmN0aW9uKGUsdCxuKXt2YXIgcj1cIm9uXCIrdDtlLmRldGFjaEV2ZW50JiYodHlwZW9mIGVbcl09PT1pJiYoZVtyXT1udWxsKSxlLmRldGFjaEV2ZW50KHIsbikpfSxiLkV2ZW50PWZ1bmN0aW9uKGUsbil7cmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBiLkV2ZW50PyhlJiZlLnR5cGU/KHRoaXMub3JpZ2luYWxFdmVudD1lLHRoaXMudHlwZT1lLnR5cGUsdGhpcy5pc0RlZmF1bHRQcmV2ZW50ZWQ9ZS5kZWZhdWx0UHJldmVudGVkfHxlLnJldHVyblZhbHVlPT09ITF8fGUuZ2V0UHJldmVudERlZmF1bHQmJmUuZ2V0UHJldmVudERlZmF1bHQoKT9pdDpvdCk6dGhpcy50eXBlPWUsbiYmYi5leHRlbmQodGhpcyxuKSx0aGlzLnRpbWVTdGFtcD1lJiZlLnRpbWVTdGFtcHx8Yi5ub3coKSx0aGlzW2IuZXhwYW5kb109ITAsdCk6bmV3IGIuRXZlbnQoZSxuKX0sYi5FdmVudC5wcm90b3R5cGU9e2lzRGVmYXVsdFByZXZlbnRlZDpvdCxpc1Byb3BhZ2F0aW9uU3RvcHBlZDpvdCxpc0ltbWVkaWF0ZVByb3BhZ2F0aW9uU3RvcHBlZDpvdCxwcmV2ZW50RGVmYXVsdDpmdW5jdGlvbigpe3ZhciBlPXRoaXMub3JpZ2luYWxFdmVudDt0aGlzLmlzRGVmYXVsdFByZXZlbnRlZD1pdCxlJiYoZS5wcmV2ZW50RGVmYXVsdD9lLnByZXZlbnREZWZhdWx0KCk6ZS5yZXR1cm5WYWx1ZT0hMSl9LHN0b3BQcm9wYWdhdGlvbjpmdW5jdGlvbigpe3ZhciBlPXRoaXMub3JpZ2luYWxFdmVudDt0aGlzLmlzUHJvcGFnYXRpb25TdG9wcGVkPWl0LGUmJihlLnN0b3BQcm9wYWdhdGlvbiYmZS5zdG9wUHJvcGFnYXRpb24oKSxlLmNhbmNlbEJ1YmJsZT0hMCl9LHN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbjpmdW5jdGlvbigpe3RoaXMuaXNJbW1lZGlhdGVQcm9wYWdhdGlvblN0b3BwZWQ9aXQsdGhpcy5zdG9wUHJvcGFnYXRpb24oKX19LGIuZWFjaCh7bW91c2VlbnRlcjpcIm1vdXNlb3ZlclwiLG1vdXNlbGVhdmU6XCJtb3VzZW91dFwifSxmdW5jdGlvbihlLHQpe2IuZXZlbnQuc3BlY2lhbFtlXT17ZGVsZWdhdGVUeXBlOnQsYmluZFR5cGU6dCxoYW5kbGU6ZnVuY3Rpb24oZSl7dmFyIG4scj10aGlzLGk9ZS5yZWxhdGVkVGFyZ2V0LG89ZS5oYW5kbGVPYmo7XG5yZXR1cm4oIWl8fGkhPT1yJiYhYi5jb250YWlucyhyLGkpKSYmKGUudHlwZT1vLm9yaWdUeXBlLG49by5oYW5kbGVyLmFwcGx5KHRoaXMsYXJndW1lbnRzKSxlLnR5cGU9dCksbn19fSksYi5zdXBwb3J0LnN1Ym1pdEJ1YmJsZXN8fChiLmV2ZW50LnNwZWNpYWwuc3VibWl0PXtzZXR1cDpmdW5jdGlvbigpe3JldHVybiBiLm5vZGVOYW1lKHRoaXMsXCJmb3JtXCIpPyExOihiLmV2ZW50LmFkZCh0aGlzLFwiY2xpY2suX3N1Ym1pdCBrZXlwcmVzcy5fc3VibWl0XCIsZnVuY3Rpb24oZSl7dmFyIG49ZS50YXJnZXQscj1iLm5vZGVOYW1lKG4sXCJpbnB1dFwiKXx8Yi5ub2RlTmFtZShuLFwiYnV0dG9uXCIpP24uZm9ybTp0O3ImJiFiLl9kYXRhKHIsXCJzdWJtaXRCdWJibGVzXCIpJiYoYi5ldmVudC5hZGQocixcInN1Ym1pdC5fc3VibWl0XCIsZnVuY3Rpb24oZSl7ZS5fc3VibWl0X2J1YmJsZT0hMH0pLGIuX2RhdGEocixcInN1Ym1pdEJ1YmJsZXNcIiwhMCkpfSksdCl9LHBvc3REaXNwYXRjaDpmdW5jdGlvbihlKXtlLl9zdWJtaXRfYnViYmxlJiYoZGVsZXRlIGUuX3N1Ym1pdF9idWJibGUsdGhpcy5wYXJlbnROb2RlJiYhZS5pc1RyaWdnZXImJmIuZXZlbnQuc2ltdWxhdGUoXCJzdWJtaXRcIix0aGlzLnBhcmVudE5vZGUsZSwhMCkpfSx0ZWFyZG93bjpmdW5jdGlvbigpe3JldHVybiBiLm5vZGVOYW1lKHRoaXMsXCJmb3JtXCIpPyExOihiLmV2ZW50LnJlbW92ZSh0aGlzLFwiLl9zdWJtaXRcIiksdCl9fSksYi5zdXBwb3J0LmNoYW5nZUJ1YmJsZXN8fChiLmV2ZW50LnNwZWNpYWwuY2hhbmdlPXtzZXR1cDpmdW5jdGlvbigpe3JldHVybiBaLnRlc3QodGhpcy5ub2RlTmFtZSk/KChcImNoZWNrYm94XCI9PT10aGlzLnR5cGV8fFwicmFkaW9cIj09PXRoaXMudHlwZSkmJihiLmV2ZW50LmFkZCh0aGlzLFwicHJvcGVydHljaGFuZ2UuX2NoYW5nZVwiLGZ1bmN0aW9uKGUpe1wiY2hlY2tlZFwiPT09ZS5vcmlnaW5hbEV2ZW50LnByb3BlcnR5TmFtZSYmKHRoaXMuX2p1c3RfY2hhbmdlZD0hMCl9KSxiLmV2ZW50LmFkZCh0aGlzLFwiY2xpY2suX2NoYW5nZVwiLGZ1bmN0aW9uKGUpe3RoaXMuX2p1c3RfY2hhbmdlZCYmIWUuaXNUcmlnZ2VyJiYodGhpcy5fanVzdF9jaGFuZ2VkPSExKSxiLmV2ZW50LnNpbXVsYXRlKFwiY2hhbmdlXCIsdGhpcyxlLCEwKX0pKSwhMSk6KGIuZXZlbnQuYWRkKHRoaXMsXCJiZWZvcmVhY3RpdmF0ZS5fY2hhbmdlXCIsZnVuY3Rpb24oZSl7dmFyIHQ9ZS50YXJnZXQ7Wi50ZXN0KHQubm9kZU5hbWUpJiYhYi5fZGF0YSh0LFwiY2hhbmdlQnViYmxlc1wiKSYmKGIuZXZlbnQuYWRkKHQsXCJjaGFuZ2UuX2NoYW5nZVwiLGZ1bmN0aW9uKGUpeyF0aGlzLnBhcmVudE5vZGV8fGUuaXNTaW11bGF0ZWR8fGUuaXNUcmlnZ2VyfHxiLmV2ZW50LnNpbXVsYXRlKFwiY2hhbmdlXCIsdGhpcy5wYXJlbnROb2RlLGUsITApfSksYi5fZGF0YSh0LFwiY2hhbmdlQnViYmxlc1wiLCEwKSl9KSx0KX0saGFuZGxlOmZ1bmN0aW9uKGUpe3ZhciBuPWUudGFyZ2V0O3JldHVybiB0aGlzIT09bnx8ZS5pc1NpbXVsYXRlZHx8ZS5pc1RyaWdnZXJ8fFwicmFkaW9cIiE9PW4udHlwZSYmXCJjaGVja2JveFwiIT09bi50eXBlP2UuaGFuZGxlT2JqLmhhbmRsZXIuYXBwbHkodGhpcyxhcmd1bWVudHMpOnR9LHRlYXJkb3duOmZ1bmN0aW9uKCl7cmV0dXJuIGIuZXZlbnQucmVtb3ZlKHRoaXMsXCIuX2NoYW5nZVwiKSwhWi50ZXN0KHRoaXMubm9kZU5hbWUpfX0pLGIuc3VwcG9ydC5mb2N1c2luQnViYmxlc3x8Yi5lYWNoKHtmb2N1czpcImZvY3VzaW5cIixibHVyOlwiZm9jdXNvdXRcIn0sZnVuY3Rpb24oZSx0KXt2YXIgbj0wLHI9ZnVuY3Rpb24oZSl7Yi5ldmVudC5zaW11bGF0ZSh0LGUudGFyZ2V0LGIuZXZlbnQuZml4KGUpLCEwKX07Yi5ldmVudC5zcGVjaWFsW3RdPXtzZXR1cDpmdW5jdGlvbigpezA9PT1uKysmJm8uYWRkRXZlbnRMaXN0ZW5lcihlLHIsITApfSx0ZWFyZG93bjpmdW5jdGlvbigpezA9PT0tLW4mJm8ucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLHIsITApfX19KSxiLmZuLmV4dGVuZCh7b246ZnVuY3Rpb24oZSxuLHIsaSxvKXt2YXIgYSxzO2lmKFwib2JqZWN0XCI9PXR5cGVvZiBlKXtcInN0cmluZ1wiIT10eXBlb2YgbiYmKHI9cnx8bixuPXQpO2ZvcihhIGluIGUpdGhpcy5vbihhLG4scixlW2FdLG8pO3JldHVybiB0aGlzfWlmKG51bGw9PXImJm51bGw9PWk/KGk9bixyPW49dCk6bnVsbD09aSYmKFwic3RyaW5nXCI9PXR5cGVvZiBuPyhpPXIscj10KTooaT1yLHI9bixuPXQpKSxpPT09ITEpaT1vdDtlbHNlIGlmKCFpKXJldHVybiB0aGlzO3JldHVybiAxPT09byYmKHM9aSxpPWZ1bmN0aW9uKGUpe3JldHVybiBiKCkub2ZmKGUpLHMuYXBwbHkodGhpcyxhcmd1bWVudHMpfSxpLmd1aWQ9cy5ndWlkfHwocy5ndWlkPWIuZ3VpZCsrKSksdGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5ldmVudC5hZGQodGhpcyxlLGkscixuKX0pfSxvbmU6ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIHRoaXMub24oZSx0LG4sciwxKX0sb2ZmOmZ1bmN0aW9uKGUsbixyKXt2YXIgaSxvO2lmKGUmJmUucHJldmVudERlZmF1bHQmJmUuaGFuZGxlT2JqKXJldHVybiBpPWUuaGFuZGxlT2JqLGIoZS5kZWxlZ2F0ZVRhcmdldCkub2ZmKGkubmFtZXNwYWNlP2kub3JpZ1R5cGUrXCIuXCIraS5uYW1lc3BhY2U6aS5vcmlnVHlwZSxpLnNlbGVjdG9yLGkuaGFuZGxlciksdGhpcztpZihcIm9iamVjdFwiPT10eXBlb2YgZSl7Zm9yKG8gaW4gZSl0aGlzLm9mZihvLG4sZVtvXSk7cmV0dXJuIHRoaXN9cmV0dXJuKG49PT0hMXx8XCJmdW5jdGlvblwiPT10eXBlb2YgbikmJihyPW4sbj10KSxyPT09ITEmJihyPW90KSx0aGlzLmVhY2goZnVuY3Rpb24oKXtiLmV2ZW50LnJlbW92ZSh0aGlzLGUscixuKX0pfSxiaW5kOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gdGhpcy5vbihlLG51bGwsdCxuKX0sdW5iaW5kOmZ1bmN0aW9uKGUsdCl7cmV0dXJuIHRoaXMub2ZmKGUsbnVsbCx0KX0sZGVsZWdhdGU6ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIHRoaXMub24odCxlLG4scil9LHVuZGVsZWdhdGU6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiAxPT09YXJndW1lbnRzLmxlbmd0aD90aGlzLm9mZihlLFwiKipcIik6dGhpcy5vZmYodCxlfHxcIioqXCIsbil9LHRyaWdnZXI6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gdGhpcy5lYWNoKGZ1bmN0aW9uKCl7Yi5ldmVudC50cmlnZ2VyKGUsdCx0aGlzKX0pfSx0cmlnZ2VySGFuZGxlcjpmdW5jdGlvbihlLG4pe3ZhciByPXRoaXNbMF07cmV0dXJuIHI/Yi5ldmVudC50cmlnZ2VyKGUsbixyLCEwKTp0fX0pLGZ1bmN0aW9uKGUsdCl7dmFyIG4scixpLG8sYSxzLHUsbCxjLHAsZixkLGgsZyxtLHksdix4PVwic2l6emxlXCIrLW5ldyBEYXRlLHc9ZS5kb2N1bWVudCxUPXt9LE49MCxDPTAsaz1pdCgpLEU9aXQoKSxTPWl0KCksQT10eXBlb2YgdCxqPTE8PDMxLEQ9W10sTD1ELnBvcCxIPUQucHVzaCxxPUQuc2xpY2UsTT1ELmluZGV4T2Z8fGZ1bmN0aW9uKGUpe3ZhciB0PTAsbj10aGlzLmxlbmd0aDtmb3IoO24+dDt0KyspaWYodGhpc1t0XT09PWUpcmV0dXJuIHQ7cmV0dXJuLTF9LF89XCJbXFxcXHgyMFxcXFx0XFxcXHJcXFxcblxcXFxmXVwiLEY9XCIoPzpcXFxcXFxcXC58W1xcXFx3LV18W15cXFxceDAwLVxcXFx4YTBdKStcIixPPUYucmVwbGFjZShcIndcIixcIncjXCIpLEI9XCIoWypeJHwhfl0/PSlcIixQPVwiXFxcXFtcIitfK1wiKihcIitGK1wiKVwiK18rXCIqKD86XCIrQitfK1wiKig/OihbJ1xcXCJdKSgoPzpcXFxcXFxcXC58W15cXFxcXFxcXF0pKj8pXFxcXDN8KFwiK08rXCIpfCl8KVwiK18rXCIqXFxcXF1cIixSPVwiOihcIitGK1wiKSg/OlxcXFwoKChbJ1xcXCJdKSgoPzpcXFxcXFxcXC58W15cXFxcXFxcXF0pKj8pXFxcXDN8KCg/OlxcXFxcXFxcLnxbXlxcXFxcXFxcKClbXFxcXF1dfFwiK1AucmVwbGFjZSgzLDgpK1wiKSopfC4qKVxcXFwpfClcIixXPVJlZ0V4cChcIl5cIitfK1wiK3woKD86XnxbXlxcXFxcXFxcXSkoPzpcXFxcXFxcXC4pKilcIitfK1wiKyRcIixcImdcIiksJD1SZWdFeHAoXCJeXCIrXytcIiosXCIrXytcIipcIiksST1SZWdFeHAoXCJeXCIrXytcIiooW1xcXFx4MjBcXFxcdFxcXFxyXFxcXG5cXFxcZj4rfl0pXCIrXytcIipcIiksej1SZWdFeHAoUiksWD1SZWdFeHAoXCJeXCIrTytcIiRcIiksVT17SUQ6UmVnRXhwKFwiXiMoXCIrRitcIilcIiksQ0xBU1M6UmVnRXhwKFwiXlxcXFwuKFwiK0YrXCIpXCIpLE5BTUU6UmVnRXhwKFwiXlxcXFxbbmFtZT1bJ1xcXCJdPyhcIitGK1wiKVsnXFxcIl0/XFxcXF1cIiksVEFHOlJlZ0V4cChcIl4oXCIrRi5yZXBsYWNlKFwid1wiLFwidypcIikrXCIpXCIpLEFUVFI6UmVnRXhwKFwiXlwiK1ApLFBTRVVETzpSZWdFeHAoXCJeXCIrUiksQ0hJTEQ6UmVnRXhwKFwiXjoob25seXxmaXJzdHxsYXN0fG50aHxudGgtbGFzdCktKGNoaWxkfG9mLXR5cGUpKD86XFxcXChcIitfK1wiKihldmVufG9kZHwoKFsrLV18KShcXFxcZCopbnwpXCIrXytcIiooPzooWystXXwpXCIrXytcIiooXFxcXGQrKXwpKVwiK18rXCIqXFxcXCl8KVwiLFwiaVwiKSxuZWVkc0NvbnRleHQ6UmVnRXhwKFwiXlwiK18rXCIqWz4rfl18OihldmVufG9kZHxlcXxndHxsdHxudGh8Zmlyc3R8bGFzdCkoPzpcXFxcKFwiK18rXCIqKCg/Oi1cXFxcZCk/XFxcXGQqKVwiK18rXCIqXFxcXCl8KSg/PVteLV18JClcIixcImlcIil9LFY9L1tcXHgyMFxcdFxcclxcblxcZl0qWyt+XS8sWT0vXltee10rXFx7XFxzKlxcW25hdGl2ZSBjb2RlLyxKPS9eKD86IyhbXFx3LV0rKXwoXFx3Kyl8XFwuKFtcXHctXSspKSQvLEc9L14oPzppbnB1dHxzZWxlY3R8dGV4dGFyZWF8YnV0dG9uKSQvaSxRPS9eaFxcZCQvaSxLPS8nfFxcXFwvZyxaPS9cXD1bXFx4MjBcXHRcXHJcXG5cXGZdKihbXidcIlxcXV0qKVtcXHgyMFxcdFxcclxcblxcZl0qXFxdL2csZXQ9L1xcXFwoW1xcZGEtZkEtRl17MSw2fVtcXHgyMFxcdFxcclxcblxcZl0/fC4pL2csdHQ9ZnVuY3Rpb24oZSx0KXt2YXIgbj1cIjB4XCIrdC02NTUzNjtyZXR1cm4gbiE9PW4/dDowPm4/U3RyaW5nLmZyb21DaGFyQ29kZShuKzY1NTM2KTpTdHJpbmcuZnJvbUNoYXJDb2RlKDU1Mjk2fG4+PjEwLDU2MzIwfDEwMjMmbil9O3RyeXtxLmNhbGwody5kb2N1bWVudEVsZW1lbnQuY2hpbGROb2RlcywwKVswXS5ub2RlVHlwZX1jYXRjaChudCl7cT1mdW5jdGlvbihlKXt2YXIgdCxuPVtdO3doaWxlKHQ9dGhpc1tlKytdKW4ucHVzaCh0KTtyZXR1cm4gbn19ZnVuY3Rpb24gcnQoZSl7cmV0dXJuIFkudGVzdChlK1wiXCIpfWZ1bmN0aW9uIGl0KCl7dmFyIGUsdD1bXTtyZXR1cm4gZT1mdW5jdGlvbihuLHIpe3JldHVybiB0LnB1c2gobis9XCIgXCIpPmkuY2FjaGVMZW5ndGgmJmRlbGV0ZSBlW3Quc2hpZnQoKV0sZVtuXT1yfX1mdW5jdGlvbiBvdChlKXtyZXR1cm4gZVt4XT0hMCxlfWZ1bmN0aW9uIGF0KGUpe3ZhciB0PXAuY3JlYXRlRWxlbWVudChcImRpdlwiKTt0cnl7cmV0dXJuIGUodCl9Y2F0Y2gobil7cmV0dXJuITF9ZmluYWxseXt0PW51bGx9fWZ1bmN0aW9uIHN0KGUsdCxuLHIpe3ZhciBpLG8sYSxzLHUsbCxmLGcsbSx2O2lmKCh0P3Qub3duZXJEb2N1bWVudHx8dDp3KSE9PXAmJmModCksdD10fHxwLG49bnx8W10sIWV8fFwic3RyaW5nXCIhPXR5cGVvZiBlKXJldHVybiBuO2lmKDEhPT0ocz10Lm5vZGVUeXBlKSYmOSE9PXMpcmV0dXJuW107aWYoIWQmJiFyKXtpZihpPUouZXhlYyhlKSlpZihhPWlbMV0pe2lmKDk9PT1zKXtpZihvPXQuZ2V0RWxlbWVudEJ5SWQoYSksIW98fCFvLnBhcmVudE5vZGUpcmV0dXJuIG47aWYoby5pZD09PWEpcmV0dXJuIG4ucHVzaChvKSxufWVsc2UgaWYodC5vd25lckRvY3VtZW50JiYobz10Lm93bmVyRG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYSkpJiZ5KHQsbykmJm8uaWQ9PT1hKXJldHVybiBuLnB1c2gobyksbn1lbHNle2lmKGlbMl0pcmV0dXJuIEguYXBwbHkobixxLmNhbGwodC5nZXRFbGVtZW50c0J5VGFnTmFtZShlKSwwKSksbjtpZigoYT1pWzNdKSYmVC5nZXRCeUNsYXNzTmFtZSYmdC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKXJldHVybiBILmFwcGx5KG4scS5jYWxsKHQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShhKSwwKSksbn1pZihULnFzYSYmIWgudGVzdChlKSl7aWYoZj0hMCxnPXgsbT10LHY9OT09PXMmJmUsMT09PXMmJlwib2JqZWN0XCIhPT10Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkpe2w9ZnQoZSksKGY9dC5nZXRBdHRyaWJ1dGUoXCJpZFwiKSk/Zz1mLnJlcGxhY2UoSyxcIlxcXFwkJlwiKTp0LnNldEF0dHJpYnV0ZShcImlkXCIsZyksZz1cIltpZD0nXCIrZytcIiddIFwiLHU9bC5sZW5ndGg7d2hpbGUodS0tKWxbdV09ZytkdChsW3VdKTttPVYudGVzdChlKSYmdC5wYXJlbnROb2RlfHx0LHY9bC5qb2luKFwiLFwiKX1pZih2KXRyeXtyZXR1cm4gSC5hcHBseShuLHEuY2FsbChtLnF1ZXJ5U2VsZWN0b3JBbGwodiksMCkpLG59Y2F0Y2goYil7fWZpbmFsbHl7Znx8dC5yZW1vdmVBdHRyaWJ1dGUoXCJpZFwiKX19fXJldHVybiB3dChlLnJlcGxhY2UoVyxcIiQxXCIpLHQsbixyKX1hPXN0LmlzWE1MPWZ1bmN0aW9uKGUpe3ZhciB0PWUmJihlLm93bmVyRG9jdW1lbnR8fGUpLmRvY3VtZW50RWxlbWVudDtyZXR1cm4gdD9cIkhUTUxcIiE9PXQubm9kZU5hbWU6ITF9LGM9c3Quc2V0RG9jdW1lbnQ9ZnVuY3Rpb24oZSl7dmFyIG49ZT9lLm93bmVyRG9jdW1lbnR8fGU6dztyZXR1cm4gbiE9PXAmJjk9PT1uLm5vZGVUeXBlJiZuLmRvY3VtZW50RWxlbWVudD8ocD1uLGY9bi5kb2N1bWVudEVsZW1lbnQsZD1hKG4pLFQudGFnTmFtZU5vQ29tbWVudHM9YXQoZnVuY3Rpb24oZSl7cmV0dXJuIGUuYXBwZW5kQ2hpbGQobi5jcmVhdGVDb21tZW50KFwiXCIpKSwhZS5nZXRFbGVtZW50c0J5VGFnTmFtZShcIipcIikubGVuZ3RofSksVC5hdHRyaWJ1dGVzPWF0KGZ1bmN0aW9uKGUpe2UuaW5uZXJIVE1MPVwiPHNlbGVjdD48L3NlbGVjdD5cIjt2YXIgdD10eXBlb2YgZS5sYXN0Q2hpbGQuZ2V0QXR0cmlidXRlKFwibXVsdGlwbGVcIik7cmV0dXJuXCJib29sZWFuXCIhPT10JiZcInN0cmluZ1wiIT09dH0pLFQuZ2V0QnlDbGFzc05hbWU9YXQoZnVuY3Rpb24oZSl7cmV0dXJuIGUuaW5uZXJIVE1MPVwiPGRpdiBjbGFzcz0naGlkZGVuIGUnPjwvZGl2PjxkaXYgY2xhc3M9J2hpZGRlbic+PC9kaXY+XCIsZS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lJiZlLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJlXCIpLmxlbmd0aD8oZS5sYXN0Q2hpbGQuY2xhc3NOYW1lPVwiZVwiLDI9PT1lLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJlXCIpLmxlbmd0aCk6ITF9KSxULmdldEJ5TmFtZT1hdChmdW5jdGlvbihlKXtlLmlkPXgrMCxlLmlubmVySFRNTD1cIjxhIG5hbWU9J1wiK3grXCInPjwvYT48ZGl2IG5hbWU9J1wiK3grXCInPjwvZGl2PlwiLGYuaW5zZXJ0QmVmb3JlKGUsZi5maXJzdENoaWxkKTt2YXIgdD1uLmdldEVsZW1lbnRzQnlOYW1lJiZuLmdldEVsZW1lbnRzQnlOYW1lKHgpLmxlbmd0aD09PTIrbi5nZXRFbGVtZW50c0J5TmFtZSh4KzApLmxlbmd0aDtyZXR1cm4gVC5nZXRJZE5vdE5hbWU9IW4uZ2V0RWxlbWVudEJ5SWQoeCksZi5yZW1vdmVDaGlsZChlKSx0fSksaS5hdHRySGFuZGxlPWF0KGZ1bmN0aW9uKGUpe3JldHVybiBlLmlubmVySFRNTD1cIjxhIGhyZWY9JyMnPjwvYT5cIixlLmZpcnN0Q2hpbGQmJnR5cGVvZiBlLmZpcnN0Q2hpbGQuZ2V0QXR0cmlidXRlIT09QSYmXCIjXCI9PT1lLmZpcnN0Q2hpbGQuZ2V0QXR0cmlidXRlKFwiaHJlZlwiKX0pP3t9OntocmVmOmZ1bmN0aW9uKGUpe3JldHVybiBlLmdldEF0dHJpYnV0ZShcImhyZWZcIiwyKX0sdHlwZTpmdW5jdGlvbihlKXtyZXR1cm4gZS5nZXRBdHRyaWJ1dGUoXCJ0eXBlXCIpfX0sVC5nZXRJZE5vdE5hbWU/KGkuZmluZC5JRD1mdW5jdGlvbihlLHQpe2lmKHR5cGVvZiB0LmdldEVsZW1lbnRCeUlkIT09QSYmIWQpe3ZhciBuPXQuZ2V0RWxlbWVudEJ5SWQoZSk7cmV0dXJuIG4mJm4ucGFyZW50Tm9kZT9bbl06W119fSxpLmZpbHRlci5JRD1mdW5jdGlvbihlKXt2YXIgdD1lLnJlcGxhY2UoZXQsdHQpO3JldHVybiBmdW5jdGlvbihlKXtyZXR1cm4gZS5nZXRBdHRyaWJ1dGUoXCJpZFwiKT09PXR9fSk6KGkuZmluZC5JRD1mdW5jdGlvbihlLG4pe2lmKHR5cGVvZiBuLmdldEVsZW1lbnRCeUlkIT09QSYmIWQpe3ZhciByPW4uZ2V0RWxlbWVudEJ5SWQoZSk7cmV0dXJuIHI/ci5pZD09PWV8fHR5cGVvZiByLmdldEF0dHJpYnV0ZU5vZGUhPT1BJiZyLmdldEF0dHJpYnV0ZU5vZGUoXCJpZFwiKS52YWx1ZT09PWU/W3JdOnQ6W119fSxpLmZpbHRlci5JRD1mdW5jdGlvbihlKXt2YXIgdD1lLnJlcGxhY2UoZXQsdHQpO3JldHVybiBmdW5jdGlvbihlKXt2YXIgbj10eXBlb2YgZS5nZXRBdHRyaWJ1dGVOb2RlIT09QSYmZS5nZXRBdHRyaWJ1dGVOb2RlKFwiaWRcIik7cmV0dXJuIG4mJm4udmFsdWU9PT10fX0pLGkuZmluZC5UQUc9VC50YWdOYW1lTm9Db21tZW50cz9mdW5jdGlvbihlLG4pe3JldHVybiB0eXBlb2Ygbi5nZXRFbGVtZW50c0J5VGFnTmFtZSE9PUE/bi5nZXRFbGVtZW50c0J5VGFnTmFtZShlKTp0fTpmdW5jdGlvbihlLHQpe3ZhciBuLHI9W10saT0wLG89dC5nZXRFbGVtZW50c0J5VGFnTmFtZShlKTtpZihcIipcIj09PWUpe3doaWxlKG49b1tpKytdKTE9PT1uLm5vZGVUeXBlJiZyLnB1c2gobik7cmV0dXJuIHJ9cmV0dXJuIG99LGkuZmluZC5OQU1FPVQuZ2V0QnlOYW1lJiZmdW5jdGlvbihlLG4pe3JldHVybiB0eXBlb2Ygbi5nZXRFbGVtZW50c0J5TmFtZSE9PUE/bi5nZXRFbGVtZW50c0J5TmFtZShuYW1lKTp0fSxpLmZpbmQuQ0xBU1M9VC5nZXRCeUNsYXNzTmFtZSYmZnVuY3Rpb24oZSxuKXtyZXR1cm4gdHlwZW9mIG4uZ2V0RWxlbWVudHNCeUNsYXNzTmFtZT09PUF8fGQ/dDpuLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoZSl9LGc9W10saD1bXCI6Zm9jdXNcIl0sKFQucXNhPXJ0KG4ucXVlcnlTZWxlY3RvckFsbCkpJiYoYXQoZnVuY3Rpb24oZSl7ZS5pbm5lckhUTUw9XCI8c2VsZWN0PjxvcHRpb24gc2VsZWN0ZWQ9Jyc+PC9vcHRpb24+PC9zZWxlY3Q+XCIsZS5xdWVyeVNlbGVjdG9yQWxsKFwiW3NlbGVjdGVkXVwiKS5sZW5ndGh8fGgucHVzaChcIlxcXFxbXCIrXytcIiooPzpjaGVja2VkfGRpc2FibGVkfGlzbWFwfG11bHRpcGxlfHJlYWRvbmx5fHNlbGVjdGVkfHZhbHVlKVwiKSxlLnF1ZXJ5U2VsZWN0b3JBbGwoXCI6Y2hlY2tlZFwiKS5sZW5ndGh8fGgucHVzaChcIjpjaGVja2VkXCIpfSksYXQoZnVuY3Rpb24oZSl7ZS5pbm5lckhUTUw9XCI8aW5wdXQgdHlwZT0naGlkZGVuJyBpPScnLz5cIixlLnF1ZXJ5U2VsZWN0b3JBbGwoXCJbaV49JyddXCIpLmxlbmd0aCYmaC5wdXNoKFwiWypeJF09XCIrXytcIiooPzpcXFwiXFxcInwnJylcIiksZS5xdWVyeVNlbGVjdG9yQWxsKFwiOmVuYWJsZWRcIikubGVuZ3RofHxoLnB1c2goXCI6ZW5hYmxlZFwiLFwiOmRpc2FibGVkXCIpLGUucXVlcnlTZWxlY3RvckFsbChcIiosOnhcIiksaC5wdXNoKFwiLC4qOlwiKX0pKSwoVC5tYXRjaGVzU2VsZWN0b3I9cnQobT1mLm1hdGNoZXNTZWxlY3Rvcnx8Zi5tb3pNYXRjaGVzU2VsZWN0b3J8fGYud2Via2l0TWF0Y2hlc1NlbGVjdG9yfHxmLm9NYXRjaGVzU2VsZWN0b3J8fGYubXNNYXRjaGVzU2VsZWN0b3IpKSYmYXQoZnVuY3Rpb24oZSl7VC5kaXNjb25uZWN0ZWRNYXRjaD1tLmNhbGwoZSxcImRpdlwiKSxtLmNhbGwoZSxcIltzIT0nJ106eFwiKSxnLnB1c2goXCIhPVwiLFIpfSksaD1SZWdFeHAoaC5qb2luKFwifFwiKSksZz1SZWdFeHAoZy5qb2luKFwifFwiKSkseT1ydChmLmNvbnRhaW5zKXx8Zi5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbj9mdW5jdGlvbihlLHQpe3ZhciBuPTk9PT1lLm5vZGVUeXBlP2UuZG9jdW1lbnRFbGVtZW50OmUscj10JiZ0LnBhcmVudE5vZGU7cmV0dXJuIGU9PT1yfHwhKCFyfHwxIT09ci5ub2RlVHlwZXx8IShuLmNvbnRhaW5zP24uY29udGFpbnMocik6ZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbiYmMTYmZS5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbihyKSkpfTpmdW5jdGlvbihlLHQpe2lmKHQpd2hpbGUodD10LnBhcmVudE5vZGUpaWYodD09PWUpcmV0dXJuITA7cmV0dXJuITF9LHY9Zi5jb21wYXJlRG9jdW1lbnRQb3NpdGlvbj9mdW5jdGlvbihlLHQpe3ZhciByO3JldHVybiBlPT09dD8odT0hMCwwKToocj10LmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uJiZlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uJiZlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKHQpKT8xJnJ8fGUucGFyZW50Tm9kZSYmMTE9PT1lLnBhcmVudE5vZGUubm9kZVR5cGU/ZT09PW58fHkodyxlKT8tMTp0PT09bnx8eSh3LHQpPzE6MDo0JnI/LTE6MTplLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uPy0xOjF9OmZ1bmN0aW9uKGUsdCl7dmFyIHIsaT0wLG89ZS5wYXJlbnROb2RlLGE9dC5wYXJlbnROb2RlLHM9W2VdLGw9W3RdO2lmKGU9PT10KXJldHVybiB1PSEwLDA7aWYoIW98fCFhKXJldHVybiBlPT09bj8tMTp0PT09bj8xOm8/LTE6YT8xOjA7aWYobz09PWEpcmV0dXJuIHV0KGUsdCk7cj1lO3doaWxlKHI9ci5wYXJlbnROb2RlKXMudW5zaGlmdChyKTtyPXQ7d2hpbGUocj1yLnBhcmVudE5vZGUpbC51bnNoaWZ0KHIpO3doaWxlKHNbaV09PT1sW2ldKWkrKztyZXR1cm4gaT91dChzW2ldLGxbaV0pOnNbaV09PT13Py0xOmxbaV09PT13PzE6MH0sdT0hMSxbMCwwXS5zb3J0KHYpLFQuZGV0ZWN0RHVwbGljYXRlcz11LHApOnB9LHN0Lm1hdGNoZXM9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gc3QoZSxudWxsLG51bGwsdCl9LHN0Lm1hdGNoZXNTZWxlY3Rvcj1mdW5jdGlvbihlLHQpe2lmKChlLm93bmVyRG9jdW1lbnR8fGUpIT09cCYmYyhlKSx0PXQucmVwbGFjZShaLFwiPSckMSddXCIpLCEoIVQubWF0Y2hlc1NlbGVjdG9yfHxkfHxnJiZnLnRlc3QodCl8fGgudGVzdCh0KSkpdHJ5e3ZhciBuPW0uY2FsbChlLHQpO2lmKG58fFQuZGlzY29ubmVjdGVkTWF0Y2h8fGUuZG9jdW1lbnQmJjExIT09ZS5kb2N1bWVudC5ub2RlVHlwZSlyZXR1cm4gbn1jYXRjaChyKXt9cmV0dXJuIHN0KHQscCxudWxsLFtlXSkubGVuZ3RoPjB9LHN0LmNvbnRhaW5zPWZ1bmN0aW9uKGUsdCl7cmV0dXJuKGUub3duZXJEb2N1bWVudHx8ZSkhPT1wJiZjKGUpLHkoZSx0KX0sc3QuYXR0cj1mdW5jdGlvbihlLHQpe3ZhciBuO3JldHVybihlLm93bmVyRG9jdW1lbnR8fGUpIT09cCYmYyhlKSxkfHwodD10LnRvTG93ZXJDYXNlKCkpLChuPWkuYXR0ckhhbmRsZVt0XSk/bihlKTpkfHxULmF0dHJpYnV0ZXM/ZS5nZXRBdHRyaWJ1dGUodCk6KChuPWUuZ2V0QXR0cmlidXRlTm9kZSh0KSl8fGUuZ2V0QXR0cmlidXRlKHQpKSYmZVt0XT09PSEwP3Q6biYmbi5zcGVjaWZpZWQ/bi52YWx1ZTpudWxsfSxzdC5lcnJvcj1mdW5jdGlvbihlKXt0aHJvdyBFcnJvcihcIlN5bnRheCBlcnJvciwgdW5yZWNvZ25pemVkIGV4cHJlc3Npb246IFwiK2UpfSxzdC51bmlxdWVTb3J0PWZ1bmN0aW9uKGUpe3ZhciB0LG49W10scj0xLGk9MDtpZih1PSFULmRldGVjdER1cGxpY2F0ZXMsZS5zb3J0KHYpLHUpe2Zvcig7dD1lW3JdO3IrKyl0PT09ZVtyLTFdJiYoaT1uLnB1c2gocikpO3doaWxlKGktLSllLnNwbGljZShuW2ldLDEpfXJldHVybiBlfTtmdW5jdGlvbiB1dChlLHQpe3ZhciBuPXQmJmUscj1uJiYofnQuc291cmNlSW5kZXh8fGopLSh+ZS5zb3VyY2VJbmRleHx8aik7aWYocilyZXR1cm4gcjtpZihuKXdoaWxlKG49bi5uZXh0U2libGluZylpZihuPT09dClyZXR1cm4tMTtyZXR1cm4gZT8xOi0xfWZ1bmN0aW9uIGx0KGUpe3JldHVybiBmdW5jdGlvbih0KXt2YXIgbj10Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7cmV0dXJuXCJpbnB1dFwiPT09biYmdC50eXBlPT09ZX19ZnVuY3Rpb24gY3QoZSl7cmV0dXJuIGZ1bmN0aW9uKHQpe3ZhciBuPXQubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtyZXR1cm4oXCJpbnB1dFwiPT09bnx8XCJidXR0b25cIj09PW4pJiZ0LnR5cGU9PT1lfX1mdW5jdGlvbiBwdChlKXtyZXR1cm4gb3QoZnVuY3Rpb24odCl7cmV0dXJuIHQ9K3Qsb3QoZnVuY3Rpb24obixyKXt2YXIgaSxvPWUoW10sbi5sZW5ndGgsdCksYT1vLmxlbmd0aDt3aGlsZShhLS0pbltpPW9bYV1dJiYobltpXT0hKHJbaV09bltpXSkpfSl9KX1vPXN0LmdldFRleHQ9ZnVuY3Rpb24oZSl7dmFyIHQsbj1cIlwiLHI9MCxpPWUubm9kZVR5cGU7aWYoaSl7aWYoMT09PWl8fDk9PT1pfHwxMT09PWkpe2lmKFwic3RyaW5nXCI9PXR5cGVvZiBlLnRleHRDb250ZW50KXJldHVybiBlLnRleHRDb250ZW50O2ZvcihlPWUuZmlyc3RDaGlsZDtlO2U9ZS5uZXh0U2libGluZyluKz1vKGUpfWVsc2UgaWYoMz09PWl8fDQ9PT1pKXJldHVybiBlLm5vZGVWYWx1ZX1lbHNlIGZvcig7dD1lW3JdO3IrKyluKz1vKHQpO3JldHVybiBufSxpPXN0LnNlbGVjdG9ycz17Y2FjaGVMZW5ndGg6NTAsY3JlYXRlUHNldWRvOm90LG1hdGNoOlUsZmluZDp7fSxyZWxhdGl2ZTp7XCI+XCI6e2RpcjpcInBhcmVudE5vZGVcIixmaXJzdDohMH0sXCIgXCI6e2RpcjpcInBhcmVudE5vZGVcIn0sXCIrXCI6e2RpcjpcInByZXZpb3VzU2libGluZ1wiLGZpcnN0OiEwfSxcIn5cIjp7ZGlyOlwicHJldmlvdXNTaWJsaW5nXCJ9fSxwcmVGaWx0ZXI6e0FUVFI6ZnVuY3Rpb24oZSl7cmV0dXJuIGVbMV09ZVsxXS5yZXBsYWNlKGV0LHR0KSxlWzNdPShlWzRdfHxlWzVdfHxcIlwiKS5yZXBsYWNlKGV0LHR0KSxcIn49XCI9PT1lWzJdJiYoZVszXT1cIiBcIitlWzNdK1wiIFwiKSxlLnNsaWNlKDAsNCl9LENISUxEOmZ1bmN0aW9uKGUpe3JldHVybiBlWzFdPWVbMV0udG9Mb3dlckNhc2UoKSxcIm50aFwiPT09ZVsxXS5zbGljZSgwLDMpPyhlWzNdfHxzdC5lcnJvcihlWzBdKSxlWzRdPSsoZVs0XT9lWzVdKyhlWzZdfHwxKToyKihcImV2ZW5cIj09PWVbM118fFwib2RkXCI9PT1lWzNdKSksZVs1XT0rKGVbN10rZVs4XXx8XCJvZGRcIj09PWVbM10pKTplWzNdJiZzdC5lcnJvcihlWzBdKSxlfSxQU0VVRE86ZnVuY3Rpb24oZSl7dmFyIHQsbj0hZVs1XSYmZVsyXTtyZXR1cm4gVS5DSElMRC50ZXN0KGVbMF0pP251bGw6KGVbNF0/ZVsyXT1lWzRdOm4mJnoudGVzdChuKSYmKHQ9ZnQobiwhMCkpJiYodD1uLmluZGV4T2YoXCIpXCIsbi5sZW5ndGgtdCktbi5sZW5ndGgpJiYoZVswXT1lWzBdLnNsaWNlKDAsdCksZVsyXT1uLnNsaWNlKDAsdCkpLGUuc2xpY2UoMCwzKSl9fSxmaWx0ZXI6e1RBRzpmdW5jdGlvbihlKXtyZXR1cm5cIipcIj09PWU/ZnVuY3Rpb24oKXtyZXR1cm4hMH06KGU9ZS5yZXBsYWNlKGV0LHR0KS50b0xvd2VyQ2FzZSgpLGZ1bmN0aW9uKHQpe3JldHVybiB0Lm5vZGVOYW1lJiZ0Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk9PT1lfSl9LENMQVNTOmZ1bmN0aW9uKGUpe3ZhciB0PWtbZStcIiBcIl07cmV0dXJuIHR8fCh0PVJlZ0V4cChcIihefFwiK18rXCIpXCIrZStcIihcIitfK1wifCQpXCIpKSYmayhlLGZ1bmN0aW9uKGUpe3JldHVybiB0LnRlc3QoZS5jbGFzc05hbWV8fHR5cGVvZiBlLmdldEF0dHJpYnV0ZSE9PUEmJmUuZ2V0QXR0cmlidXRlKFwiY2xhc3NcIil8fFwiXCIpfSl9LEFUVFI6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBmdW5jdGlvbihyKXt2YXIgaT1zdC5hdHRyKHIsZSk7cmV0dXJuIG51bGw9PWk/XCIhPVwiPT09dDp0PyhpKz1cIlwiLFwiPVwiPT09dD9pPT09bjpcIiE9XCI9PT10P2khPT1uOlwiXj1cIj09PXQ/biYmMD09PWkuaW5kZXhPZihuKTpcIio9XCI9PT10P24mJmkuaW5kZXhPZihuKT4tMTpcIiQ9XCI9PT10P24mJmkuc2xpY2UoLW4ubGVuZ3RoKT09PW46XCJ+PVwiPT09dD8oXCIgXCIraStcIiBcIikuaW5kZXhPZihuKT4tMTpcInw9XCI9PT10P2k9PT1ufHxpLnNsaWNlKDAsbi5sZW5ndGgrMSk9PT1uK1wiLVwiOiExKTohMH19LENISUxEOmZ1bmN0aW9uKGUsdCxuLHIsaSl7dmFyIG89XCJudGhcIiE9PWUuc2xpY2UoMCwzKSxhPVwibGFzdFwiIT09ZS5zbGljZSgtNCkscz1cIm9mLXR5cGVcIj09PXQ7cmV0dXJuIDE9PT1yJiYwPT09aT9mdW5jdGlvbihlKXtyZXR1cm4hIWUucGFyZW50Tm9kZX06ZnVuY3Rpb24odCxuLHUpe3ZhciBsLGMscCxmLGQsaCxnPW8hPT1hP1wibmV4dFNpYmxpbmdcIjpcInByZXZpb3VzU2libGluZ1wiLG09dC5wYXJlbnROb2RlLHk9cyYmdC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpLHY9IXUmJiFzO2lmKG0pe2lmKG8pe3doaWxlKGcpe3A9dDt3aGlsZShwPXBbZ10paWYocz9wLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk9PT15OjE9PT1wLm5vZGVUeXBlKXJldHVybiExO2g9Zz1cIm9ubHlcIj09PWUmJiFoJiZcIm5leHRTaWJsaW5nXCJ9cmV0dXJuITB9aWYoaD1bYT9tLmZpcnN0Q2hpbGQ6bS5sYXN0Q2hpbGRdLGEmJnYpe2M9bVt4XXx8KG1beF09e30pLGw9Y1tlXXx8W10sZD1sWzBdPT09TiYmbFsxXSxmPWxbMF09PT1OJiZsWzJdLHA9ZCYmbS5jaGlsZE5vZGVzW2RdO3doaWxlKHA9KytkJiZwJiZwW2ddfHwoZj1kPTApfHxoLnBvcCgpKWlmKDE9PT1wLm5vZGVUeXBlJiYrK2YmJnA9PT10KXtjW2VdPVtOLGQsZl07YnJlYWt9fWVsc2UgaWYodiYmKGw9KHRbeF18fCh0W3hdPXt9KSlbZV0pJiZsWzBdPT09TilmPWxbMV07ZWxzZSB3aGlsZShwPSsrZCYmcCYmcFtnXXx8KGY9ZD0wKXx8aC5wb3AoKSlpZigocz9wLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk9PT15OjE9PT1wLm5vZGVUeXBlKSYmKytmJiYodiYmKChwW3hdfHwocFt4XT17fSkpW2VdPVtOLGZdKSxwPT09dCkpYnJlYWs7cmV0dXJuIGYtPWksZj09PXJ8fDA9PT1mJXImJmYvcj49MH19fSxQU0VVRE86ZnVuY3Rpb24oZSx0KXt2YXIgbixyPWkucHNldWRvc1tlXXx8aS5zZXRGaWx0ZXJzW2UudG9Mb3dlckNhc2UoKV18fHN0LmVycm9yKFwidW5zdXBwb3J0ZWQgcHNldWRvOiBcIitlKTtyZXR1cm4gclt4XT9yKHQpOnIubGVuZ3RoPjE/KG49W2UsZSxcIlwiLHRdLGkuc2V0RmlsdGVycy5oYXNPd25Qcm9wZXJ0eShlLnRvTG93ZXJDYXNlKCkpP290KGZ1bmN0aW9uKGUsbil7dmFyIGksbz1yKGUsdCksYT1vLmxlbmd0aDt3aGlsZShhLS0paT1NLmNhbGwoZSxvW2FdKSxlW2ldPSEobltpXT1vW2FdKX0pOmZ1bmN0aW9uKGUpe3JldHVybiByKGUsMCxuKX0pOnJ9fSxwc2V1ZG9zOntub3Q6b3QoZnVuY3Rpb24oZSl7dmFyIHQ9W10sbj1bXSxyPXMoZS5yZXBsYWNlKFcsXCIkMVwiKSk7cmV0dXJuIHJbeF0/b3QoZnVuY3Rpb24oZSx0LG4saSl7dmFyIG8sYT1yKGUsbnVsbCxpLFtdKSxzPWUubGVuZ3RoO3doaWxlKHMtLSkobz1hW3NdKSYmKGVbc109ISh0W3NdPW8pKX0pOmZ1bmN0aW9uKGUsaSxvKXtyZXR1cm4gdFswXT1lLHIodCxudWxsLG8sbiksIW4ucG9wKCl9fSksaGFzOm90KGZ1bmN0aW9uKGUpe3JldHVybiBmdW5jdGlvbih0KXtyZXR1cm4gc3QoZSx0KS5sZW5ndGg+MH19KSxjb250YWluczpvdChmdW5jdGlvbihlKXtyZXR1cm4gZnVuY3Rpb24odCl7cmV0dXJuKHQudGV4dENvbnRlbnR8fHQuaW5uZXJUZXh0fHxvKHQpKS5pbmRleE9mKGUpPi0xfX0pLGxhbmc6b3QoZnVuY3Rpb24oZSl7cmV0dXJuIFgudGVzdChlfHxcIlwiKXx8c3QuZXJyb3IoXCJ1bnN1cHBvcnRlZCBsYW5nOiBcIitlKSxlPWUucmVwbGFjZShldCx0dCkudG9Mb3dlckNhc2UoKSxmdW5jdGlvbih0KXt2YXIgbjtkbyBpZihuPWQ/dC5nZXRBdHRyaWJ1dGUoXCJ4bWw6bGFuZ1wiKXx8dC5nZXRBdHRyaWJ1dGUoXCJsYW5nXCIpOnQubGFuZylyZXR1cm4gbj1uLnRvTG93ZXJDYXNlKCksbj09PWV8fDA9PT1uLmluZGV4T2YoZStcIi1cIik7d2hpbGUoKHQ9dC5wYXJlbnROb2RlKSYmMT09PXQubm9kZVR5cGUpO3JldHVybiExfX0pLHRhcmdldDpmdW5jdGlvbih0KXt2YXIgbj1lLmxvY2F0aW9uJiZlLmxvY2F0aW9uLmhhc2g7cmV0dXJuIG4mJm4uc2xpY2UoMSk9PT10LmlkfSxyb290OmZ1bmN0aW9uKGUpe3JldHVybiBlPT09Zn0sZm9jdXM6ZnVuY3Rpb24oZSl7cmV0dXJuIGU9PT1wLmFjdGl2ZUVsZW1lbnQmJighcC5oYXNGb2N1c3x8cC5oYXNGb2N1cygpKSYmISEoZS50eXBlfHxlLmhyZWZ8fH5lLnRhYkluZGV4KX0sZW5hYmxlZDpmdW5jdGlvbihlKXtyZXR1cm4gZS5kaXNhYmxlZD09PSExfSxkaXNhYmxlZDpmdW5jdGlvbihlKXtyZXR1cm4gZS5kaXNhYmxlZD09PSEwfSxjaGVja2VkOmZ1bmN0aW9uKGUpe3ZhciB0PWUubm9kZU5hbWUudG9Mb3dlckNhc2UoKTtyZXR1cm5cImlucHV0XCI9PT10JiYhIWUuY2hlY2tlZHx8XCJvcHRpb25cIj09PXQmJiEhZS5zZWxlY3RlZH0sc2VsZWN0ZWQ6ZnVuY3Rpb24oZSl7cmV0dXJuIGUucGFyZW50Tm9kZSYmZS5wYXJlbnROb2RlLnNlbGVjdGVkSW5kZXgsZS5zZWxlY3RlZD09PSEwfSxlbXB0eTpmdW5jdGlvbihlKXtmb3IoZT1lLmZpcnN0Q2hpbGQ7ZTtlPWUubmV4dFNpYmxpbmcpaWYoZS5ub2RlTmFtZT5cIkBcInx8Mz09PWUubm9kZVR5cGV8fDQ9PT1lLm5vZGVUeXBlKXJldHVybiExO3JldHVybiEwfSxwYXJlbnQ6ZnVuY3Rpb24oZSl7cmV0dXJuIWkucHNldWRvcy5lbXB0eShlKX0saGVhZGVyOmZ1bmN0aW9uKGUpe3JldHVybiBRLnRlc3QoZS5ub2RlTmFtZSl9LGlucHV0OmZ1bmN0aW9uKGUpe3JldHVybiBHLnRlc3QoZS5ub2RlTmFtZSl9LGJ1dHRvbjpmdW5jdGlvbihlKXt2YXIgdD1lLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7cmV0dXJuXCJpbnB1dFwiPT09dCYmXCJidXR0b25cIj09PWUudHlwZXx8XCJidXR0b25cIj09PXR9LHRleHQ6ZnVuY3Rpb24oZSl7dmFyIHQ7cmV0dXJuXCJpbnB1dFwiPT09ZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpJiZcInRleHRcIj09PWUudHlwZSYmKG51bGw9PSh0PWUuZ2V0QXR0cmlidXRlKFwidHlwZVwiKSl8fHQudG9Mb3dlckNhc2UoKT09PWUudHlwZSl9LGZpcnN0OnB0KGZ1bmN0aW9uKCl7cmV0dXJuWzBdfSksbGFzdDpwdChmdW5jdGlvbihlLHQpe3JldHVyblt0LTFdfSksZXE6cHQoZnVuY3Rpb24oZSx0LG4pe3JldHVyblswPm4/bit0Om5dfSksZXZlbjpwdChmdW5jdGlvbihlLHQpe3ZhciBuPTA7Zm9yKDt0Pm47bis9MillLnB1c2gobik7cmV0dXJuIGV9KSxvZGQ6cHQoZnVuY3Rpb24oZSx0KXt2YXIgbj0xO2Zvcig7dD5uO24rPTIpZS5wdXNoKG4pO3JldHVybiBlfSksbHQ6cHQoZnVuY3Rpb24oZSx0LG4pe3ZhciByPTA+bj9uK3Q6bjtmb3IoOy0tcj49MDspZS5wdXNoKHIpO3JldHVybiBlfSksZ3Q6cHQoZnVuY3Rpb24oZSx0LG4pe3ZhciByPTA+bj9uK3Q6bjtmb3IoO3Q+KytyOyllLnB1c2gocik7cmV0dXJuIGV9KX19O2ZvcihuIGlue3JhZGlvOiEwLGNoZWNrYm94OiEwLGZpbGU6ITAscGFzc3dvcmQ6ITAsaW1hZ2U6ITB9KWkucHNldWRvc1tuXT1sdChuKTtmb3IobiBpbntzdWJtaXQ6ITAscmVzZXQ6ITB9KWkucHNldWRvc1tuXT1jdChuKTtmdW5jdGlvbiBmdChlLHQpe3ZhciBuLHIsbyxhLHMsdSxsLGM9RVtlK1wiIFwiXTtpZihjKXJldHVybiB0PzA6Yy5zbGljZSgwKTtzPWUsdT1bXSxsPWkucHJlRmlsdGVyO3doaWxlKHMpeyghbnx8KHI9JC5leGVjKHMpKSkmJihyJiYocz1zLnNsaWNlKHJbMF0ubGVuZ3RoKXx8cyksdS5wdXNoKG89W10pKSxuPSExLChyPUkuZXhlYyhzKSkmJihuPXIuc2hpZnQoKSxvLnB1c2goe3ZhbHVlOm4sdHlwZTpyWzBdLnJlcGxhY2UoVyxcIiBcIil9KSxzPXMuc2xpY2Uobi5sZW5ndGgpKTtmb3IoYSBpbiBpLmZpbHRlcikhKHI9VVthXS5leGVjKHMpKXx8bFthXSYmIShyPWxbYV0ocikpfHwobj1yLnNoaWZ0KCksby5wdXNoKHt2YWx1ZTpuLHR5cGU6YSxtYXRjaGVzOnJ9KSxzPXMuc2xpY2Uobi5sZW5ndGgpKTtpZighbilicmVha31yZXR1cm4gdD9zLmxlbmd0aDpzP3N0LmVycm9yKGUpOkUoZSx1KS5zbGljZSgwKX1mdW5jdGlvbiBkdChlKXt2YXIgdD0wLG49ZS5sZW5ndGgscj1cIlwiO2Zvcig7bj50O3QrKylyKz1lW3RdLnZhbHVlO3JldHVybiByfWZ1bmN0aW9uIGh0KGUsdCxuKXt2YXIgaT10LmRpcixvPW4mJlwicGFyZW50Tm9kZVwiPT09aSxhPUMrKztyZXR1cm4gdC5maXJzdD9mdW5jdGlvbih0LG4scil7d2hpbGUodD10W2ldKWlmKDE9PT10Lm5vZGVUeXBlfHxvKXJldHVybiBlKHQsbixyKX06ZnVuY3Rpb24odCxuLHMpe3ZhciB1LGwsYyxwPU4rXCIgXCIrYTtpZihzKXt3aGlsZSh0PXRbaV0paWYoKDE9PT10Lm5vZGVUeXBlfHxvKSYmZSh0LG4scykpcmV0dXJuITB9ZWxzZSB3aGlsZSh0PXRbaV0paWYoMT09PXQubm9kZVR5cGV8fG8paWYoYz10W3hdfHwodFt4XT17fSksKGw9Y1tpXSkmJmxbMF09PT1wKXtpZigodT1sWzFdKT09PSEwfHx1PT09cilyZXR1cm4gdT09PSEwfWVsc2UgaWYobD1jW2ldPVtwXSxsWzFdPWUodCxuLHMpfHxyLGxbMV09PT0hMClyZXR1cm4hMH19ZnVuY3Rpb24gZ3QoZSl7cmV0dXJuIGUubGVuZ3RoPjE/ZnVuY3Rpb24odCxuLHIpe3ZhciBpPWUubGVuZ3RoO3doaWxlKGktLSlpZighZVtpXSh0LG4scikpcmV0dXJuITE7cmV0dXJuITB9OmVbMF19ZnVuY3Rpb24gbXQoZSx0LG4scixpKXt2YXIgbyxhPVtdLHM9MCx1PWUubGVuZ3RoLGw9bnVsbCE9dDtmb3IoO3U+cztzKyspKG89ZVtzXSkmJighbnx8bihvLHIsaSkpJiYoYS5wdXNoKG8pLGwmJnQucHVzaChzKSk7cmV0dXJuIGF9ZnVuY3Rpb24geXQoZSx0LG4scixpLG8pe3JldHVybiByJiYhclt4XSYmKHI9eXQocikpLGkmJiFpW3hdJiYoaT15dChpLG8pKSxvdChmdW5jdGlvbihvLGEscyx1KXt2YXIgbCxjLHAsZj1bXSxkPVtdLGg9YS5sZW5ndGgsZz1vfHx4dCh0fHxcIipcIixzLm5vZGVUeXBlP1tzXTpzLFtdKSxtPSFlfHwhbyYmdD9nOm10KGcsZixlLHMsdSkseT1uP2l8fChvP2U6aHx8cik/W106YTptO2lmKG4mJm4obSx5LHMsdSkscil7bD1tdCh5LGQpLHIobCxbXSxzLHUpLGM9bC5sZW5ndGg7d2hpbGUoYy0tKShwPWxbY10pJiYoeVtkW2NdXT0hKG1bZFtjXV09cCkpfWlmKG8pe2lmKGl8fGUpe2lmKGkpe2w9W10sYz15Lmxlbmd0aDt3aGlsZShjLS0pKHA9eVtjXSkmJmwucHVzaChtW2NdPXApO2kobnVsbCx5PVtdLGwsdSl9Yz15Lmxlbmd0aDt3aGlsZShjLS0pKHA9eVtjXSkmJihsPWk/TS5jYWxsKG8scCk6ZltjXSk+LTEmJihvW2xdPSEoYVtsXT1wKSl9fWVsc2UgeT1tdCh5PT09YT95LnNwbGljZShoLHkubGVuZ3RoKTp5KSxpP2kobnVsbCxhLHksdSk6SC5hcHBseShhLHkpfSl9ZnVuY3Rpb24gdnQoZSl7dmFyIHQsbixyLG89ZS5sZW5ndGgsYT1pLnJlbGF0aXZlW2VbMF0udHlwZV0scz1hfHxpLnJlbGF0aXZlW1wiIFwiXSx1PWE/MTowLGM9aHQoZnVuY3Rpb24oZSl7cmV0dXJuIGU9PT10fSxzLCEwKSxwPWh0KGZ1bmN0aW9uKGUpe3JldHVybiBNLmNhbGwodCxlKT4tMX0scywhMCksZj1bZnVuY3Rpb24oZSxuLHIpe3JldHVybiFhJiYocnx8biE9PWwpfHwoKHQ9bikubm9kZVR5cGU/YyhlLG4scik6cChlLG4scikpfV07Zm9yKDtvPnU7dSsrKWlmKG49aS5yZWxhdGl2ZVtlW3VdLnR5cGVdKWY9W2h0KGd0KGYpLG4pXTtlbHNle2lmKG49aS5maWx0ZXJbZVt1XS50eXBlXS5hcHBseShudWxsLGVbdV0ubWF0Y2hlcyksblt4XSl7Zm9yKHI9Kyt1O28+cjtyKyspaWYoaS5yZWxhdGl2ZVtlW3JdLnR5cGVdKWJyZWFrO3JldHVybiB5dCh1PjEmJmd0KGYpLHU+MSYmZHQoZS5zbGljZSgwLHUtMSkpLnJlcGxhY2UoVyxcIiQxXCIpLG4scj51JiZ2dChlLnNsaWNlKHUscikpLG8+ciYmdnQoZT1lLnNsaWNlKHIpKSxvPnImJmR0KGUpKX1mLnB1c2gobil9cmV0dXJuIGd0KGYpfWZ1bmN0aW9uIGJ0KGUsdCl7dmFyIG49MCxvPXQubGVuZ3RoPjAsYT1lLmxlbmd0aD4wLHM9ZnVuY3Rpb24ocyx1LGMsZixkKXt2YXIgaCxnLG0seT1bXSx2PTAsYj1cIjBcIix4PXMmJltdLHc9bnVsbCE9ZCxUPWwsQz1zfHxhJiZpLmZpbmQuVEFHKFwiKlwiLGQmJnUucGFyZW50Tm9kZXx8dSksaz1OKz1udWxsPT1UPzE6TWF0aC5yYW5kb20oKXx8LjE7Zm9yKHcmJihsPXUhPT1wJiZ1LHI9bik7bnVsbCE9KGg9Q1tiXSk7YisrKXtpZihhJiZoKXtnPTA7d2hpbGUobT1lW2crK10paWYobShoLHUsYykpe2YucHVzaChoKTticmVha313JiYoTj1rLHI9KytuKX1vJiYoKGg9IW0mJmgpJiZ2LS0scyYmeC5wdXNoKGgpKX1pZih2Kz1iLG8mJmIhPT12KXtnPTA7d2hpbGUobT10W2crK10pbSh4LHksdSxjKTtpZihzKXtpZih2PjApd2hpbGUoYi0tKXhbYl18fHlbYl18fCh5W2JdPUwuY2FsbChmKSk7eT1tdCh5KX1ILmFwcGx5KGYseSksdyYmIXMmJnkubGVuZ3RoPjAmJnYrdC5sZW5ndGg+MSYmc3QudW5pcXVlU29ydChmKX1yZXR1cm4gdyYmKE49ayxsPVQpLHh9O3JldHVybiBvP290KHMpOnN9cz1zdC5jb21waWxlPWZ1bmN0aW9uKGUsdCl7dmFyIG4scj1bXSxpPVtdLG89U1tlK1wiIFwiXTtpZighbyl7dHx8KHQ9ZnQoZSkpLG49dC5sZW5ndGg7d2hpbGUobi0tKW89dnQodFtuXSksb1t4XT9yLnB1c2gobyk6aS5wdXNoKG8pO289UyhlLGJ0KGkscikpfXJldHVybiBvfTtmdW5jdGlvbiB4dChlLHQsbil7dmFyIHI9MCxpPXQubGVuZ3RoO2Zvcig7aT5yO3IrKylzdChlLHRbcl0sbik7cmV0dXJuIG59ZnVuY3Rpb24gd3QoZSx0LG4scil7dmFyIG8sYSx1LGwsYyxwPWZ0KGUpO2lmKCFyJiYxPT09cC5sZW5ndGgpe2lmKGE9cFswXT1wWzBdLnNsaWNlKDApLGEubGVuZ3RoPjImJlwiSURcIj09PSh1PWFbMF0pLnR5cGUmJjk9PT10Lm5vZGVUeXBlJiYhZCYmaS5yZWxhdGl2ZVthWzFdLnR5cGVdKXtpZih0PWkuZmluZC5JRCh1Lm1hdGNoZXNbMF0ucmVwbGFjZShldCx0dCksdClbMF0sIXQpcmV0dXJuIG47ZT1lLnNsaWNlKGEuc2hpZnQoKS52YWx1ZS5sZW5ndGgpfW89VS5uZWVkc0NvbnRleHQudGVzdChlKT8wOmEubGVuZ3RoO3doaWxlKG8tLSl7aWYodT1hW29dLGkucmVsYXRpdmVbbD11LnR5cGVdKWJyZWFrO2lmKChjPWkuZmluZFtsXSkmJihyPWModS5tYXRjaGVzWzBdLnJlcGxhY2UoZXQsdHQpLFYudGVzdChhWzBdLnR5cGUpJiZ0LnBhcmVudE5vZGV8fHQpKSl7aWYoYS5zcGxpY2UobywxKSxlPXIubGVuZ3RoJiZkdChhKSwhZSlyZXR1cm4gSC5hcHBseShuLHEuY2FsbChyLDApKSxuO2JyZWFrfX19cmV0dXJuIHMoZSxwKShyLHQsZCxuLFYudGVzdChlKSksbn1pLnBzZXVkb3MubnRoPWkucHNldWRvcy5lcTtmdW5jdGlvbiBUdCgpe31pLmZpbHRlcnM9VHQucHJvdG90eXBlPWkucHNldWRvcyxpLnNldEZpbHRlcnM9bmV3IFR0LGMoKSxzdC5hdHRyPWIuYXR0cixiLmZpbmQ9c3QsYi5leHByPXN0LnNlbGVjdG9ycyxiLmV4cHJbXCI6XCJdPWIuZXhwci5wc2V1ZG9zLGIudW5pcXVlPXN0LnVuaXF1ZVNvcnQsYi50ZXh0PXN0LmdldFRleHQsYi5pc1hNTERvYz1zdC5pc1hNTCxiLmNvbnRhaW5zPXN0LmNvbnRhaW5zfShlKTt2YXIgYXQ9L1VudGlsJC8sc3Q9L14oPzpwYXJlbnRzfHByZXYoPzpVbnRpbHxBbGwpKS8sdXQ9L14uW146I1xcW1xcLixdKiQvLGx0PWIuZXhwci5tYXRjaC5uZWVkc0NvbnRleHQsY3Q9e2NoaWxkcmVuOiEwLGNvbnRlbnRzOiEwLG5leHQ6ITAscHJldjohMH07Yi5mbi5leHRlbmQoe2ZpbmQ6ZnVuY3Rpb24oZSl7dmFyIHQsbixyLGk9dGhpcy5sZW5ndGg7aWYoXCJzdHJpbmdcIiE9dHlwZW9mIGUpcmV0dXJuIHI9dGhpcyx0aGlzLnB1c2hTdGFjayhiKGUpLmZpbHRlcihmdW5jdGlvbigpe2Zvcih0PTA7aT50O3QrKylpZihiLmNvbnRhaW5zKHJbdF0sdGhpcykpcmV0dXJuITB9KSk7Zm9yKG49W10sdD0wO2k+dDt0KyspYi5maW5kKGUsdGhpc1t0XSxuKTtyZXR1cm4gbj10aGlzLnB1c2hTdGFjayhpPjE/Yi51bmlxdWUobik6biksbi5zZWxlY3Rvcj0odGhpcy5zZWxlY3Rvcj90aGlzLnNlbGVjdG9yK1wiIFwiOlwiXCIpK2Usbn0saGFzOmZ1bmN0aW9uKGUpe3ZhciB0LG49YihlLHRoaXMpLHI9bi5sZW5ndGg7cmV0dXJuIHRoaXMuZmlsdGVyKGZ1bmN0aW9uKCl7Zm9yKHQ9MDtyPnQ7dCsrKWlmKGIuY29udGFpbnModGhpcyxuW3RdKSlyZXR1cm4hMH0pfSxub3Q6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMucHVzaFN0YWNrKGZ0KHRoaXMsZSwhMSkpfSxmaWx0ZXI6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMucHVzaFN0YWNrKGZ0KHRoaXMsZSwhMCkpfSxpczpmdW5jdGlvbihlKXtyZXR1cm4hIWUmJihcInN0cmluZ1wiPT10eXBlb2YgZT9sdC50ZXN0KGUpP2IoZSx0aGlzLmNvbnRleHQpLmluZGV4KHRoaXNbMF0pPj0wOmIuZmlsdGVyKGUsdGhpcykubGVuZ3RoPjA6dGhpcy5maWx0ZXIoZSkubGVuZ3RoPjApfSxjbG9zZXN0OmZ1bmN0aW9uKGUsdCl7dmFyIG4scj0wLGk9dGhpcy5sZW5ndGgsbz1bXSxhPWx0LnRlc3QoZSl8fFwic3RyaW5nXCIhPXR5cGVvZiBlP2IoZSx0fHx0aGlzLmNvbnRleHQpOjA7Zm9yKDtpPnI7cisrKXtuPXRoaXNbcl07d2hpbGUobiYmbi5vd25lckRvY3VtZW50JiZuIT09dCYmMTEhPT1uLm5vZGVUeXBlKXtpZihhP2EuaW5kZXgobik+LTE6Yi5maW5kLm1hdGNoZXNTZWxlY3RvcihuLGUpKXtvLnB1c2gobik7YnJlYWt9bj1uLnBhcmVudE5vZGV9fXJldHVybiB0aGlzLnB1c2hTdGFjayhvLmxlbmd0aD4xP2IudW5pcXVlKG8pOm8pfSxpbmRleDpmdW5jdGlvbihlKXtyZXR1cm4gZT9cInN0cmluZ1wiPT10eXBlb2YgZT9iLmluQXJyYXkodGhpc1swXSxiKGUpKTpiLmluQXJyYXkoZS5qcXVlcnk/ZVswXTplLHRoaXMpOnRoaXNbMF0mJnRoaXNbMF0ucGFyZW50Tm9kZT90aGlzLmZpcnN0KCkucHJldkFsbCgpLmxlbmd0aDotMX0sYWRkOmZ1bmN0aW9uKGUsdCl7dmFyIG49XCJzdHJpbmdcIj09dHlwZW9mIGU/YihlLHQpOmIubWFrZUFycmF5KGUmJmUubm9kZVR5cGU/W2VdOmUpLHI9Yi5tZXJnZSh0aGlzLmdldCgpLG4pO3JldHVybiB0aGlzLnB1c2hTdGFjayhiLnVuaXF1ZShyKSl9LGFkZEJhY2s6ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMuYWRkKG51bGw9PWU/dGhpcy5wcmV2T2JqZWN0OnRoaXMucHJldk9iamVjdC5maWx0ZXIoZSkpfX0pLGIuZm4uYW5kU2VsZj1iLmZuLmFkZEJhY2s7ZnVuY3Rpb24gcHQoZSx0KXtkbyBlPWVbdF07d2hpbGUoZSYmMSE9PWUubm9kZVR5cGUpO3JldHVybiBlfWIuZWFjaCh7cGFyZW50OmZ1bmN0aW9uKGUpe3ZhciB0PWUucGFyZW50Tm9kZTtyZXR1cm4gdCYmMTEhPT10Lm5vZGVUeXBlP3Q6bnVsbH0scGFyZW50czpmdW5jdGlvbihlKXtyZXR1cm4gYi5kaXIoZSxcInBhcmVudE5vZGVcIil9LHBhcmVudHNVbnRpbDpmdW5jdGlvbihlLHQsbil7cmV0dXJuIGIuZGlyKGUsXCJwYXJlbnROb2RlXCIsbil9LG5leHQ6ZnVuY3Rpb24oZSl7cmV0dXJuIHB0KGUsXCJuZXh0U2libGluZ1wiKX0scHJldjpmdW5jdGlvbihlKXtyZXR1cm4gcHQoZSxcInByZXZpb3VzU2libGluZ1wiKX0sbmV4dEFsbDpmdW5jdGlvbihlKXtyZXR1cm4gYi5kaXIoZSxcIm5leHRTaWJsaW5nXCIpfSxwcmV2QWxsOmZ1bmN0aW9uKGUpe3JldHVybiBiLmRpcihlLFwicHJldmlvdXNTaWJsaW5nXCIpfSxuZXh0VW50aWw6ZnVuY3Rpb24oZSx0LG4pe3JldHVybiBiLmRpcihlLFwibmV4dFNpYmxpbmdcIixuKX0scHJldlVudGlsOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gYi5kaXIoZSxcInByZXZpb3VzU2libGluZ1wiLG4pfSxzaWJsaW5nczpmdW5jdGlvbihlKXtyZXR1cm4gYi5zaWJsaW5nKChlLnBhcmVudE5vZGV8fHt9KS5maXJzdENoaWxkLGUpfSxjaGlsZHJlbjpmdW5jdGlvbihlKXtyZXR1cm4gYi5zaWJsaW5nKGUuZmlyc3RDaGlsZCl9LGNvbnRlbnRzOmZ1bmN0aW9uKGUpe3JldHVybiBiLm5vZGVOYW1lKGUsXCJpZnJhbWVcIik/ZS5jb250ZW50RG9jdW1lbnR8fGUuY29udGVudFdpbmRvdy5kb2N1bWVudDpiLm1lcmdlKFtdLGUuY2hpbGROb2Rlcyl9fSxmdW5jdGlvbihlLHQpe2IuZm5bZV09ZnVuY3Rpb24obixyKXt2YXIgaT1iLm1hcCh0aGlzLHQsbik7cmV0dXJuIGF0LnRlc3QoZSl8fChyPW4pLHImJlwic3RyaW5nXCI9PXR5cGVvZiByJiYoaT1iLmZpbHRlcihyLGkpKSxpPXRoaXMubGVuZ3RoPjEmJiFjdFtlXT9iLnVuaXF1ZShpKTppLHRoaXMubGVuZ3RoPjEmJnN0LnRlc3QoZSkmJihpPWkucmV2ZXJzZSgpKSx0aGlzLnB1c2hTdGFjayhpKX19KSxiLmV4dGVuZCh7ZmlsdGVyOmZ1bmN0aW9uKGUsdCxuKXtyZXR1cm4gbiYmKGU9XCI6bm90KFwiK2UrXCIpXCIpLDE9PT10Lmxlbmd0aD9iLmZpbmQubWF0Y2hlc1NlbGVjdG9yKHRbMF0sZSk/W3RbMF1dOltdOmIuZmluZC5tYXRjaGVzKGUsdCl9LGRpcjpmdW5jdGlvbihlLG4scil7dmFyIGk9W10sbz1lW25dO3doaWxlKG8mJjkhPT1vLm5vZGVUeXBlJiYocj09PXR8fDEhPT1vLm5vZGVUeXBlfHwhYihvKS5pcyhyKSkpMT09PW8ubm9kZVR5cGUmJmkucHVzaChvKSxvPW9bbl07cmV0dXJuIGl9LHNpYmxpbmc6ZnVuY3Rpb24oZSx0KXt2YXIgbj1bXTtmb3IoO2U7ZT1lLm5leHRTaWJsaW5nKTE9PT1lLm5vZGVUeXBlJiZlIT09dCYmbi5wdXNoKGUpO3JldHVybiBufX0pO2Z1bmN0aW9uIGZ0KGUsdCxuKXtpZih0PXR8fDAsYi5pc0Z1bmN0aW9uKHQpKXJldHVybiBiLmdyZXAoZSxmdW5jdGlvbihlLHIpe3ZhciBpPSEhdC5jYWxsKGUscixlKTtyZXR1cm4gaT09PW59KTtpZih0Lm5vZGVUeXBlKXJldHVybiBiLmdyZXAoZSxmdW5jdGlvbihlKXtyZXR1cm4gZT09PXQ9PT1ufSk7aWYoXCJzdHJpbmdcIj09dHlwZW9mIHQpe3ZhciByPWIuZ3JlcChlLGZ1bmN0aW9uKGUpe3JldHVybiAxPT09ZS5ub2RlVHlwZX0pO2lmKHV0LnRlc3QodCkpcmV0dXJuIGIuZmlsdGVyKHQsciwhbik7dD1iLmZpbHRlcih0LHIpfXJldHVybiBiLmdyZXAoZSxmdW5jdGlvbihlKXtyZXR1cm4gYi5pbkFycmF5KGUsdCk+PTA9PT1ufSl9ZnVuY3Rpb24gZHQoZSl7dmFyIHQ9aHQuc3BsaXQoXCJ8XCIpLG49ZS5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7aWYobi5jcmVhdGVFbGVtZW50KXdoaWxlKHQubGVuZ3RoKW4uY3JlYXRlRWxlbWVudCh0LnBvcCgpKTtyZXR1cm4gbn12YXIgaHQ9XCJhYmJyfGFydGljbGV8YXNpZGV8YXVkaW98YmRpfGNhbnZhc3xkYXRhfGRhdGFsaXN0fGRldGFpbHN8ZmlnY2FwdGlvbnxmaWd1cmV8Zm9vdGVyfGhlYWRlcnxoZ3JvdXB8bWFya3xtZXRlcnxuYXZ8b3V0cHV0fHByb2dyZXNzfHNlY3Rpb258c3VtbWFyeXx0aW1lfHZpZGVvXCIsZ3Q9LyBqUXVlcnlcXGQrPVwiKD86bnVsbHxcXGQrKVwiL2csbXQ9UmVnRXhwKFwiPCg/OlwiK2h0K1wiKVtcXFxccy8+XVwiLFwiaVwiKSx5dD0vXlxccysvLHZ0PS88KD8hYXJlYXxicnxjb2x8ZW1iZWR8aHJ8aW1nfGlucHV0fGxpbmt8bWV0YXxwYXJhbSkoKFtcXHc6XSspW14+XSopXFwvPi9naSxidD0vPChbXFx3Ol0rKS8seHQ9Lzx0Ym9keS9pLHd0PS88fCYjP1xcdys7LyxUdD0vPCg/OnNjcmlwdHxzdHlsZXxsaW5rKS9pLE50PS9eKD86Y2hlY2tib3h8cmFkaW8pJC9pLEN0PS9jaGVja2VkXFxzKig/OltePV18PVxccyouY2hlY2tlZC4pL2ksa3Q9L14kfFxcLyg/OmphdmF8ZWNtYSlzY3JpcHQvaSxFdD0vXnRydWVcXC8oLiopLyxTdD0vXlxccyo8ISg/OlxcW0NEQVRBXFxbfC0tKXwoPzpcXF1cXF18LS0pPlxccyokL2csQXQ9e29wdGlvbjpbMSxcIjxzZWxlY3QgbXVsdGlwbGU9J211bHRpcGxlJz5cIixcIjwvc2VsZWN0PlwiXSxsZWdlbmQ6WzEsXCI8ZmllbGRzZXQ+XCIsXCI8L2ZpZWxkc2V0PlwiXSxhcmVhOlsxLFwiPG1hcD5cIixcIjwvbWFwPlwiXSxwYXJhbTpbMSxcIjxvYmplY3Q+XCIsXCI8L29iamVjdD5cIl0sdGhlYWQ6WzEsXCI8dGFibGU+XCIsXCI8L3RhYmxlPlwiXSx0cjpbMixcIjx0YWJsZT48dGJvZHk+XCIsXCI8L3Rib2R5PjwvdGFibGU+XCJdLGNvbDpbMixcIjx0YWJsZT48dGJvZHk+PC90Ym9keT48Y29sZ3JvdXA+XCIsXCI8L2NvbGdyb3VwPjwvdGFibGU+XCJdLHRkOlszLFwiPHRhYmxlPjx0Ym9keT48dHI+XCIsXCI8L3RyPjwvdGJvZHk+PC90YWJsZT5cIl0sX2RlZmF1bHQ6Yi5zdXBwb3J0Lmh0bWxTZXJpYWxpemU/WzAsXCJcIixcIlwiXTpbMSxcIlg8ZGl2PlwiLFwiPC9kaXY+XCJdfSxqdD1kdChvKSxEdD1qdC5hcHBlbmRDaGlsZChvLmNyZWF0ZUVsZW1lbnQoXCJkaXZcIikpO0F0Lm9wdGdyb3VwPUF0Lm9wdGlvbixBdC50Ym9keT1BdC50Zm9vdD1BdC5jb2xncm91cD1BdC5jYXB0aW9uPUF0LnRoZWFkLEF0LnRoPUF0LnRkLGIuZm4uZXh0ZW5kKHt0ZXh0OmZ1bmN0aW9uKGUpe3JldHVybiBiLmFjY2Vzcyh0aGlzLGZ1bmN0aW9uKGUpe3JldHVybiBlPT09dD9iLnRleHQodGhpcyk6dGhpcy5lbXB0eSgpLmFwcGVuZCgodGhpc1swXSYmdGhpc1swXS5vd25lckRvY3VtZW50fHxvKS5jcmVhdGVUZXh0Tm9kZShlKSl9LG51bGwsZSxhcmd1bWVudHMubGVuZ3RoKX0sd3JhcEFsbDpmdW5jdGlvbihlKXtpZihiLmlzRnVuY3Rpb24oZSkpcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbih0KXtiKHRoaXMpLndyYXBBbGwoZS5jYWxsKHRoaXMsdCkpfSk7aWYodGhpc1swXSl7dmFyIHQ9YihlLHRoaXNbMF0ub3duZXJEb2N1bWVudCkuZXEoMCkuY2xvbmUoITApO3RoaXNbMF0ucGFyZW50Tm9kZSYmdC5pbnNlcnRCZWZvcmUodGhpc1swXSksdC5tYXAoZnVuY3Rpb24oKXt2YXIgZT10aGlzO3doaWxlKGUuZmlyc3RDaGlsZCYmMT09PWUuZmlyc3RDaGlsZC5ub2RlVHlwZSllPWUuZmlyc3RDaGlsZDtyZXR1cm4gZX0pLmFwcGVuZCh0aGlzKX1yZXR1cm4gdGhpc30sd3JhcElubmVyOmZ1bmN0aW9uKGUpe3JldHVybiBiLmlzRnVuY3Rpb24oZSk/dGhpcy5lYWNoKGZ1bmN0aW9uKHQpe2IodGhpcykud3JhcElubmVyKGUuY2FsbCh0aGlzLHQpKX0pOnRoaXMuZWFjaChmdW5jdGlvbigpe3ZhciB0PWIodGhpcyksbj10LmNvbnRlbnRzKCk7bi5sZW5ndGg/bi53cmFwQWxsKGUpOnQuYXBwZW5kKGUpfSl9LHdyYXA6ZnVuY3Rpb24oZSl7dmFyIHQ9Yi5pc0Z1bmN0aW9uKGUpO3JldHVybiB0aGlzLmVhY2goZnVuY3Rpb24obil7Yih0aGlzKS53cmFwQWxsKHQ/ZS5jYWxsKHRoaXMsbik6ZSl9KX0sdW53cmFwOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMucGFyZW50KCkuZWFjaChmdW5jdGlvbigpe2Iubm9kZU5hbWUodGhpcyxcImJvZHlcIil8fGIodGhpcykucmVwbGFjZVdpdGgodGhpcy5jaGlsZE5vZGVzKX0pLmVuZCgpfSxhcHBlbmQ6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kb21NYW5pcChhcmd1bWVudHMsITAsZnVuY3Rpb24oZSl7KDE9PT10aGlzLm5vZGVUeXBlfHwxMT09PXRoaXMubm9kZVR5cGV8fDk9PT10aGlzLm5vZGVUeXBlKSYmdGhpcy5hcHBlbmRDaGlsZChlKX0pfSxwcmVwZW5kOmZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMuZG9tTWFuaXAoYXJndW1lbnRzLCEwLGZ1bmN0aW9uKGUpeygxPT09dGhpcy5ub2RlVHlwZXx8MTE9PT10aGlzLm5vZGVUeXBlfHw5PT09dGhpcy5ub2RlVHlwZSkmJnRoaXMuaW5zZXJ0QmVmb3JlKGUsdGhpcy5maXJzdENoaWxkKX0pfSxiZWZvcmU6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kb21NYW5pcChhcmd1bWVudHMsITEsZnVuY3Rpb24oZSl7dGhpcy5wYXJlbnROb2RlJiZ0aGlzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGUsdGhpcyl9KX0sYWZ0ZXI6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5kb21NYW5pcChhcmd1bWVudHMsITEsZnVuY3Rpb24oZSl7dGhpcy5wYXJlbnROb2RlJiZ0aGlzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGUsdGhpcy5uZXh0U2libGluZyl9KX0scmVtb3ZlOmZ1bmN0aW9uKGUsdCl7dmFyIG4scj0wO2Zvcig7bnVsbCE9KG49dGhpc1tyXSk7cisrKSghZXx8Yi5maWx0ZXIoZSxbbl0pLmxlbmd0aD4wKSYmKHR8fDEhPT1uLm5vZGVUeXBlfHxiLmNsZWFuRGF0YShPdChuKSksbi5wYXJlbnROb2RlJiYodCYmYi5jb250YWlucyhuLm93bmVyRG9jdW1lbnQsbikmJk10KE90KG4sXCJzY3JpcHRcIikpLG4ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChuKSkpO3JldHVybiB0aGlzfSxlbXB0eTpmdW5jdGlvbigpe3ZhciBlLHQ9MDtmb3IoO251bGwhPShlPXRoaXNbdF0pO3QrKyl7MT09PWUubm9kZVR5cGUmJmIuY2xlYW5EYXRhKE90KGUsITEpKTt3aGlsZShlLmZpcnN0Q2hpbGQpZS5yZW1vdmVDaGlsZChlLmZpcnN0Q2hpbGQpO2Uub3B0aW9ucyYmYi5ub2RlTmFtZShlLFwic2VsZWN0XCIpJiYoZS5vcHRpb25zLmxlbmd0aD0wKX1yZXR1cm4gdGhpc30sY2xvbmU6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZT1udWxsPT1lPyExOmUsdD1udWxsPT10P2U6dCx0aGlzLm1hcChmdW5jdGlvbigpe3JldHVybiBiLmNsb25lKHRoaXMsZSx0KX0pfSxodG1sOmZ1bmN0aW9uKGUpe3JldHVybiBiLmFjY2Vzcyh0aGlzLGZ1bmN0aW9uKGUpe3ZhciBuPXRoaXNbMF18fHt9LHI9MCxpPXRoaXMubGVuZ3RoO2lmKGU9PT10KXJldHVybiAxPT09bi5ub2RlVHlwZT9uLmlubmVySFRNTC5yZXBsYWNlKGd0LFwiXCIpOnQ7aWYoIShcInN0cmluZ1wiIT10eXBlb2YgZXx8VHQudGVzdChlKXx8IWIuc3VwcG9ydC5odG1sU2VyaWFsaXplJiZtdC50ZXN0KGUpfHwhYi5zdXBwb3J0LmxlYWRpbmdXaGl0ZXNwYWNlJiZ5dC50ZXN0KGUpfHxBdFsoYnQuZXhlYyhlKXx8W1wiXCIsXCJcIl0pWzFdLnRvTG93ZXJDYXNlKCldKSl7ZT1lLnJlcGxhY2UodnQsXCI8JDE+PC8kMj5cIik7dHJ5e2Zvcig7aT5yO3IrKyluPXRoaXNbcl18fHt9LDE9PT1uLm5vZGVUeXBlJiYoYi5jbGVhbkRhdGEoT3QobiwhMSkpLG4uaW5uZXJIVE1MPWUpO249MH1jYXRjaChvKXt9fW4mJnRoaXMuZW1wdHkoKS5hcHBlbmQoZSl9LG51bGwsZSxhcmd1bWVudHMubGVuZ3RoKX0scmVwbGFjZVdpdGg6ZnVuY3Rpb24oZSl7dmFyIHQ9Yi5pc0Z1bmN0aW9uKGUpO3JldHVybiB0fHxcInN0cmluZ1wiPT10eXBlb2YgZXx8KGU9YihlKS5ub3QodGhpcykuZGV0YWNoKCkpLHRoaXMuZG9tTWFuaXAoW2VdLCEwLGZ1bmN0aW9uKGUpe3ZhciB0PXRoaXMubmV4dFNpYmxpbmcsbj10aGlzLnBhcmVudE5vZGU7biYmKGIodGhpcykucmVtb3ZlKCksbi5pbnNlcnRCZWZvcmUoZSx0KSl9KX0sZGV0YWNoOmZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLnJlbW92ZShlLCEwKX0sZG9tTWFuaXA6ZnVuY3Rpb24oZSxuLHIpe2U9Zi5hcHBseShbXSxlKTt2YXIgaSxvLGEscyx1LGwsYz0wLHA9dGhpcy5sZW5ndGgsZD10aGlzLGg9cC0xLGc9ZVswXSxtPWIuaXNGdW5jdGlvbihnKTtpZihtfHwhKDE+PXB8fFwic3RyaW5nXCIhPXR5cGVvZiBnfHxiLnN1cHBvcnQuY2hlY2tDbG9uZSkmJkN0LnRlc3QoZykpcmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbihpKXt2YXIgbz1kLmVxKGkpO20mJihlWzBdPWcuY2FsbCh0aGlzLGksbj9vLmh0bWwoKTp0KSksby5kb21NYW5pcChlLG4scil9KTtpZihwJiYobD1iLmJ1aWxkRnJhZ21lbnQoZSx0aGlzWzBdLm93bmVyRG9jdW1lbnQsITEsdGhpcyksaT1sLmZpcnN0Q2hpbGQsMT09PWwuY2hpbGROb2Rlcy5sZW5ndGgmJihsPWkpLGkpKXtmb3Iobj1uJiZiLm5vZGVOYW1lKGksXCJ0clwiKSxzPWIubWFwKE90KGwsXCJzY3JpcHRcIiksSHQpLGE9cy5sZW5ndGg7cD5jO2MrKylvPWwsYyE9PWgmJihvPWIuY2xvbmUobywhMCwhMCksYSYmYi5tZXJnZShzLE90KG8sXCJzY3JpcHRcIikpKSxyLmNhbGwobiYmYi5ub2RlTmFtZSh0aGlzW2NdLFwidGFibGVcIik/THQodGhpc1tjXSxcInRib2R5XCIpOnRoaXNbY10sbyxjKTtpZihhKWZvcih1PXNbcy5sZW5ndGgtMV0ub3duZXJEb2N1bWVudCxiLm1hcChzLHF0KSxjPTA7YT5jO2MrKylvPXNbY10sa3QudGVzdChvLnR5cGV8fFwiXCIpJiYhYi5fZGF0YShvLFwiZ2xvYmFsRXZhbFwiKSYmYi5jb250YWlucyh1LG8pJiYoby5zcmM/Yi5hamF4KHt1cmw6by5zcmMsdHlwZTpcIkdFVFwiLGRhdGFUeXBlOlwic2NyaXB0XCIsYXN5bmM6ITEsZ2xvYmFsOiExLFwidGhyb3dzXCI6ITB9KTpiLmdsb2JhbEV2YWwoKG8udGV4dHx8by50ZXh0Q29udGVudHx8by5pbm5lckhUTUx8fFwiXCIpLnJlcGxhY2UoU3QsXCJcIikpKTtsPWk9bnVsbH1yZXR1cm4gdGhpc319KTtmdW5jdGlvbiBMdChlLHQpe3JldHVybiBlLmdldEVsZW1lbnRzQnlUYWdOYW1lKHQpWzBdfHxlLmFwcGVuZENoaWxkKGUub3duZXJEb2N1bWVudC5jcmVhdGVFbGVtZW50KHQpKX1mdW5jdGlvbiBIdChlKXt2YXIgdD1lLmdldEF0dHJpYnV0ZU5vZGUoXCJ0eXBlXCIpO3JldHVybiBlLnR5cGU9KHQmJnQuc3BlY2lmaWVkKStcIi9cIitlLnR5cGUsZX1mdW5jdGlvbiBxdChlKXt2YXIgdD1FdC5leGVjKGUudHlwZSk7cmV0dXJuIHQ/ZS50eXBlPXRbMV06ZS5yZW1vdmVBdHRyaWJ1dGUoXCJ0eXBlXCIpLGV9ZnVuY3Rpb24gTXQoZSx0KXt2YXIgbixyPTA7Zm9yKDtudWxsIT0obj1lW3JdKTtyKyspYi5fZGF0YShuLFwiZ2xvYmFsRXZhbFwiLCF0fHxiLl9kYXRhKHRbcl0sXCJnbG9iYWxFdmFsXCIpKX1mdW5jdGlvbiBfdChlLHQpe2lmKDE9PT10Lm5vZGVUeXBlJiZiLmhhc0RhdGEoZSkpe3ZhciBuLHIsaSxvPWIuX2RhdGEoZSksYT1iLl9kYXRhKHQsbykscz1vLmV2ZW50cztpZihzKXtkZWxldGUgYS5oYW5kbGUsYS5ldmVudHM9e307Zm9yKG4gaW4gcylmb3Iocj0wLGk9c1tuXS5sZW5ndGg7aT5yO3IrKyliLmV2ZW50LmFkZCh0LG4sc1tuXVtyXSl9YS5kYXRhJiYoYS5kYXRhPWIuZXh0ZW5kKHt9LGEuZGF0YSkpfX1mdW5jdGlvbiBGdChlLHQpe3ZhciBuLHIsaTtpZigxPT09dC5ub2RlVHlwZSl7aWYobj10Lm5vZGVOYW1lLnRvTG93ZXJDYXNlKCksIWIuc3VwcG9ydC5ub0Nsb25lRXZlbnQmJnRbYi5leHBhbmRvXSl7aT1iLl9kYXRhKHQpO2ZvcihyIGluIGkuZXZlbnRzKWIucmVtb3ZlRXZlbnQodCxyLGkuaGFuZGxlKTt0LnJlbW92ZUF0dHJpYnV0ZShiLmV4cGFuZG8pfVwic2NyaXB0XCI9PT1uJiZ0LnRleHQhPT1lLnRleHQ/KEh0KHQpLnRleHQ9ZS50ZXh0LHF0KHQpKTpcIm9iamVjdFwiPT09bj8odC5wYXJlbnROb2RlJiYodC5vdXRlckhUTUw9ZS5vdXRlckhUTUwpLGIuc3VwcG9ydC5odG1sNUNsb25lJiZlLmlubmVySFRNTCYmIWIudHJpbSh0LmlubmVySFRNTCkmJih0LmlubmVySFRNTD1lLmlubmVySFRNTCkpOlwiaW5wdXRcIj09PW4mJk50LnRlc3QoZS50eXBlKT8odC5kZWZhdWx0Q2hlY2tlZD10LmNoZWNrZWQ9ZS5jaGVja2VkLHQudmFsdWUhPT1lLnZhbHVlJiYodC52YWx1ZT1lLnZhbHVlKSk6XCJvcHRpb25cIj09PW4/dC5kZWZhdWx0U2VsZWN0ZWQ9dC5zZWxlY3RlZD1lLmRlZmF1bHRTZWxlY3RlZDooXCJpbnB1dFwiPT09bnx8XCJ0ZXh0YXJlYVwiPT09bikmJih0LmRlZmF1bHRWYWx1ZT1lLmRlZmF1bHRWYWx1ZSl9fWIuZWFjaCh7YXBwZW5kVG86XCJhcHBlbmRcIixwcmVwZW5kVG86XCJwcmVwZW5kXCIsaW5zZXJ0QmVmb3JlOlwiYmVmb3JlXCIsaW5zZXJ0QWZ0ZXI6XCJhZnRlclwiLHJlcGxhY2VBbGw6XCJyZXBsYWNlV2l0aFwifSxmdW5jdGlvbihlLHQpe2IuZm5bZV09ZnVuY3Rpb24oZSl7dmFyIG4scj0wLGk9W10sbz1iKGUpLGE9by5sZW5ndGgtMTtmb3IoO2E+PXI7cisrKW49cj09PWE/dGhpczp0aGlzLmNsb25lKCEwKSxiKG9bcl0pW3RdKG4pLGQuYXBwbHkoaSxuLmdldCgpKTtyZXR1cm4gdGhpcy5wdXNoU3RhY2soaSl9fSk7ZnVuY3Rpb24gT3QoZSxuKXt2YXIgcixvLGE9MCxzPXR5cGVvZiBlLmdldEVsZW1lbnRzQnlUYWdOYW1lIT09aT9lLmdldEVsZW1lbnRzQnlUYWdOYW1lKG58fFwiKlwiKTp0eXBlb2YgZS5xdWVyeVNlbGVjdG9yQWxsIT09aT9lLnF1ZXJ5U2VsZWN0b3JBbGwobnx8XCIqXCIpOnQ7aWYoIXMpZm9yKHM9W10scj1lLmNoaWxkTm9kZXN8fGU7bnVsbCE9KG89clthXSk7YSsrKSFufHxiLm5vZGVOYW1lKG8sbik/cy5wdXNoKG8pOmIubWVyZ2UocyxPdChvLG4pKTtyZXR1cm4gbj09PXR8fG4mJmIubm9kZU5hbWUoZSxuKT9iLm1lcmdlKFtlXSxzKTpzfWZ1bmN0aW9uIEJ0KGUpe050LnRlc3QoZS50eXBlKSYmKGUuZGVmYXVsdENoZWNrZWQ9ZS5jaGVja2VkKX1iLmV4dGVuZCh7Y2xvbmU6ZnVuY3Rpb24oZSx0LG4pe3ZhciByLGksbyxhLHMsdT1iLmNvbnRhaW5zKGUub3duZXJEb2N1bWVudCxlKTtpZihiLnN1cHBvcnQuaHRtbDVDbG9uZXx8Yi5pc1hNTERvYyhlKXx8IW10LnRlc3QoXCI8XCIrZS5ub2RlTmFtZStcIj5cIik/bz1lLmNsb25lTm9kZSghMCk6KER0LmlubmVySFRNTD1lLm91dGVySFRNTCxEdC5yZW1vdmVDaGlsZChvPUR0LmZpcnN0Q2hpbGQpKSwhKGIuc3VwcG9ydC5ub0Nsb25lRXZlbnQmJmIuc3VwcG9ydC5ub0Nsb25lQ2hlY2tlZHx8MSE9PWUubm9kZVR5cGUmJjExIT09ZS5ub2RlVHlwZXx8Yi5pc1hNTERvYyhlKSkpZm9yKHI9T3Qobykscz1PdChlKSxhPTA7bnVsbCE9KGk9c1thXSk7KythKXJbYV0mJkZ0KGksclthXSk7aWYodClpZihuKWZvcihzPXN8fE90KGUpLHI9cnx8T3QobyksYT0wO251bGwhPShpPXNbYV0pO2ErKylfdChpLHJbYV0pO2Vsc2UgX3QoZSxvKTtyZXR1cm4gcj1PdChvLFwic2NyaXB0XCIpLHIubGVuZ3RoPjAmJk10KHIsIXUmJk90KGUsXCJzY3JpcHRcIikpLHI9cz1pPW51bGwsb30sYnVpbGRGcmFnbWVudDpmdW5jdGlvbihlLHQsbixyKXt2YXIgaSxvLGEscyx1LGwsYyxwPWUubGVuZ3RoLGY9ZHQodCksZD1bXSxoPTA7Zm9yKDtwPmg7aCsrKWlmKG89ZVtoXSxvfHwwPT09bylpZihcIm9iamVjdFwiPT09Yi50eXBlKG8pKWIubWVyZ2UoZCxvLm5vZGVUeXBlP1tvXTpvKTtlbHNlIGlmKHd0LnRlc3Qobykpe3M9c3x8Zi5hcHBlbmRDaGlsZCh0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIikpLHU9KGJ0LmV4ZWMobyl8fFtcIlwiLFwiXCJdKVsxXS50b0xvd2VyQ2FzZSgpLGM9QXRbdV18fEF0Ll9kZWZhdWx0LHMuaW5uZXJIVE1MPWNbMV0rby5yZXBsYWNlKHZ0LFwiPCQxPjwvJDI+XCIpK2NbMl0saT1jWzBdO3doaWxlKGktLSlzPXMubGFzdENoaWxkO2lmKCFiLnN1cHBvcnQubGVhZGluZ1doaXRlc3BhY2UmJnl0LnRlc3QobykmJmQucHVzaCh0LmNyZWF0ZVRleHROb2RlKHl0LmV4ZWMobylbMF0pKSwhYi5zdXBwb3J0LnRib2R5KXtvPVwidGFibGVcIiE9PXV8fHh0LnRlc3Qobyk/XCI8dGFibGU+XCIhPT1jWzFdfHx4dC50ZXN0KG8pPzA6czpzLmZpcnN0Q2hpbGQsaT1vJiZvLmNoaWxkTm9kZXMubGVuZ3RoO3doaWxlKGktLSliLm5vZGVOYW1lKGw9by5jaGlsZE5vZGVzW2ldLFwidGJvZHlcIikmJiFsLmNoaWxkTm9kZXMubGVuZ3RoJiZvLnJlbW92ZUNoaWxkKGwpXG59Yi5tZXJnZShkLHMuY2hpbGROb2Rlcykscy50ZXh0Q29udGVudD1cIlwiO3doaWxlKHMuZmlyc3RDaGlsZClzLnJlbW92ZUNoaWxkKHMuZmlyc3RDaGlsZCk7cz1mLmxhc3RDaGlsZH1lbHNlIGQucHVzaCh0LmNyZWF0ZVRleHROb2RlKG8pKTtzJiZmLnJlbW92ZUNoaWxkKHMpLGIuc3VwcG9ydC5hcHBlbmRDaGVja2VkfHxiLmdyZXAoT3QoZCxcImlucHV0XCIpLEJ0KSxoPTA7d2hpbGUobz1kW2grK10paWYoKCFyfHwtMT09PWIuaW5BcnJheShvLHIpKSYmKGE9Yi5jb250YWlucyhvLm93bmVyRG9jdW1lbnQsbykscz1PdChmLmFwcGVuZENoaWxkKG8pLFwic2NyaXB0XCIpLGEmJk10KHMpLG4pKXtpPTA7d2hpbGUobz1zW2krK10pa3QudGVzdChvLnR5cGV8fFwiXCIpJiZuLnB1c2gobyl9cmV0dXJuIHM9bnVsbCxmfSxjbGVhbkRhdGE6ZnVuY3Rpb24oZSx0KXt2YXIgbixyLG8sYSxzPTAsdT1iLmV4cGFuZG8sbD1iLmNhY2hlLHA9Yi5zdXBwb3J0LmRlbGV0ZUV4cGFuZG8sZj1iLmV2ZW50LnNwZWNpYWw7Zm9yKDtudWxsIT0obj1lW3NdKTtzKyspaWYoKHR8fGIuYWNjZXB0RGF0YShuKSkmJihvPW5bdV0sYT1vJiZsW29dKSl7aWYoYS5ldmVudHMpZm9yKHIgaW4gYS5ldmVudHMpZltyXT9iLmV2ZW50LnJlbW92ZShuLHIpOmIucmVtb3ZlRXZlbnQobixyLGEuaGFuZGxlKTtsW29dJiYoZGVsZXRlIGxbb10scD9kZWxldGUgblt1XTp0eXBlb2Ygbi5yZW1vdmVBdHRyaWJ1dGUhPT1pP24ucmVtb3ZlQXR0cmlidXRlKHUpOm5bdV09bnVsbCxjLnB1c2gobykpfX19KTt2YXIgUHQsUnQsV3QsJHQ9L2FscGhhXFwoW14pXSpcXCkvaSxJdD0vb3BhY2l0eVxccyo9XFxzKihbXildKikvLHp0PS9eKHRvcHxyaWdodHxib3R0b218bGVmdCkkLyxYdD0vXihub25lfHRhYmxlKD8hLWNbZWFdKS4rKS8sVXQ9L15tYXJnaW4vLFZ0PVJlZ0V4cChcIl4oXCIreCtcIikoLiopJFwiLFwiaVwiKSxZdD1SZWdFeHAoXCJeKFwiK3grXCIpKD8hcHgpW2EteiVdKyRcIixcImlcIiksSnQ9UmVnRXhwKFwiXihbKy1dKT0oXCIreCtcIilcIixcImlcIiksR3Q9e0JPRFk6XCJibG9ja1wifSxRdD17cG9zaXRpb246XCJhYnNvbHV0ZVwiLHZpc2liaWxpdHk6XCJoaWRkZW5cIixkaXNwbGF5OlwiYmxvY2tcIn0sS3Q9e2xldHRlclNwYWNpbmc6MCxmb250V2VpZ2h0OjQwMH0sWnQ9W1wiVG9wXCIsXCJSaWdodFwiLFwiQm90dG9tXCIsXCJMZWZ0XCJdLGVuPVtcIldlYmtpdFwiLFwiT1wiLFwiTW96XCIsXCJtc1wiXTtmdW5jdGlvbiB0bihlLHQpe2lmKHQgaW4gZSlyZXR1cm4gdDt2YXIgbj10LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpK3Quc2xpY2UoMSkscj10LGk9ZW4ubGVuZ3RoO3doaWxlKGktLSlpZih0PWVuW2ldK24sdCBpbiBlKXJldHVybiB0O3JldHVybiByfWZ1bmN0aW9uIG5uKGUsdCl7cmV0dXJuIGU9dHx8ZSxcIm5vbmVcIj09PWIuY3NzKGUsXCJkaXNwbGF5XCIpfHwhYi5jb250YWlucyhlLm93bmVyRG9jdW1lbnQsZSl9ZnVuY3Rpb24gcm4oZSx0KXt2YXIgbixyLGksbz1bXSxhPTAscz1lLmxlbmd0aDtmb3IoO3M+YTthKyspcj1lW2FdLHIuc3R5bGUmJihvW2FdPWIuX2RhdGEocixcIm9sZGRpc3BsYXlcIiksbj1yLnN0eWxlLmRpc3BsYXksdD8ob1thXXx8XCJub25lXCIhPT1ufHwoci5zdHlsZS5kaXNwbGF5PVwiXCIpLFwiXCI9PT1yLnN0eWxlLmRpc3BsYXkmJm5uKHIpJiYob1thXT1iLl9kYXRhKHIsXCJvbGRkaXNwbGF5XCIsdW4oci5ub2RlTmFtZSkpKSk6b1thXXx8KGk9bm4ociksKG4mJlwibm9uZVwiIT09bnx8IWkpJiZiLl9kYXRhKHIsXCJvbGRkaXNwbGF5XCIsaT9uOmIuY3NzKHIsXCJkaXNwbGF5XCIpKSkpO2ZvcihhPTA7cz5hO2ErKylyPWVbYV0sci5zdHlsZSYmKHQmJlwibm9uZVwiIT09ci5zdHlsZS5kaXNwbGF5JiZcIlwiIT09ci5zdHlsZS5kaXNwbGF5fHwoci5zdHlsZS5kaXNwbGF5PXQ/b1thXXx8XCJcIjpcIm5vbmVcIikpO3JldHVybiBlfWIuZm4uZXh0ZW5kKHtjc3M6ZnVuY3Rpb24oZSxuKXtyZXR1cm4gYi5hY2Nlc3ModGhpcyxmdW5jdGlvbihlLG4scil7dmFyIGksbyxhPXt9LHM9MDtpZihiLmlzQXJyYXkobikpe2ZvcihvPVJ0KGUpLGk9bi5sZW5ndGg7aT5zO3MrKylhW25bc11dPWIuY3NzKGUsbltzXSwhMSxvKTtyZXR1cm4gYX1yZXR1cm4gciE9PXQ/Yi5zdHlsZShlLG4scik6Yi5jc3MoZSxuKX0sZSxuLGFyZ3VtZW50cy5sZW5ndGg+MSl9LHNob3c6ZnVuY3Rpb24oKXtyZXR1cm4gcm4odGhpcywhMCl9LGhpZGU6ZnVuY3Rpb24oKXtyZXR1cm4gcm4odGhpcyl9LHRvZ2dsZTpmdW5jdGlvbihlKXt2YXIgdD1cImJvb2xlYW5cIj09dHlwZW9mIGU7cmV0dXJuIHRoaXMuZWFjaChmdW5jdGlvbigpeyh0P2U6bm4odGhpcykpP2IodGhpcykuc2hvdygpOmIodGhpcykuaGlkZSgpfSl9fSksYi5leHRlbmQoe2Nzc0hvb2tzOntvcGFjaXR5OntnZXQ6ZnVuY3Rpb24oZSx0KXtpZih0KXt2YXIgbj1XdChlLFwib3BhY2l0eVwiKTtyZXR1cm5cIlwiPT09bj9cIjFcIjpufX19fSxjc3NOdW1iZXI6e2NvbHVtbkNvdW50OiEwLGZpbGxPcGFjaXR5OiEwLGZvbnRXZWlnaHQ6ITAsbGluZUhlaWdodDohMCxvcGFjaXR5OiEwLG9ycGhhbnM6ITAsd2lkb3dzOiEwLHpJbmRleDohMCx6b29tOiEwfSxjc3NQcm9wczp7XCJmbG9hdFwiOmIuc3VwcG9ydC5jc3NGbG9hdD9cImNzc0Zsb2F0XCI6XCJzdHlsZUZsb2F0XCJ9LHN0eWxlOmZ1bmN0aW9uKGUsbixyLGkpe2lmKGUmJjMhPT1lLm5vZGVUeXBlJiY4IT09ZS5ub2RlVHlwZSYmZS5zdHlsZSl7dmFyIG8sYSxzLHU9Yi5jYW1lbENhc2UobiksbD1lLnN0eWxlO2lmKG49Yi5jc3NQcm9wc1t1XXx8KGIuY3NzUHJvcHNbdV09dG4obCx1KSkscz1iLmNzc0hvb2tzW25dfHxiLmNzc0hvb2tzW3VdLHI9PT10KXJldHVybiBzJiZcImdldFwiaW4gcyYmKG89cy5nZXQoZSwhMSxpKSkhPT10P286bFtuXTtpZihhPXR5cGVvZiByLFwic3RyaW5nXCI9PT1hJiYobz1KdC5leGVjKHIpKSYmKHI9KG9bMV0rMSkqb1syXStwYXJzZUZsb2F0KGIuY3NzKGUsbikpLGE9XCJudW1iZXJcIiksIShudWxsPT1yfHxcIm51bWJlclwiPT09YSYmaXNOYU4ocil8fChcIm51bWJlclwiIT09YXx8Yi5jc3NOdW1iZXJbdV18fChyKz1cInB4XCIpLGIuc3VwcG9ydC5jbGVhckNsb25lU3R5bGV8fFwiXCIhPT1yfHwwIT09bi5pbmRleE9mKFwiYmFja2dyb3VuZFwiKXx8KGxbbl09XCJpbmhlcml0XCIpLHMmJlwic2V0XCJpbiBzJiYocj1zLnNldChlLHIsaSkpPT09dCkpKXRyeXtsW25dPXJ9Y2F0Y2goYyl7fX19LGNzczpmdW5jdGlvbihlLG4scixpKXt2YXIgbyxhLHMsdT1iLmNhbWVsQ2FzZShuKTtyZXR1cm4gbj1iLmNzc1Byb3BzW3VdfHwoYi5jc3NQcm9wc1t1XT10bihlLnN0eWxlLHUpKSxzPWIuY3NzSG9va3Nbbl18fGIuY3NzSG9va3NbdV0scyYmXCJnZXRcImluIHMmJihhPXMuZ2V0KGUsITAscikpLGE9PT10JiYoYT1XdChlLG4saSkpLFwibm9ybWFsXCI9PT1hJiZuIGluIEt0JiYoYT1LdFtuXSksXCJcIj09PXJ8fHI/KG89cGFyc2VGbG9hdChhKSxyPT09ITB8fGIuaXNOdW1lcmljKG8pP298fDA6YSk6YX0sc3dhcDpmdW5jdGlvbihlLHQsbixyKXt2YXIgaSxvLGE9e307Zm9yKG8gaW4gdClhW29dPWUuc3R5bGVbb10sZS5zdHlsZVtvXT10W29dO2k9bi5hcHBseShlLHJ8fFtdKTtmb3IobyBpbiB0KWUuc3R5bGVbb109YVtvXTtyZXR1cm4gaX19KSxlLmdldENvbXB1dGVkU3R5bGU/KFJ0PWZ1bmN0aW9uKHQpe3JldHVybiBlLmdldENvbXB1dGVkU3R5bGUodCxudWxsKX0sV3Q9ZnVuY3Rpb24oZSxuLHIpe3ZhciBpLG8sYSxzPXJ8fFJ0KGUpLHU9cz9zLmdldFByb3BlcnR5VmFsdWUobil8fHNbbl06dCxsPWUuc3R5bGU7cmV0dXJuIHMmJihcIlwiIT09dXx8Yi5jb250YWlucyhlLm93bmVyRG9jdW1lbnQsZSl8fCh1PWIuc3R5bGUoZSxuKSksWXQudGVzdCh1KSYmVXQudGVzdChuKSYmKGk9bC53aWR0aCxvPWwubWluV2lkdGgsYT1sLm1heFdpZHRoLGwubWluV2lkdGg9bC5tYXhXaWR0aD1sLndpZHRoPXUsdT1zLndpZHRoLGwud2lkdGg9aSxsLm1pbldpZHRoPW8sbC5tYXhXaWR0aD1hKSksdX0pOm8uZG9jdW1lbnRFbGVtZW50LmN1cnJlbnRTdHlsZSYmKFJ0PWZ1bmN0aW9uKGUpe3JldHVybiBlLmN1cnJlbnRTdHlsZX0sV3Q9ZnVuY3Rpb24oZSxuLHIpe3ZhciBpLG8sYSxzPXJ8fFJ0KGUpLHU9cz9zW25dOnQsbD1lLnN0eWxlO3JldHVybiBudWxsPT11JiZsJiZsW25dJiYodT1sW25dKSxZdC50ZXN0KHUpJiYhenQudGVzdChuKSYmKGk9bC5sZWZ0LG89ZS5ydW50aW1lU3R5bGUsYT1vJiZvLmxlZnQsYSYmKG8ubGVmdD1lLmN1cnJlbnRTdHlsZS5sZWZ0KSxsLmxlZnQ9XCJmb250U2l6ZVwiPT09bj9cIjFlbVwiOnUsdT1sLnBpeGVsTGVmdCtcInB4XCIsbC5sZWZ0PWksYSYmKG8ubGVmdD1hKSksXCJcIj09PXU/XCJhdXRvXCI6dX0pO2Z1bmN0aW9uIG9uKGUsdCxuKXt2YXIgcj1WdC5leGVjKHQpO3JldHVybiByP01hdGgubWF4KDAsclsxXS0obnx8MCkpKyhyWzJdfHxcInB4XCIpOnR9ZnVuY3Rpb24gYW4oZSx0LG4scixpKXt2YXIgbz1uPT09KHI/XCJib3JkZXJcIjpcImNvbnRlbnRcIik/NDpcIndpZHRoXCI9PT10PzE6MCxhPTA7Zm9yKDs0Pm87bys9MilcIm1hcmdpblwiPT09biYmKGErPWIuY3NzKGUsbitadFtvXSwhMCxpKSkscj8oXCJjb250ZW50XCI9PT1uJiYoYS09Yi5jc3MoZSxcInBhZGRpbmdcIitadFtvXSwhMCxpKSksXCJtYXJnaW5cIiE9PW4mJihhLT1iLmNzcyhlLFwiYm9yZGVyXCIrWnRbb10rXCJXaWR0aFwiLCEwLGkpKSk6KGErPWIuY3NzKGUsXCJwYWRkaW5nXCIrWnRbb10sITAsaSksXCJwYWRkaW5nXCIhPT1uJiYoYSs9Yi5jc3MoZSxcImJvcmRlclwiK1p0W29dK1wiV2lkdGhcIiwhMCxpKSkpO3JldHVybiBhfWZ1bmN0aW9uIHNuKGUsdCxuKXt2YXIgcj0hMCxpPVwid2lkdGhcIj09PXQ/ZS5vZmZzZXRXaWR0aDplLm9mZnNldEhlaWdodCxvPVJ0KGUpLGE9Yi5zdXBwb3J0LmJveFNpemluZyYmXCJib3JkZXItYm94XCI9PT1iLmNzcyhlLFwiYm94U2l6aW5nXCIsITEsbyk7aWYoMD49aXx8bnVsbD09aSl7aWYoaT1XdChlLHQsbyksKDA+aXx8bnVsbD09aSkmJihpPWUuc3R5bGVbdF0pLFl0LnRlc3QoaSkpcmV0dXJuIGk7cj1hJiYoYi5zdXBwb3J0LmJveFNpemluZ1JlbGlhYmxlfHxpPT09ZS5zdHlsZVt0XSksaT1wYXJzZUZsb2F0KGkpfHwwfXJldHVybiBpK2FuKGUsdCxufHwoYT9cImJvcmRlclwiOlwiY29udGVudFwiKSxyLG8pK1wicHhcIn1mdW5jdGlvbiB1bihlKXt2YXIgdD1vLG49R3RbZV07cmV0dXJuIG58fChuPWxuKGUsdCksXCJub25lXCIhPT1uJiZufHwoUHQ9KFB0fHxiKFwiPGlmcmFtZSBmcmFtZWJvcmRlcj0nMCcgd2lkdGg9JzAnIGhlaWdodD0nMCcvPlwiKS5jc3MoXCJjc3NUZXh0XCIsXCJkaXNwbGF5OmJsb2NrICFpbXBvcnRhbnRcIikpLmFwcGVuZFRvKHQuZG9jdW1lbnRFbGVtZW50KSx0PShQdFswXS5jb250ZW50V2luZG93fHxQdFswXS5jb250ZW50RG9jdW1lbnQpLmRvY3VtZW50LHQud3JpdGUoXCI8IWRvY3R5cGUgaHRtbD48aHRtbD48Ym9keT5cIiksdC5jbG9zZSgpLG49bG4oZSx0KSxQdC5kZXRhY2goKSksR3RbZV09biksbn1mdW5jdGlvbiBsbihlLHQpe3ZhciBuPWIodC5jcmVhdGVFbGVtZW50KGUpKS5hcHBlbmRUbyh0LmJvZHkpLHI9Yi5jc3MoblswXSxcImRpc3BsYXlcIik7cmV0dXJuIG4ucmVtb3ZlKCkscn1iLmVhY2goW1wiaGVpZ2h0XCIsXCJ3aWR0aFwiXSxmdW5jdGlvbihlLG4pe2IuY3NzSG9va3Nbbl09e2dldDpmdW5jdGlvbihlLHIsaSl7cmV0dXJuIHI/MD09PWUub2Zmc2V0V2lkdGgmJlh0LnRlc3QoYi5jc3MoZSxcImRpc3BsYXlcIikpP2Iuc3dhcChlLFF0LGZ1bmN0aW9uKCl7cmV0dXJuIHNuKGUsbixpKX0pOnNuKGUsbixpKTp0fSxzZXQ6ZnVuY3Rpb24oZSx0LHIpe3ZhciBpPXImJlJ0KGUpO3JldHVybiBvbihlLHQscj9hbihlLG4scixiLnN1cHBvcnQuYm94U2l6aW5nJiZcImJvcmRlci1ib3hcIj09PWIuY3NzKGUsXCJib3hTaXppbmdcIiwhMSxpKSxpKTowKX19fSksYi5zdXBwb3J0Lm9wYWNpdHl8fChiLmNzc0hvb2tzLm9wYWNpdHk9e2dldDpmdW5jdGlvbihlLHQpe3JldHVybiBJdC50ZXN0KCh0JiZlLmN1cnJlbnRTdHlsZT9lLmN1cnJlbnRTdHlsZS5maWx0ZXI6ZS5zdHlsZS5maWx0ZXIpfHxcIlwiKT8uMDEqcGFyc2VGbG9hdChSZWdFeHAuJDEpK1wiXCI6dD9cIjFcIjpcIlwifSxzZXQ6ZnVuY3Rpb24oZSx0KXt2YXIgbj1lLnN0eWxlLHI9ZS5jdXJyZW50U3R5bGUsaT1iLmlzTnVtZXJpYyh0KT9cImFscGhhKG9wYWNpdHk9XCIrMTAwKnQrXCIpXCI6XCJcIixvPXImJnIuZmlsdGVyfHxuLmZpbHRlcnx8XCJcIjtuLnpvb209MSwodD49MXx8XCJcIj09PXQpJiZcIlwiPT09Yi50cmltKG8ucmVwbGFjZSgkdCxcIlwiKSkmJm4ucmVtb3ZlQXR0cmlidXRlJiYobi5yZW1vdmVBdHRyaWJ1dGUoXCJmaWx0ZXJcIiksXCJcIj09PXR8fHImJiFyLmZpbHRlcil8fChuLmZpbHRlcj0kdC50ZXN0KG8pP28ucmVwbGFjZSgkdCxpKTpvK1wiIFwiK2kpfX0pLGIoZnVuY3Rpb24oKXtiLnN1cHBvcnQucmVsaWFibGVNYXJnaW5SaWdodHx8KGIuY3NzSG9va3MubWFyZ2luUmlnaHQ9e2dldDpmdW5jdGlvbihlLG4pe3JldHVybiBuP2Iuc3dhcChlLHtkaXNwbGF5OlwiaW5saW5lLWJsb2NrXCJ9LFd0LFtlLFwibWFyZ2luUmlnaHRcIl0pOnR9fSksIWIuc3VwcG9ydC5waXhlbFBvc2l0aW9uJiZiLmZuLnBvc2l0aW9uJiZiLmVhY2goW1widG9wXCIsXCJsZWZ0XCJdLGZ1bmN0aW9uKGUsbil7Yi5jc3NIb29rc1tuXT17Z2V0OmZ1bmN0aW9uKGUscil7cmV0dXJuIHI/KHI9V3QoZSxuKSxZdC50ZXN0KHIpP2IoZSkucG9zaXRpb24oKVtuXStcInB4XCI6cik6dH19fSl9KSxiLmV4cHImJmIuZXhwci5maWx0ZXJzJiYoYi5leHByLmZpbHRlcnMuaGlkZGVuPWZ1bmN0aW9uKGUpe3JldHVybiAwPj1lLm9mZnNldFdpZHRoJiYwPj1lLm9mZnNldEhlaWdodHx8IWIuc3VwcG9ydC5yZWxpYWJsZUhpZGRlbk9mZnNldHMmJlwibm9uZVwiPT09KGUuc3R5bGUmJmUuc3R5bGUuZGlzcGxheXx8Yi5jc3MoZSxcImRpc3BsYXlcIikpfSxiLmV4cHIuZmlsdGVycy52aXNpYmxlPWZ1bmN0aW9uKGUpe3JldHVybiFiLmV4cHIuZmlsdGVycy5oaWRkZW4oZSl9KSxiLmVhY2goe21hcmdpbjpcIlwiLHBhZGRpbmc6XCJcIixib3JkZXI6XCJXaWR0aFwifSxmdW5jdGlvbihlLHQpe2IuY3NzSG9va3NbZSt0XT17ZXhwYW5kOmZ1bmN0aW9uKG4pe3ZhciByPTAsaT17fSxvPVwic3RyaW5nXCI9PXR5cGVvZiBuP24uc3BsaXQoXCIgXCIpOltuXTtmb3IoOzQ+cjtyKyspaVtlK1p0W3JdK3RdPW9bcl18fG9bci0yXXx8b1swXTtyZXR1cm4gaX19LFV0LnRlc3QoZSl8fChiLmNzc0hvb2tzW2UrdF0uc2V0PW9uKX0pO3ZhciBjbj0vJTIwL2cscG49L1xcW1xcXSQvLGZuPS9cXHI/XFxuL2csZG49L14oPzpzdWJtaXR8YnV0dG9ufGltYWdlfHJlc2V0fGZpbGUpJC9pLGhuPS9eKD86aW5wdXR8c2VsZWN0fHRleHRhcmVhfGtleWdlbikvaTtiLmZuLmV4dGVuZCh7c2VyaWFsaXplOmZ1bmN0aW9uKCl7cmV0dXJuIGIucGFyYW0odGhpcy5zZXJpYWxpemVBcnJheSgpKX0sc2VyaWFsaXplQXJyYXk6ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24oKXt2YXIgZT1iLnByb3AodGhpcyxcImVsZW1lbnRzXCIpO3JldHVybiBlP2IubWFrZUFycmF5KGUpOnRoaXN9KS5maWx0ZXIoZnVuY3Rpb24oKXt2YXIgZT10aGlzLnR5cGU7cmV0dXJuIHRoaXMubmFtZSYmIWIodGhpcykuaXMoXCI6ZGlzYWJsZWRcIikmJmhuLnRlc3QodGhpcy5ub2RlTmFtZSkmJiFkbi50ZXN0KGUpJiYodGhpcy5jaGVja2VkfHwhTnQudGVzdChlKSl9KS5tYXAoZnVuY3Rpb24oZSx0KXt2YXIgbj1iKHRoaXMpLnZhbCgpO3JldHVybiBudWxsPT1uP251bGw6Yi5pc0FycmF5KG4pP2IubWFwKG4sZnVuY3Rpb24oZSl7cmV0dXJue25hbWU6dC5uYW1lLHZhbHVlOmUucmVwbGFjZShmbixcIlxcclxcblwiKX19KTp7bmFtZTp0Lm5hbWUsdmFsdWU6bi5yZXBsYWNlKGZuLFwiXFxyXFxuXCIpfX0pLmdldCgpfX0pLGIucGFyYW09ZnVuY3Rpb24oZSxuKXt2YXIgcixpPVtdLG89ZnVuY3Rpb24oZSx0KXt0PWIuaXNGdW5jdGlvbih0KT90KCk6bnVsbD09dD9cIlwiOnQsaVtpLmxlbmd0aF09ZW5jb2RlVVJJQ29tcG9uZW50KGUpK1wiPVwiK2VuY29kZVVSSUNvbXBvbmVudCh0KX07aWYobj09PXQmJihuPWIuYWpheFNldHRpbmdzJiZiLmFqYXhTZXR0aW5ncy50cmFkaXRpb25hbCksYi5pc0FycmF5KGUpfHxlLmpxdWVyeSYmIWIuaXNQbGFpbk9iamVjdChlKSliLmVhY2goZSxmdW5jdGlvbigpe28odGhpcy5uYW1lLHRoaXMudmFsdWUpfSk7ZWxzZSBmb3IociBpbiBlKWduKHIsZVtyXSxuLG8pO3JldHVybiBpLmpvaW4oXCImXCIpLnJlcGxhY2UoY24sXCIrXCIpfTtmdW5jdGlvbiBnbihlLHQsbixyKXt2YXIgaTtpZihiLmlzQXJyYXkodCkpYi5lYWNoKHQsZnVuY3Rpb24odCxpKXtufHxwbi50ZXN0KGUpP3IoZSxpKTpnbihlK1wiW1wiKyhcIm9iamVjdFwiPT10eXBlb2YgaT90OlwiXCIpK1wiXVwiLGksbixyKX0pO2Vsc2UgaWYobnx8XCJvYmplY3RcIiE9PWIudHlwZSh0KSlyKGUsdCk7ZWxzZSBmb3IoaSBpbiB0KWduKGUrXCJbXCIraStcIl1cIix0W2ldLG4scil9Yi5lYWNoKFwiYmx1ciBmb2N1cyBmb2N1c2luIGZvY3Vzb3V0IGxvYWQgcmVzaXplIHNjcm9sbCB1bmxvYWQgY2xpY2sgZGJsY2xpY2sgbW91c2Vkb3duIG1vdXNldXAgbW91c2Vtb3ZlIG1vdXNlb3ZlciBtb3VzZW91dCBtb3VzZWVudGVyIG1vdXNlbGVhdmUgY2hhbmdlIHNlbGVjdCBzdWJtaXQga2V5ZG93biBrZXlwcmVzcyBrZXl1cCBlcnJvciBjb250ZXh0bWVudVwiLnNwbGl0KFwiIFwiKSxmdW5jdGlvbihlLHQpe2IuZm5bdF09ZnVuY3Rpb24oZSxuKXtyZXR1cm4gYXJndW1lbnRzLmxlbmd0aD4wP3RoaXMub24odCxudWxsLGUsbik6dGhpcy50cmlnZ2VyKHQpfX0pLGIuZm4uaG92ZXI9ZnVuY3Rpb24oZSx0KXtyZXR1cm4gdGhpcy5tb3VzZWVudGVyKGUpLm1vdXNlbGVhdmUodHx8ZSl9O3ZhciBtbix5bix2bj1iLm5vdygpLGJuPS9cXD8vLHhuPS8jLiokLyx3bj0vKFs/Jl0pXz1bXiZdKi8sVG49L14oLio/KTpbIFxcdF0qKFteXFxyXFxuXSopXFxyPyQvZ20sTm49L14oPzphYm91dHxhcHB8YXBwLXN0b3JhZ2V8ListZXh0ZW5zaW9ufGZpbGV8cmVzfHdpZGdldCk6JC8sQ249L14oPzpHRVR8SEVBRCkkLyxrbj0vXlxcL1xcLy8sRW49L14oW1xcdy4rLV0rOikoPzpcXC9cXC8oW15cXC8/IzpdKikoPzo6KFxcZCspfCl8KS8sU249Yi5mbi5sb2FkLEFuPXt9LGpuPXt9LERuPVwiKi9cIi5jb25jYXQoXCIqXCIpO3RyeXt5bj1hLmhyZWZ9Y2F0Y2goTG4pe3luPW8uY3JlYXRlRWxlbWVudChcImFcIikseW4uaHJlZj1cIlwiLHluPXluLmhyZWZ9bW49RW4uZXhlYyh5bi50b0xvd2VyQ2FzZSgpKXx8W107ZnVuY3Rpb24gSG4oZSl7cmV0dXJuIGZ1bmN0aW9uKHQsbil7XCJzdHJpbmdcIiE9dHlwZW9mIHQmJihuPXQsdD1cIipcIik7dmFyIHIsaT0wLG89dC50b0xvd2VyQ2FzZSgpLm1hdGNoKHcpfHxbXTtpZihiLmlzRnVuY3Rpb24obikpd2hpbGUocj1vW2krK10pXCIrXCI9PT1yWzBdPyhyPXIuc2xpY2UoMSl8fFwiKlwiLChlW3JdPWVbcl18fFtdKS51bnNoaWZ0KG4pKTooZVtyXT1lW3JdfHxbXSkucHVzaChuKX19ZnVuY3Rpb24gcW4oZSxuLHIsaSl7dmFyIG89e30sYT1lPT09am47ZnVuY3Rpb24gcyh1KXt2YXIgbDtyZXR1cm4gb1t1XT0hMCxiLmVhY2goZVt1XXx8W10sZnVuY3Rpb24oZSx1KXt2YXIgYz11KG4scixpKTtyZXR1cm5cInN0cmluZ1wiIT10eXBlb2YgY3x8YXx8b1tjXT9hPyEobD1jKTp0OihuLmRhdGFUeXBlcy51bnNoaWZ0KGMpLHMoYyksITEpfSksbH1yZXR1cm4gcyhuLmRhdGFUeXBlc1swXSl8fCFvW1wiKlwiXSYmcyhcIipcIil9ZnVuY3Rpb24gTW4oZSxuKXt2YXIgcixpLG89Yi5hamF4U2V0dGluZ3MuZmxhdE9wdGlvbnN8fHt9O2ZvcihpIGluIG4pbltpXSE9PXQmJigob1tpXT9lOnJ8fChyPXt9KSlbaV09bltpXSk7cmV0dXJuIHImJmIuZXh0ZW5kKCEwLGUsciksZX1iLmZuLmxvYWQ9ZnVuY3Rpb24oZSxuLHIpe2lmKFwic3RyaW5nXCIhPXR5cGVvZiBlJiZTbilyZXR1cm4gU24uYXBwbHkodGhpcyxhcmd1bWVudHMpO3ZhciBpLG8sYSxzPXRoaXMsdT1lLmluZGV4T2YoXCIgXCIpO3JldHVybiB1Pj0wJiYoaT1lLnNsaWNlKHUsZS5sZW5ndGgpLGU9ZS5zbGljZSgwLHUpKSxiLmlzRnVuY3Rpb24obik/KHI9bixuPXQpOm4mJlwib2JqZWN0XCI9PXR5cGVvZiBuJiYoYT1cIlBPU1RcIikscy5sZW5ndGg+MCYmYi5hamF4KHt1cmw6ZSx0eXBlOmEsZGF0YVR5cGU6XCJodG1sXCIsZGF0YTpufSkuZG9uZShmdW5jdGlvbihlKXtvPWFyZ3VtZW50cyxzLmh0bWwoaT9iKFwiPGRpdj5cIikuYXBwZW5kKGIucGFyc2VIVE1MKGUpKS5maW5kKGkpOmUpfSkuY29tcGxldGUociYmZnVuY3Rpb24oZSx0KXtzLmVhY2gocixvfHxbZS5yZXNwb25zZVRleHQsdCxlXSl9KSx0aGlzfSxiLmVhY2goW1wiYWpheFN0YXJ0XCIsXCJhamF4U3RvcFwiLFwiYWpheENvbXBsZXRlXCIsXCJhamF4RXJyb3JcIixcImFqYXhTdWNjZXNzXCIsXCJhamF4U2VuZFwiXSxmdW5jdGlvbihlLHQpe2IuZm5bdF09ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMub24odCxlKX19KSxiLmVhY2goW1wiZ2V0XCIsXCJwb3N0XCJdLGZ1bmN0aW9uKGUsbil7YltuXT1mdW5jdGlvbihlLHIsaSxvKXtyZXR1cm4gYi5pc0Z1bmN0aW9uKHIpJiYobz1vfHxpLGk9cixyPXQpLGIuYWpheCh7dXJsOmUsdHlwZTpuLGRhdGFUeXBlOm8sZGF0YTpyLHN1Y2Nlc3M6aX0pfX0pLGIuZXh0ZW5kKHthY3RpdmU6MCxsYXN0TW9kaWZpZWQ6e30sZXRhZzp7fSxhamF4U2V0dGluZ3M6e3VybDp5bix0eXBlOlwiR0VUXCIsaXNMb2NhbDpObi50ZXN0KG1uWzFdKSxnbG9iYWw6ITAscHJvY2Vzc0RhdGE6ITAsYXN5bmM6ITAsY29udGVudFR5cGU6XCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLThcIixhY2NlcHRzOntcIipcIjpEbix0ZXh0OlwidGV4dC9wbGFpblwiLGh0bWw6XCJ0ZXh0L2h0bWxcIix4bWw6XCJhcHBsaWNhdGlvbi94bWwsIHRleHQveG1sXCIsanNvbjpcImFwcGxpY2F0aW9uL2pzb24sIHRleHQvamF2YXNjcmlwdFwifSxjb250ZW50czp7eG1sOi94bWwvLGh0bWw6L2h0bWwvLGpzb246L2pzb24vfSxyZXNwb25zZUZpZWxkczp7eG1sOlwicmVzcG9uc2VYTUxcIix0ZXh0OlwicmVzcG9uc2VUZXh0XCJ9LGNvbnZlcnRlcnM6e1wiKiB0ZXh0XCI6ZS5TdHJpbmcsXCJ0ZXh0IGh0bWxcIjohMCxcInRleHQganNvblwiOmIucGFyc2VKU09OLFwidGV4dCB4bWxcIjpiLnBhcnNlWE1MfSxmbGF0T3B0aW9uczp7dXJsOiEwLGNvbnRleHQ6ITB9fSxhamF4U2V0dXA6ZnVuY3Rpb24oZSx0KXtyZXR1cm4gdD9NbihNbihlLGIuYWpheFNldHRpbmdzKSx0KTpNbihiLmFqYXhTZXR0aW5ncyxlKX0sYWpheFByZWZpbHRlcjpIbihBbiksYWpheFRyYW5zcG9ydDpIbihqbiksYWpheDpmdW5jdGlvbihlLG4pe1wib2JqZWN0XCI9PXR5cGVvZiBlJiYobj1lLGU9dCksbj1ufHx7fTt2YXIgcixpLG8sYSxzLHUsbCxjLHA9Yi5hamF4U2V0dXAoe30sbiksZj1wLmNvbnRleHR8fHAsZD1wLmNvbnRleHQmJihmLm5vZGVUeXBlfHxmLmpxdWVyeSk/YihmKTpiLmV2ZW50LGg9Yi5EZWZlcnJlZCgpLGc9Yi5DYWxsYmFja3MoXCJvbmNlIG1lbW9yeVwiKSxtPXAuc3RhdHVzQ29kZXx8e30seT17fSx2PXt9LHg9MCxUPVwiY2FuY2VsZWRcIixOPXtyZWFkeVN0YXRlOjAsZ2V0UmVzcG9uc2VIZWFkZXI6ZnVuY3Rpb24oZSl7dmFyIHQ7aWYoMj09PXgpe2lmKCFjKXtjPXt9O3doaWxlKHQ9VG4uZXhlYyhhKSljW3RbMV0udG9Mb3dlckNhc2UoKV09dFsyXX10PWNbZS50b0xvd2VyQ2FzZSgpXX1yZXR1cm4gbnVsbD09dD9udWxsOnR9LGdldEFsbFJlc3BvbnNlSGVhZGVyczpmdW5jdGlvbigpe3JldHVybiAyPT09eD9hOm51bGx9LHNldFJlcXVlc3RIZWFkZXI6ZnVuY3Rpb24oZSx0KXt2YXIgbj1lLnRvTG93ZXJDYXNlKCk7cmV0dXJuIHh8fChlPXZbbl09dltuXXx8ZSx5W2VdPXQpLHRoaXN9LG92ZXJyaWRlTWltZVR5cGU6ZnVuY3Rpb24oZSl7cmV0dXJuIHh8fChwLm1pbWVUeXBlPWUpLHRoaXN9LHN0YXR1c0NvZGU6ZnVuY3Rpb24oZSl7dmFyIHQ7aWYoZSlpZigyPngpZm9yKHQgaW4gZSltW3RdPVttW3RdLGVbdF1dO2Vsc2UgTi5hbHdheXMoZVtOLnN0YXR1c10pO3JldHVybiB0aGlzfSxhYm9ydDpmdW5jdGlvbihlKXt2YXIgdD1lfHxUO3JldHVybiBsJiZsLmFib3J0KHQpLGsoMCx0KSx0aGlzfX07aWYoaC5wcm9taXNlKE4pLmNvbXBsZXRlPWcuYWRkLE4uc3VjY2Vzcz1OLmRvbmUsTi5lcnJvcj1OLmZhaWwscC51cmw9KChlfHxwLnVybHx8eW4pK1wiXCIpLnJlcGxhY2UoeG4sXCJcIikucmVwbGFjZShrbixtblsxXStcIi8vXCIpLHAudHlwZT1uLm1ldGhvZHx8bi50eXBlfHxwLm1ldGhvZHx8cC50eXBlLHAuZGF0YVR5cGVzPWIudHJpbShwLmRhdGFUeXBlfHxcIipcIikudG9Mb3dlckNhc2UoKS5tYXRjaCh3KXx8W1wiXCJdLG51bGw9PXAuY3Jvc3NEb21haW4mJihyPUVuLmV4ZWMocC51cmwudG9Mb3dlckNhc2UoKSkscC5jcm9zc0RvbWFpbj0hKCFyfHxyWzFdPT09bW5bMV0mJnJbMl09PT1tblsyXSYmKHJbM118fChcImh0dHA6XCI9PT1yWzFdPzgwOjQ0MykpPT0obW5bM118fChcImh0dHA6XCI9PT1tblsxXT84MDo0NDMpKSkpLHAuZGF0YSYmcC5wcm9jZXNzRGF0YSYmXCJzdHJpbmdcIiE9dHlwZW9mIHAuZGF0YSYmKHAuZGF0YT1iLnBhcmFtKHAuZGF0YSxwLnRyYWRpdGlvbmFsKSkscW4oQW4scCxuLE4pLDI9PT14KXJldHVybiBOO3U9cC5nbG9iYWwsdSYmMD09PWIuYWN0aXZlKysmJmIuZXZlbnQudHJpZ2dlcihcImFqYXhTdGFydFwiKSxwLnR5cGU9cC50eXBlLnRvVXBwZXJDYXNlKCkscC5oYXNDb250ZW50PSFDbi50ZXN0KHAudHlwZSksbz1wLnVybCxwLmhhc0NvbnRlbnR8fChwLmRhdGEmJihvPXAudXJsKz0oYm4udGVzdChvKT9cIiZcIjpcIj9cIikrcC5kYXRhLGRlbGV0ZSBwLmRhdGEpLHAuY2FjaGU9PT0hMSYmKHAudXJsPXduLnRlc3Qobyk/by5yZXBsYWNlKHduLFwiJDFfPVwiK3ZuKyspOm8rKGJuLnRlc3Qobyk/XCImXCI6XCI/XCIpK1wiXz1cIit2bisrKSkscC5pZk1vZGlmaWVkJiYoYi5sYXN0TW9kaWZpZWRbb10mJk4uc2V0UmVxdWVzdEhlYWRlcihcIklmLU1vZGlmaWVkLVNpbmNlXCIsYi5sYXN0TW9kaWZpZWRbb10pLGIuZXRhZ1tvXSYmTi5zZXRSZXF1ZXN0SGVhZGVyKFwiSWYtTm9uZS1NYXRjaFwiLGIuZXRhZ1tvXSkpLChwLmRhdGEmJnAuaGFzQ29udGVudCYmcC5jb250ZW50VHlwZSE9PSExfHxuLmNvbnRlbnRUeXBlKSYmTi5zZXRSZXF1ZXN0SGVhZGVyKFwiQ29udGVudC1UeXBlXCIscC5jb250ZW50VHlwZSksTi5zZXRSZXF1ZXN0SGVhZGVyKFwiQWNjZXB0XCIscC5kYXRhVHlwZXNbMF0mJnAuYWNjZXB0c1twLmRhdGFUeXBlc1swXV0/cC5hY2NlcHRzW3AuZGF0YVR5cGVzWzBdXSsoXCIqXCIhPT1wLmRhdGFUeXBlc1swXT9cIiwgXCIrRG4rXCI7IHE9MC4wMVwiOlwiXCIpOnAuYWNjZXB0c1tcIipcIl0pO2ZvcihpIGluIHAuaGVhZGVycylOLnNldFJlcXVlc3RIZWFkZXIoaSxwLmhlYWRlcnNbaV0pO2lmKHAuYmVmb3JlU2VuZCYmKHAuYmVmb3JlU2VuZC5jYWxsKGYsTixwKT09PSExfHwyPT09eCkpcmV0dXJuIE4uYWJvcnQoKTtUPVwiYWJvcnRcIjtmb3IoaSBpbntzdWNjZXNzOjEsZXJyb3I6MSxjb21wbGV0ZToxfSlOW2ldKHBbaV0pO2lmKGw9cW4oam4scCxuLE4pKXtOLnJlYWR5U3RhdGU9MSx1JiZkLnRyaWdnZXIoXCJhamF4U2VuZFwiLFtOLHBdKSxwLmFzeW5jJiZwLnRpbWVvdXQ+MCYmKHM9c2V0VGltZW91dChmdW5jdGlvbigpe04uYWJvcnQoXCJ0aW1lb3V0XCIpfSxwLnRpbWVvdXQpKTt0cnl7eD0xLGwuc2VuZCh5LGspfWNhdGNoKEMpe2lmKCEoMj54KSl0aHJvdyBDO2soLTEsQyl9fWVsc2UgaygtMSxcIk5vIFRyYW5zcG9ydFwiKTtmdW5jdGlvbiBrKGUsbixyLGkpe3ZhciBjLHksdix3LFQsQz1uOzIhPT14JiYoeD0yLHMmJmNsZWFyVGltZW91dChzKSxsPXQsYT1pfHxcIlwiLE4ucmVhZHlTdGF0ZT1lPjA/NDowLHImJih3PV9uKHAsTixyKSksZT49MjAwJiYzMDA+ZXx8MzA0PT09ZT8ocC5pZk1vZGlmaWVkJiYoVD1OLmdldFJlc3BvbnNlSGVhZGVyKFwiTGFzdC1Nb2RpZmllZFwiKSxUJiYoYi5sYXN0TW9kaWZpZWRbb109VCksVD1OLmdldFJlc3BvbnNlSGVhZGVyKFwiZXRhZ1wiKSxUJiYoYi5ldGFnW29dPVQpKSwyMDQ9PT1lPyhjPSEwLEM9XCJub2NvbnRlbnRcIik6MzA0PT09ZT8oYz0hMCxDPVwibm90bW9kaWZpZWRcIik6KGM9Rm4ocCx3KSxDPWMuc3RhdGUseT1jLmRhdGEsdj1jLmVycm9yLGM9IXYpKToodj1DLChlfHwhQykmJihDPVwiZXJyb3JcIiwwPmUmJihlPTApKSksTi5zdGF0dXM9ZSxOLnN0YXR1c1RleHQ9KG58fEMpK1wiXCIsYz9oLnJlc29sdmVXaXRoKGYsW3ksQyxOXSk6aC5yZWplY3RXaXRoKGYsW04sQyx2XSksTi5zdGF0dXNDb2RlKG0pLG09dCx1JiZkLnRyaWdnZXIoYz9cImFqYXhTdWNjZXNzXCI6XCJhamF4RXJyb3JcIixbTixwLGM/eTp2XSksZy5maXJlV2l0aChmLFtOLENdKSx1JiYoZC50cmlnZ2VyKFwiYWpheENvbXBsZXRlXCIsW04scF0pLC0tYi5hY3RpdmV8fGIuZXZlbnQudHJpZ2dlcihcImFqYXhTdG9wXCIpKSl9cmV0dXJuIE59LGdldFNjcmlwdDpmdW5jdGlvbihlLG4pe3JldHVybiBiLmdldChlLHQsbixcInNjcmlwdFwiKX0sZ2V0SlNPTjpmdW5jdGlvbihlLHQsbil7cmV0dXJuIGIuZ2V0KGUsdCxuLFwianNvblwiKX19KTtmdW5jdGlvbiBfbihlLG4scil7dmFyIGksbyxhLHMsdT1lLmNvbnRlbnRzLGw9ZS5kYXRhVHlwZXMsYz1lLnJlc3BvbnNlRmllbGRzO2ZvcihzIGluIGMpcyBpbiByJiYobltjW3NdXT1yW3NdKTt3aGlsZShcIipcIj09PWxbMF0pbC5zaGlmdCgpLG89PT10JiYobz1lLm1pbWVUeXBlfHxuLmdldFJlc3BvbnNlSGVhZGVyKFwiQ29udGVudC1UeXBlXCIpKTtpZihvKWZvcihzIGluIHUpaWYodVtzXSYmdVtzXS50ZXN0KG8pKXtsLnVuc2hpZnQocyk7YnJlYWt9aWYobFswXWluIHIpYT1sWzBdO2Vsc2V7Zm9yKHMgaW4gcil7aWYoIWxbMF18fGUuY29udmVydGVyc1tzK1wiIFwiK2xbMF1dKXthPXM7YnJlYWt9aXx8KGk9cyl9YT1hfHxpfXJldHVybiBhPyhhIT09bFswXSYmbC51bnNoaWZ0KGEpLHJbYV0pOnR9ZnVuY3Rpb24gRm4oZSx0KXt2YXIgbixyLGksbyxhPXt9LHM9MCx1PWUuZGF0YVR5cGVzLnNsaWNlKCksbD11WzBdO2lmKGUuZGF0YUZpbHRlciYmKHQ9ZS5kYXRhRmlsdGVyKHQsZS5kYXRhVHlwZSkpLHVbMV0pZm9yKGkgaW4gZS5jb252ZXJ0ZXJzKWFbaS50b0xvd2VyQ2FzZSgpXT1lLmNvbnZlcnRlcnNbaV07Zm9yKDtyPXVbKytzXTspaWYoXCIqXCIhPT1yKXtpZihcIipcIiE9PWwmJmwhPT1yKXtpZihpPWFbbCtcIiBcIityXXx8YVtcIiogXCIrcl0sIWkpZm9yKG4gaW4gYSlpZihvPW4uc3BsaXQoXCIgXCIpLG9bMV09PT1yJiYoaT1hW2wrXCIgXCIrb1swXV18fGFbXCIqIFwiK29bMF1dKSl7aT09PSEwP2k9YVtuXTphW25dIT09ITAmJihyPW9bMF0sdS5zcGxpY2Uocy0tLDAscikpO2JyZWFrfWlmKGkhPT0hMClpZihpJiZlW1widGhyb3dzXCJdKXQ9aSh0KTtlbHNlIHRyeXt0PWkodCl9Y2F0Y2goYyl7cmV0dXJue3N0YXRlOlwicGFyc2VyZXJyb3JcIixlcnJvcjppP2M6XCJObyBjb252ZXJzaW9uIGZyb20gXCIrbCtcIiB0byBcIityfX19bD1yfXJldHVybntzdGF0ZTpcInN1Y2Nlc3NcIixkYXRhOnR9fWIuYWpheFNldHVwKHthY2NlcHRzOntzY3JpcHQ6XCJ0ZXh0L2phdmFzY3JpcHQsIGFwcGxpY2F0aW9uL2phdmFzY3JpcHQsIGFwcGxpY2F0aW9uL2VjbWFzY3JpcHQsIGFwcGxpY2F0aW9uL3gtZWNtYXNjcmlwdFwifSxjb250ZW50czp7c2NyaXB0Oi8oPzpqYXZhfGVjbWEpc2NyaXB0L30sY29udmVydGVyczp7XCJ0ZXh0IHNjcmlwdFwiOmZ1bmN0aW9uKGUpe3JldHVybiBiLmdsb2JhbEV2YWwoZSksZX19fSksYi5hamF4UHJlZmlsdGVyKFwic2NyaXB0XCIsZnVuY3Rpb24oZSl7ZS5jYWNoZT09PXQmJihlLmNhY2hlPSExKSxlLmNyb3NzRG9tYWluJiYoZS50eXBlPVwiR0VUXCIsZS5nbG9iYWw9ITEpfSksYi5hamF4VHJhbnNwb3J0KFwic2NyaXB0XCIsZnVuY3Rpb24oZSl7aWYoZS5jcm9zc0RvbWFpbil7dmFyIG4scj1vLmhlYWR8fGIoXCJoZWFkXCIpWzBdfHxvLmRvY3VtZW50RWxlbWVudDtyZXR1cm57c2VuZDpmdW5jdGlvbih0LGkpe249by5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpLG4uYXN5bmM9ITAsZS5zY3JpcHRDaGFyc2V0JiYobi5jaGFyc2V0PWUuc2NyaXB0Q2hhcnNldCksbi5zcmM9ZS51cmwsbi5vbmxvYWQ9bi5vbnJlYWR5c3RhdGVjaGFuZ2U9ZnVuY3Rpb24oZSx0KXsodHx8IW4ucmVhZHlTdGF0ZXx8L2xvYWRlZHxjb21wbGV0ZS8udGVzdChuLnJlYWR5U3RhdGUpKSYmKG4ub25sb2FkPW4ub25yZWFkeXN0YXRlY2hhbmdlPW51bGwsbi5wYXJlbnROb2RlJiZuLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQobiksbj1udWxsLHR8fGkoMjAwLFwic3VjY2Vzc1wiKSl9LHIuaW5zZXJ0QmVmb3JlKG4sci5maXJzdENoaWxkKX0sYWJvcnQ6ZnVuY3Rpb24oKXtuJiZuLm9ubG9hZCh0LCEwKX19fX0pO3ZhciBPbj1bXSxCbj0vKD0pXFw/KD89JnwkKXxcXD9cXD8vO2IuYWpheFNldHVwKHtqc29ucDpcImNhbGxiYWNrXCIsanNvbnBDYWxsYmFjazpmdW5jdGlvbigpe3ZhciBlPU9uLnBvcCgpfHxiLmV4cGFuZG8rXCJfXCIrdm4rKztyZXR1cm4gdGhpc1tlXT0hMCxlfX0pLGIuYWpheFByZWZpbHRlcihcImpzb24ganNvbnBcIixmdW5jdGlvbihuLHIsaSl7dmFyIG8sYSxzLHU9bi5qc29ucCE9PSExJiYoQm4udGVzdChuLnVybCk/XCJ1cmxcIjpcInN0cmluZ1wiPT10eXBlb2Ygbi5kYXRhJiYhKG4uY29udGVudFR5cGV8fFwiXCIpLmluZGV4T2YoXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWRcIikmJkJuLnRlc3Qobi5kYXRhKSYmXCJkYXRhXCIpO3JldHVybiB1fHxcImpzb25wXCI9PT1uLmRhdGFUeXBlc1swXT8obz1uLmpzb25wQ2FsbGJhY2s9Yi5pc0Z1bmN0aW9uKG4uanNvbnBDYWxsYmFjayk/bi5qc29ucENhbGxiYWNrKCk6bi5qc29ucENhbGxiYWNrLHU/blt1XT1uW3VdLnJlcGxhY2UoQm4sXCIkMVwiK28pOm4uanNvbnAhPT0hMSYmKG4udXJsKz0oYm4udGVzdChuLnVybCk/XCImXCI6XCI/XCIpK24uanNvbnArXCI9XCIrbyksbi5jb252ZXJ0ZXJzW1wic2NyaXB0IGpzb25cIl09ZnVuY3Rpb24oKXtyZXR1cm4gc3x8Yi5lcnJvcihvK1wiIHdhcyBub3QgY2FsbGVkXCIpLHNbMF19LG4uZGF0YVR5cGVzWzBdPVwianNvblwiLGE9ZVtvXSxlW29dPWZ1bmN0aW9uKCl7cz1hcmd1bWVudHN9LGkuYWx3YXlzKGZ1bmN0aW9uKCl7ZVtvXT1hLG5bb10mJihuLmpzb25wQ2FsbGJhY2s9ci5qc29ucENhbGxiYWNrLE9uLnB1c2gobykpLHMmJmIuaXNGdW5jdGlvbihhKSYmYShzWzBdKSxzPWE9dH0pLFwic2NyaXB0XCIpOnR9KTt2YXIgUG4sUm4sV249MCwkbj1lLkFjdGl2ZVhPYmplY3QmJmZ1bmN0aW9uKCl7dmFyIGU7Zm9yKGUgaW4gUG4pUG5bZV0odCwhMCl9O2Z1bmN0aW9uIEluKCl7dHJ5e3JldHVybiBuZXcgZS5YTUxIdHRwUmVxdWVzdH1jYXRjaCh0KXt9fWZ1bmN0aW9uIHpuKCl7dHJ5e3JldHVybiBuZXcgZS5BY3RpdmVYT2JqZWN0KFwiTWljcm9zb2Z0LlhNTEhUVFBcIil9Y2F0Y2godCl7fX1iLmFqYXhTZXR0aW5ncy54aHI9ZS5BY3RpdmVYT2JqZWN0P2Z1bmN0aW9uKCl7cmV0dXJuIXRoaXMuaXNMb2NhbCYmSW4oKXx8em4oKX06SW4sUm49Yi5hamF4U2V0dGluZ3MueGhyKCksYi5zdXBwb3J0LmNvcnM9ISFSbiYmXCJ3aXRoQ3JlZGVudGlhbHNcImluIFJuLFJuPWIuc3VwcG9ydC5hamF4PSEhUm4sUm4mJmIuYWpheFRyYW5zcG9ydChmdW5jdGlvbihuKXtpZighbi5jcm9zc0RvbWFpbnx8Yi5zdXBwb3J0LmNvcnMpe3ZhciByO3JldHVybntzZW5kOmZ1bmN0aW9uKGksbyl7dmFyIGEscyx1PW4ueGhyKCk7aWYobi51c2VybmFtZT91Lm9wZW4obi50eXBlLG4udXJsLG4uYXN5bmMsbi51c2VybmFtZSxuLnBhc3N3b3JkKTp1Lm9wZW4obi50eXBlLG4udXJsLG4uYXN5bmMpLG4ueGhyRmllbGRzKWZvcihzIGluIG4ueGhyRmllbGRzKXVbc109bi54aHJGaWVsZHNbc107bi5taW1lVHlwZSYmdS5vdmVycmlkZU1pbWVUeXBlJiZ1Lm92ZXJyaWRlTWltZVR5cGUobi5taW1lVHlwZSksbi5jcm9zc0RvbWFpbnx8aVtcIlgtUmVxdWVzdGVkLVdpdGhcIl18fChpW1wiWC1SZXF1ZXN0ZWQtV2l0aFwiXT1cIlhNTEh0dHBSZXF1ZXN0XCIpO3RyeXtmb3IocyBpbiBpKXUuc2V0UmVxdWVzdEhlYWRlcihzLGlbc10pfWNhdGNoKGwpe311LnNlbmQobi5oYXNDb250ZW50JiZuLmRhdGF8fG51bGwpLHI9ZnVuY3Rpb24oZSxpKXt2YXIgcyxsLGMscDt0cnl7aWYociYmKGl8fDQ9PT11LnJlYWR5U3RhdGUpKWlmKHI9dCxhJiYodS5vbnJlYWR5c3RhdGVjaGFuZ2U9Yi5ub29wLCRuJiZkZWxldGUgUG5bYV0pLGkpNCE9PXUucmVhZHlTdGF0ZSYmdS5hYm9ydCgpO2Vsc2V7cD17fSxzPXUuc3RhdHVzLGw9dS5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSxcInN0cmluZ1wiPT10eXBlb2YgdS5yZXNwb25zZVRleHQmJihwLnRleHQ9dS5yZXNwb25zZVRleHQpO3RyeXtjPXUuc3RhdHVzVGV4dH1jYXRjaChmKXtjPVwiXCJ9c3x8IW4uaXNMb2NhbHx8bi5jcm9zc0RvbWFpbj8xMjIzPT09cyYmKHM9MjA0KTpzPXAudGV4dD8yMDA6NDA0fX1jYXRjaChkKXtpfHxvKC0xLGQpfXAmJm8ocyxjLHAsbCl9LG4uYXN5bmM/ND09PXUucmVhZHlTdGF0ZT9zZXRUaW1lb3V0KHIpOihhPSsrV24sJG4mJihQbnx8KFBuPXt9LGIoZSkudW5sb2FkKCRuKSksUG5bYV09ciksdS5vbnJlYWR5c3RhdGVjaGFuZ2U9cik6cigpfSxhYm9ydDpmdW5jdGlvbigpe3ImJnIodCwhMCl9fX19KTt2YXIgWG4sVW4sVm49L14oPzp0b2dnbGV8c2hvd3xoaWRlKSQvLFluPVJlZ0V4cChcIl4oPzooWystXSk9fCkoXCIreCtcIikoW2EteiVdKikkXCIsXCJpXCIpLEpuPS9xdWV1ZUhvb2tzJC8sR249W25yXSxRbj17XCIqXCI6W2Z1bmN0aW9uKGUsdCl7dmFyIG4scixpPXRoaXMuY3JlYXRlVHdlZW4oZSx0KSxvPVluLmV4ZWModCksYT1pLmN1cigpLHM9K2F8fDAsdT0xLGw9MjA7aWYobyl7aWYobj0rb1syXSxyPW9bM118fChiLmNzc051bWJlcltlXT9cIlwiOlwicHhcIiksXCJweFwiIT09ciYmcyl7cz1iLmNzcyhpLmVsZW0sZSwhMCl8fG58fDE7ZG8gdT11fHxcIi41XCIscy89dSxiLnN0eWxlKGkuZWxlbSxlLHMrcik7d2hpbGUodSE9PSh1PWkuY3VyKCkvYSkmJjEhPT11JiYtLWwpfWkudW5pdD1yLGkuc3RhcnQ9cyxpLmVuZD1vWzFdP3MrKG9bMV0rMSkqbjpufXJldHVybiBpfV19O2Z1bmN0aW9uIEtuKCl7cmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtYbj10fSksWG49Yi5ub3coKX1mdW5jdGlvbiBabihlLHQpe2IuZWFjaCh0LGZ1bmN0aW9uKHQsbil7dmFyIHI9KFFuW3RdfHxbXSkuY29uY2F0KFFuW1wiKlwiXSksaT0wLG89ci5sZW5ndGg7Zm9yKDtvPmk7aSsrKWlmKHJbaV0uY2FsbChlLHQsbikpcmV0dXJufSl9ZnVuY3Rpb24gZXIoZSx0LG4pe3ZhciByLGksbz0wLGE9R24ubGVuZ3RoLHM9Yi5EZWZlcnJlZCgpLmFsd2F5cyhmdW5jdGlvbigpe2RlbGV0ZSB1LmVsZW19KSx1PWZ1bmN0aW9uKCl7aWYoaSlyZXR1cm4hMTt2YXIgdD1Ybnx8S24oKSxuPU1hdGgubWF4KDAsbC5zdGFydFRpbWUrbC5kdXJhdGlvbi10KSxyPW4vbC5kdXJhdGlvbnx8MCxvPTEtcixhPTAsdT1sLnR3ZWVucy5sZW5ndGg7Zm9yKDt1PmE7YSsrKWwudHdlZW5zW2FdLnJ1bihvKTtyZXR1cm4gcy5ub3RpZnlXaXRoKGUsW2wsbyxuXSksMT5vJiZ1P246KHMucmVzb2x2ZVdpdGgoZSxbbF0pLCExKX0sbD1zLnByb21pc2Uoe2VsZW06ZSxwcm9wczpiLmV4dGVuZCh7fSx0KSxvcHRzOmIuZXh0ZW5kKCEwLHtzcGVjaWFsRWFzaW5nOnt9fSxuKSxvcmlnaW5hbFByb3BlcnRpZXM6dCxvcmlnaW5hbE9wdGlvbnM6bixzdGFydFRpbWU6WG58fEtuKCksZHVyYXRpb246bi5kdXJhdGlvbix0d2VlbnM6W10sY3JlYXRlVHdlZW46ZnVuY3Rpb24odCxuKXt2YXIgcj1iLlR3ZWVuKGUsbC5vcHRzLHQsbixsLm9wdHMuc3BlY2lhbEVhc2luZ1t0XXx8bC5vcHRzLmVhc2luZyk7cmV0dXJuIGwudHdlZW5zLnB1c2gocikscn0sc3RvcDpmdW5jdGlvbih0KXt2YXIgbj0wLHI9dD9sLnR3ZWVucy5sZW5ndGg6MDtpZihpKXJldHVybiB0aGlzO2ZvcihpPSEwO3I+bjtuKyspbC50d2VlbnNbbl0ucnVuKDEpO3JldHVybiB0P3MucmVzb2x2ZVdpdGgoZSxbbCx0XSk6cy5yZWplY3RXaXRoKGUsW2wsdF0pLHRoaXN9fSksYz1sLnByb3BzO2Zvcih0cihjLGwub3B0cy5zcGVjaWFsRWFzaW5nKTthPm87bysrKWlmKHI9R25bb10uY2FsbChsLGUsYyxsLm9wdHMpKXJldHVybiByO3JldHVybiBabihsLGMpLGIuaXNGdW5jdGlvbihsLm9wdHMuc3RhcnQpJiZsLm9wdHMuc3RhcnQuY2FsbChlLGwpLGIuZngudGltZXIoYi5leHRlbmQodSx7ZWxlbTplLGFuaW06bCxxdWV1ZTpsLm9wdHMucXVldWV9KSksbC5wcm9ncmVzcyhsLm9wdHMucHJvZ3Jlc3MpLmRvbmUobC5vcHRzLmRvbmUsbC5vcHRzLmNvbXBsZXRlKS5mYWlsKGwub3B0cy5mYWlsKS5hbHdheXMobC5vcHRzLmFsd2F5cyl9ZnVuY3Rpb24gdHIoZSx0KXt2YXIgbixyLGksbyxhO2ZvcihpIGluIGUpaWYocj1iLmNhbWVsQ2FzZShpKSxvPXRbcl0sbj1lW2ldLGIuaXNBcnJheShuKSYmKG89blsxXSxuPWVbaV09blswXSksaSE9PXImJihlW3JdPW4sZGVsZXRlIGVbaV0pLGE9Yi5jc3NIb29rc1tyXSxhJiZcImV4cGFuZFwiaW4gYSl7bj1hLmV4cGFuZChuKSxkZWxldGUgZVtyXTtmb3IoaSBpbiBuKWkgaW4gZXx8KGVbaV09bltpXSx0W2ldPW8pfWVsc2UgdFtyXT1vfWIuQW5pbWF0aW9uPWIuZXh0ZW5kKGVyLHt0d2VlbmVyOmZ1bmN0aW9uKGUsdCl7Yi5pc0Z1bmN0aW9uKGUpPyh0PWUsZT1bXCIqXCJdKTplPWUuc3BsaXQoXCIgXCIpO3ZhciBuLHI9MCxpPWUubGVuZ3RoO2Zvcig7aT5yO3IrKyluPWVbcl0sUW5bbl09UW5bbl18fFtdLFFuW25dLnVuc2hpZnQodCl9LHByZWZpbHRlcjpmdW5jdGlvbihlLHQpe3Q/R24udW5zaGlmdChlKTpHbi5wdXNoKGUpfX0pO2Z1bmN0aW9uIG5yKGUsdCxuKXt2YXIgcixpLG8sYSxzLHUsbCxjLHAsZj10aGlzLGQ9ZS5zdHlsZSxoPXt9LGc9W10sbT1lLm5vZGVUeXBlJiZubihlKTtuLnF1ZXVlfHwoYz1iLl9xdWV1ZUhvb2tzKGUsXCJmeFwiKSxudWxsPT1jLnVucXVldWVkJiYoYy51bnF1ZXVlZD0wLHA9Yy5lbXB0eS5maXJlLGMuZW1wdHkuZmlyZT1mdW5jdGlvbigpe2MudW5xdWV1ZWR8fHAoKX0pLGMudW5xdWV1ZWQrKyxmLmFsd2F5cyhmdW5jdGlvbigpe2YuYWx3YXlzKGZ1bmN0aW9uKCl7Yy51bnF1ZXVlZC0tLGIucXVldWUoZSxcImZ4XCIpLmxlbmd0aHx8Yy5lbXB0eS5maXJlKCl9KX0pKSwxPT09ZS5ub2RlVHlwZSYmKFwiaGVpZ2h0XCJpbiB0fHxcIndpZHRoXCJpbiB0KSYmKG4ub3ZlcmZsb3c9W2Qub3ZlcmZsb3csZC5vdmVyZmxvd1gsZC5vdmVyZmxvd1ldLFwiaW5saW5lXCI9PT1iLmNzcyhlLFwiZGlzcGxheVwiKSYmXCJub25lXCI9PT1iLmNzcyhlLFwiZmxvYXRcIikmJihiLnN1cHBvcnQuaW5saW5lQmxvY2tOZWVkc0xheW91dCYmXCJpbmxpbmVcIiE9PXVuKGUubm9kZU5hbWUpP2Quem9vbT0xOmQuZGlzcGxheT1cImlubGluZS1ibG9ja1wiKSksbi5vdmVyZmxvdyYmKGQub3ZlcmZsb3c9XCJoaWRkZW5cIixiLnN1cHBvcnQuc2hyaW5rV3JhcEJsb2Nrc3x8Zi5hbHdheXMoZnVuY3Rpb24oKXtkLm92ZXJmbG93PW4ub3ZlcmZsb3dbMF0sZC5vdmVyZmxvd1g9bi5vdmVyZmxvd1sxXSxkLm92ZXJmbG93WT1uLm92ZXJmbG93WzJdfSkpO2ZvcihpIGluIHQpaWYoYT10W2ldLFZuLmV4ZWMoYSkpe2lmKGRlbGV0ZSB0W2ldLHU9dXx8XCJ0b2dnbGVcIj09PWEsYT09PShtP1wiaGlkZVwiOlwic2hvd1wiKSljb250aW51ZTtnLnB1c2goaSl9aWYobz1nLmxlbmd0aCl7cz1iLl9kYXRhKGUsXCJmeHNob3dcIil8fGIuX2RhdGEoZSxcImZ4c2hvd1wiLHt9KSxcImhpZGRlblwiaW4gcyYmKG09cy5oaWRkZW4pLHUmJihzLmhpZGRlbj0hbSksbT9iKGUpLnNob3coKTpmLmRvbmUoZnVuY3Rpb24oKXtiKGUpLmhpZGUoKX0pLGYuZG9uZShmdW5jdGlvbigpe3ZhciB0O2IuX3JlbW92ZURhdGEoZSxcImZ4c2hvd1wiKTtmb3IodCBpbiBoKWIuc3R5bGUoZSx0LGhbdF0pfSk7Zm9yKGk9MDtvPmk7aSsrKXI9Z1tpXSxsPWYuY3JlYXRlVHdlZW4ocixtP3Nbcl06MCksaFtyXT1zW3JdfHxiLnN0eWxlKGUsciksciBpbiBzfHwoc1tyXT1sLnN0YXJ0LG0mJihsLmVuZD1sLnN0YXJ0LGwuc3RhcnQ9XCJ3aWR0aFwiPT09cnx8XCJoZWlnaHRcIj09PXI/MTowKSl9fWZ1bmN0aW9uIHJyKGUsdCxuLHIsaSl7cmV0dXJuIG5ldyByci5wcm90b3R5cGUuaW5pdChlLHQsbixyLGkpfWIuVHdlZW49cnIscnIucHJvdG90eXBlPXtjb25zdHJ1Y3Rvcjpycixpbml0OmZ1bmN0aW9uKGUsdCxuLHIsaSxvKXt0aGlzLmVsZW09ZSx0aGlzLnByb3A9bix0aGlzLmVhc2luZz1pfHxcInN3aW5nXCIsdGhpcy5vcHRpb25zPXQsdGhpcy5zdGFydD10aGlzLm5vdz10aGlzLmN1cigpLHRoaXMuZW5kPXIsdGhpcy51bml0PW98fChiLmNzc051bWJlcltuXT9cIlwiOlwicHhcIil9LGN1cjpmdW5jdGlvbigpe3ZhciBlPXJyLnByb3BIb29rc1t0aGlzLnByb3BdO3JldHVybiBlJiZlLmdldD9lLmdldCh0aGlzKTpyci5wcm9wSG9va3MuX2RlZmF1bHQuZ2V0KHRoaXMpfSxydW46ZnVuY3Rpb24oZSl7dmFyIHQsbj1yci5wcm9wSG9va3NbdGhpcy5wcm9wXTtyZXR1cm4gdGhpcy5wb3M9dD10aGlzLm9wdGlvbnMuZHVyYXRpb24/Yi5lYXNpbmdbdGhpcy5lYXNpbmddKGUsdGhpcy5vcHRpb25zLmR1cmF0aW9uKmUsMCwxLHRoaXMub3B0aW9ucy5kdXJhdGlvbik6ZSx0aGlzLm5vdz0odGhpcy5lbmQtdGhpcy5zdGFydCkqdCt0aGlzLnN0YXJ0LHRoaXMub3B0aW9ucy5zdGVwJiZ0aGlzLm9wdGlvbnMuc3RlcC5jYWxsKHRoaXMuZWxlbSx0aGlzLm5vdyx0aGlzKSxuJiZuLnNldD9uLnNldCh0aGlzKTpyci5wcm9wSG9va3MuX2RlZmF1bHQuc2V0KHRoaXMpLHRoaXN9fSxyci5wcm90b3R5cGUuaW5pdC5wcm90b3R5cGU9cnIucHJvdG90eXBlLHJyLnByb3BIb29rcz17X2RlZmF1bHQ6e2dldDpmdW5jdGlvbihlKXt2YXIgdDtyZXR1cm4gbnVsbD09ZS5lbGVtW2UucHJvcF18fGUuZWxlbS5zdHlsZSYmbnVsbCE9ZS5lbGVtLnN0eWxlW2UucHJvcF0/KHQ9Yi5jc3MoZS5lbGVtLGUucHJvcCxcIlwiKSx0JiZcImF1dG9cIiE9PXQ/dDowKTplLmVsZW1bZS5wcm9wXX0sc2V0OmZ1bmN0aW9uKGUpe2IuZnguc3RlcFtlLnByb3BdP2IuZnguc3RlcFtlLnByb3BdKGUpOmUuZWxlbS5zdHlsZSYmKG51bGwhPWUuZWxlbS5zdHlsZVtiLmNzc1Byb3BzW2UucHJvcF1dfHxiLmNzc0hvb2tzW2UucHJvcF0pP2Iuc3R5bGUoZS5lbGVtLGUucHJvcCxlLm5vdytlLnVuaXQpOmUuZWxlbVtlLnByb3BdPWUubm93fX19LHJyLnByb3BIb29rcy5zY3JvbGxUb3A9cnIucHJvcEhvb2tzLnNjcm9sbExlZnQ9e3NldDpmdW5jdGlvbihlKXtlLmVsZW0ubm9kZVR5cGUmJmUuZWxlbS5wYXJlbnROb2RlJiYoZS5lbGVtW2UucHJvcF09ZS5ub3cpfX0sYi5lYWNoKFtcInRvZ2dsZVwiLFwic2hvd1wiLFwiaGlkZVwiXSxmdW5jdGlvbihlLHQpe3ZhciBuPWIuZm5bdF07Yi5mblt0XT1mdW5jdGlvbihlLHIsaSl7cmV0dXJuIG51bGw9PWV8fFwiYm9vbGVhblwiPT10eXBlb2YgZT9uLmFwcGx5KHRoaXMsYXJndW1lbnRzKTp0aGlzLmFuaW1hdGUoaXIodCwhMCksZSxyLGkpfX0pLGIuZm4uZXh0ZW5kKHtmYWRlVG86ZnVuY3Rpb24oZSx0LG4scil7cmV0dXJuIHRoaXMuZmlsdGVyKG5uKS5jc3MoXCJvcGFjaXR5XCIsMCkuc2hvdygpLmVuZCgpLmFuaW1hdGUoe29wYWNpdHk6dH0sZSxuLHIpfSxhbmltYXRlOmZ1bmN0aW9uKGUsdCxuLHIpe3ZhciBpPWIuaXNFbXB0eU9iamVjdChlKSxvPWIuc3BlZWQodCxuLHIpLGE9ZnVuY3Rpb24oKXt2YXIgdD1lcih0aGlzLGIuZXh0ZW5kKHt9LGUpLG8pO2EuZmluaXNoPWZ1bmN0aW9uKCl7dC5zdG9wKCEwKX0sKGl8fGIuX2RhdGEodGhpcyxcImZpbmlzaFwiKSkmJnQuc3RvcCghMCl9O3JldHVybiBhLmZpbmlzaD1hLGl8fG8ucXVldWU9PT0hMT90aGlzLmVhY2goYSk6dGhpcy5xdWV1ZShvLnF1ZXVlLGEpfSxzdG9wOmZ1bmN0aW9uKGUsbixyKXt2YXIgaT1mdW5jdGlvbihlKXt2YXIgdD1lLnN0b3A7ZGVsZXRlIGUuc3RvcCx0KHIpfTtyZXR1cm5cInN0cmluZ1wiIT10eXBlb2YgZSYmKHI9bixuPWUsZT10KSxuJiZlIT09ITEmJnRoaXMucXVldWUoZXx8XCJmeFwiLFtdKSx0aGlzLmVhY2goZnVuY3Rpb24oKXt2YXIgdD0hMCxuPW51bGwhPWUmJmUrXCJxdWV1ZUhvb2tzXCIsbz1iLnRpbWVycyxhPWIuX2RhdGEodGhpcyk7aWYobilhW25dJiZhW25dLnN0b3AmJmkoYVtuXSk7ZWxzZSBmb3IobiBpbiBhKWFbbl0mJmFbbl0uc3RvcCYmSm4udGVzdChuKSYmaShhW25dKTtmb3Iobj1vLmxlbmd0aDtuLS07KW9bbl0uZWxlbSE9PXRoaXN8fG51bGwhPWUmJm9bbl0ucXVldWUhPT1lfHwob1tuXS5hbmltLnN0b3AociksdD0hMSxvLnNwbGljZShuLDEpKTsodHx8IXIpJiZiLmRlcXVldWUodGhpcyxlKX0pfSxmaW5pc2g6ZnVuY3Rpb24oZSl7cmV0dXJuIGUhPT0hMSYmKGU9ZXx8XCJmeFwiKSx0aGlzLmVhY2goZnVuY3Rpb24oKXt2YXIgdCxuPWIuX2RhdGEodGhpcykscj1uW2UrXCJxdWV1ZVwiXSxpPW5bZStcInF1ZXVlSG9va3NcIl0sbz1iLnRpbWVycyxhPXI/ci5sZW5ndGg6MDtmb3Iobi5maW5pc2g9ITAsYi5xdWV1ZSh0aGlzLGUsW10pLGkmJmkuY3VyJiZpLmN1ci5maW5pc2gmJmkuY3VyLmZpbmlzaC5jYWxsKHRoaXMpLHQ9by5sZW5ndGg7dC0tOylvW3RdLmVsZW09PT10aGlzJiZvW3RdLnF1ZXVlPT09ZSYmKG9bdF0uYW5pbS5zdG9wKCEwKSxvLnNwbGljZSh0LDEpKTtmb3IodD0wO2E+dDt0Kyspclt0XSYmclt0XS5maW5pc2gmJnJbdF0uZmluaXNoLmNhbGwodGhpcyk7ZGVsZXRlIG4uZmluaXNofSl9fSk7ZnVuY3Rpb24gaXIoZSx0KXt2YXIgbixyPXtoZWlnaHQ6ZX0saT0wO2Zvcih0PXQ/MTowOzQ+aTtpKz0yLXQpbj1adFtpXSxyW1wibWFyZ2luXCIrbl09cltcInBhZGRpbmdcIituXT1lO3JldHVybiB0JiYoci5vcGFjaXR5PXIud2lkdGg9ZSkscn1iLmVhY2goe3NsaWRlRG93bjppcihcInNob3dcIiksc2xpZGVVcDppcihcImhpZGVcIiksc2xpZGVUb2dnbGU6aXIoXCJ0b2dnbGVcIiksZmFkZUluOntvcGFjaXR5Olwic2hvd1wifSxmYWRlT3V0OntvcGFjaXR5OlwiaGlkZVwifSxmYWRlVG9nZ2xlOntvcGFjaXR5OlwidG9nZ2xlXCJ9fSxmdW5jdGlvbihlLHQpe2IuZm5bZV09ZnVuY3Rpb24oZSxuLHIpe3JldHVybiB0aGlzLmFuaW1hdGUodCxlLG4scil9fSksYi5zcGVlZD1mdW5jdGlvbihlLHQsbil7dmFyIHI9ZSYmXCJvYmplY3RcIj09dHlwZW9mIGU/Yi5leHRlbmQoe30sZSk6e2NvbXBsZXRlOm58fCFuJiZ0fHxiLmlzRnVuY3Rpb24oZSkmJmUsZHVyYXRpb246ZSxlYXNpbmc6biYmdHx8dCYmIWIuaXNGdW5jdGlvbih0KSYmdH07cmV0dXJuIHIuZHVyYXRpb249Yi5meC5vZmY/MDpcIm51bWJlclwiPT10eXBlb2Ygci5kdXJhdGlvbj9yLmR1cmF0aW9uOnIuZHVyYXRpb24gaW4gYi5meC5zcGVlZHM/Yi5meC5zcGVlZHNbci5kdXJhdGlvbl06Yi5meC5zcGVlZHMuX2RlZmF1bHQsKG51bGw9PXIucXVldWV8fHIucXVldWU9PT0hMCkmJihyLnF1ZXVlPVwiZnhcIiksci5vbGQ9ci5jb21wbGV0ZSxyLmNvbXBsZXRlPWZ1bmN0aW9uKCl7Yi5pc0Z1bmN0aW9uKHIub2xkKSYmci5vbGQuY2FsbCh0aGlzKSxyLnF1ZXVlJiZiLmRlcXVldWUodGhpcyxyLnF1ZXVlKX0scn0sYi5lYXNpbmc9e2xpbmVhcjpmdW5jdGlvbihlKXtyZXR1cm4gZX0sc3dpbmc6ZnVuY3Rpb24oZSl7cmV0dXJuLjUtTWF0aC5jb3MoZSpNYXRoLlBJKS8yfX0sYi50aW1lcnM9W10sYi5meD1yci5wcm90b3R5cGUuaW5pdCxiLmZ4LnRpY2s9ZnVuY3Rpb24oKXt2YXIgZSxuPWIudGltZXJzLHI9MDtmb3IoWG49Yi5ub3coKTtuLmxlbmd0aD5yO3IrKyllPW5bcl0sZSgpfHxuW3JdIT09ZXx8bi5zcGxpY2Uoci0tLDEpO24ubGVuZ3RofHxiLmZ4LnN0b3AoKSxYbj10fSxiLmZ4LnRpbWVyPWZ1bmN0aW9uKGUpe2UoKSYmYi50aW1lcnMucHVzaChlKSYmYi5meC5zdGFydCgpfSxiLmZ4LmludGVydmFsPTEzLGIuZnguc3RhcnQ9ZnVuY3Rpb24oKXtVbnx8KFVuPXNldEludGVydmFsKGIuZngudGljayxiLmZ4LmludGVydmFsKSl9LGIuZnguc3RvcD1mdW5jdGlvbigpe2NsZWFySW50ZXJ2YWwoVW4pLFVuPW51bGx9LGIuZnguc3BlZWRzPXtzbG93OjYwMCxmYXN0OjIwMCxfZGVmYXVsdDo0MDB9LGIuZnguc3RlcD17fSxiLmV4cHImJmIuZXhwci5maWx0ZXJzJiYoYi5leHByLmZpbHRlcnMuYW5pbWF0ZWQ9ZnVuY3Rpb24oZSl7cmV0dXJuIGIuZ3JlcChiLnRpbWVycyxmdW5jdGlvbih0KXtyZXR1cm4gZT09PXQuZWxlbX0pLmxlbmd0aH0pLGIuZm4ub2Zmc2V0PWZ1bmN0aW9uKGUpe2lmKGFyZ3VtZW50cy5sZW5ndGgpcmV0dXJuIGU9PT10P3RoaXM6dGhpcy5lYWNoKGZ1bmN0aW9uKHQpe2Iub2Zmc2V0LnNldE9mZnNldCh0aGlzLGUsdCl9KTt2YXIgbixyLG89e3RvcDowLGxlZnQ6MH0sYT10aGlzWzBdLHM9YSYmYS5vd25lckRvY3VtZW50O2lmKHMpcmV0dXJuIG49cy5kb2N1bWVudEVsZW1lbnQsYi5jb250YWlucyhuLGEpPyh0eXBlb2YgYS5nZXRCb3VuZGluZ0NsaWVudFJlY3QhPT1pJiYobz1hLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpKSxyPW9yKHMpLHt0b3A6by50b3ArKHIucGFnZVlPZmZzZXR8fG4uc2Nyb2xsVG9wKS0obi5jbGllbnRUb3B8fDApLGxlZnQ6by5sZWZ0KyhyLnBhZ2VYT2Zmc2V0fHxuLnNjcm9sbExlZnQpLShuLmNsaWVudExlZnR8fDApfSk6b30sYi5vZmZzZXQ9e3NldE9mZnNldDpmdW5jdGlvbihlLHQsbil7dmFyIHI9Yi5jc3MoZSxcInBvc2l0aW9uXCIpO1wic3RhdGljXCI9PT1yJiYoZS5zdHlsZS5wb3NpdGlvbj1cInJlbGF0aXZlXCIpO3ZhciBpPWIoZSksbz1pLm9mZnNldCgpLGE9Yi5jc3MoZSxcInRvcFwiKSxzPWIuY3NzKGUsXCJsZWZ0XCIpLHU9KFwiYWJzb2x1dGVcIj09PXJ8fFwiZml4ZWRcIj09PXIpJiZiLmluQXJyYXkoXCJhdXRvXCIsW2Esc10pPi0xLGw9e30sYz17fSxwLGY7dT8oYz1pLnBvc2l0aW9uKCkscD1jLnRvcCxmPWMubGVmdCk6KHA9cGFyc2VGbG9hdChhKXx8MCxmPXBhcnNlRmxvYXQocyl8fDApLGIuaXNGdW5jdGlvbih0KSYmKHQ9dC5jYWxsKGUsbixvKSksbnVsbCE9dC50b3AmJihsLnRvcD10LnRvcC1vLnRvcCtwKSxudWxsIT10LmxlZnQmJihsLmxlZnQ9dC5sZWZ0LW8ubGVmdCtmKSxcInVzaW5nXCJpbiB0P3QudXNpbmcuY2FsbChlLGwpOmkuY3NzKGwpfX0sYi5mbi5leHRlbmQoe3Bvc2l0aW9uOmZ1bmN0aW9uKCl7aWYodGhpc1swXSl7dmFyIGUsdCxuPXt0b3A6MCxsZWZ0OjB9LHI9dGhpc1swXTtyZXR1cm5cImZpeGVkXCI9PT1iLmNzcyhyLFwicG9zaXRpb25cIik/dD1yLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpOihlPXRoaXMub2Zmc2V0UGFyZW50KCksdD10aGlzLm9mZnNldCgpLGIubm9kZU5hbWUoZVswXSxcImh0bWxcIil8fChuPWUub2Zmc2V0KCkpLG4udG9wKz1iLmNzcyhlWzBdLFwiYm9yZGVyVG9wV2lkdGhcIiwhMCksbi5sZWZ0Kz1iLmNzcyhlWzBdLFwiYm9yZGVyTGVmdFdpZHRoXCIsITApKSx7dG9wOnQudG9wLW4udG9wLWIuY3NzKHIsXCJtYXJnaW5Ub3BcIiwhMCksbGVmdDp0LmxlZnQtbi5sZWZ0LWIuY3NzKHIsXCJtYXJnaW5MZWZ0XCIsITApfX19LG9mZnNldFBhcmVudDpmdW5jdGlvbigpe3JldHVybiB0aGlzLm1hcChmdW5jdGlvbigpe3ZhciBlPXRoaXMub2Zmc2V0UGFyZW50fHxvLmRvY3VtZW50RWxlbWVudDt3aGlsZShlJiYhYi5ub2RlTmFtZShlLFwiaHRtbFwiKSYmXCJzdGF0aWNcIj09PWIuY3NzKGUsXCJwb3NpdGlvblwiKSllPWUub2Zmc2V0UGFyZW50O3JldHVybiBlfHxvLmRvY3VtZW50RWxlbWVudH0pfX0pLGIuZWFjaCh7c2Nyb2xsTGVmdDpcInBhZ2VYT2Zmc2V0XCIsc2Nyb2xsVG9wOlwicGFnZVlPZmZzZXRcIn0sZnVuY3Rpb24oZSxuKXt2YXIgcj0vWS8udGVzdChuKTtiLmZuW2VdPWZ1bmN0aW9uKGkpe3JldHVybiBiLmFjY2Vzcyh0aGlzLGZ1bmN0aW9uKGUsaSxvKXt2YXIgYT1vcihlKTtyZXR1cm4gbz09PXQ/YT9uIGluIGE/YVtuXTphLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudFtpXTplW2ldOihhP2Euc2Nyb2xsVG8ocj9iKGEpLnNjcm9sbExlZnQoKTpvLHI/bzpiKGEpLnNjcm9sbFRvcCgpKTplW2ldPW8sdCl9LGUsaSxhcmd1bWVudHMubGVuZ3RoLG51bGwpfX0pO2Z1bmN0aW9uIG9yKGUpe3JldHVybiBiLmlzV2luZG93KGUpP2U6OT09PWUubm9kZVR5cGU/ZS5kZWZhdWx0Vmlld3x8ZS5wYXJlbnRXaW5kb3c6ITF9Yi5lYWNoKHtIZWlnaHQ6XCJoZWlnaHRcIixXaWR0aDpcIndpZHRoXCJ9LGZ1bmN0aW9uKGUsbil7Yi5lYWNoKHtwYWRkaW5nOlwiaW5uZXJcIitlLGNvbnRlbnQ6bixcIlwiOlwib3V0ZXJcIitlfSxmdW5jdGlvbihyLGkpe2IuZm5baV09ZnVuY3Rpb24oaSxvKXt2YXIgYT1hcmd1bWVudHMubGVuZ3RoJiYocnx8XCJib29sZWFuXCIhPXR5cGVvZiBpKSxzPXJ8fChpPT09ITB8fG89PT0hMD9cIm1hcmdpblwiOlwiYm9yZGVyXCIpO3JldHVybiBiLmFjY2Vzcyh0aGlzLGZ1bmN0aW9uKG4scixpKXt2YXIgbztyZXR1cm4gYi5pc1dpbmRvdyhuKT9uLmRvY3VtZW50LmRvY3VtZW50RWxlbWVudFtcImNsaWVudFwiK2VdOjk9PT1uLm5vZGVUeXBlPyhvPW4uZG9jdW1lbnRFbGVtZW50LE1hdGgubWF4KG4uYm9keVtcInNjcm9sbFwiK2VdLG9bXCJzY3JvbGxcIitlXSxuLmJvZHlbXCJvZmZzZXRcIitlXSxvW1wib2Zmc2V0XCIrZV0sb1tcImNsaWVudFwiK2VdKSk6aT09PXQ/Yi5jc3MobixyLHMpOmIuc3R5bGUobixyLGkscyl9LG4sYT9pOnQsYSxudWxsKX19KX0pLGUualF1ZXJ5PWUuJD1iLFwiZnVuY3Rpb25cIj09dHlwZW9mIGRlZmluZSYmZGVmaW5lLmFtZCYmZGVmaW5lLmFtZC5qUXVlcnkmJmRlZmluZShcImpxdWVyeVwiLFtdLGZ1bmN0aW9uKCl7cmV0dXJuIGJ9KX0pKHdpbmRvdyk7IiwiLypnbG9iYWwgZGVmaW5lOmZhbHNlICovXG4vKipcbiAqIENvcHlyaWdodCAyMDEzIENyYWlnIENhbXBiZWxsXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKlxuICogTW91c2V0cmFwIGlzIGEgc2ltcGxlIGtleWJvYXJkIHNob3J0Y3V0IGxpYnJhcnkgZm9yIEphdmFzY3JpcHQgd2l0aFxuICogbm8gZXh0ZXJuYWwgZGVwZW5kZW5jaWVzXG4gKlxuICogQHZlcnNpb24gMS40LjZcbiAqIEB1cmwgY3JhaWcuaXMva2lsbGluZy9taWNlXG4gKi9cbihmdW5jdGlvbih3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcblxuICAgIC8qKlxuICAgICAqIG1hcHBpbmcgb2Ygc3BlY2lhbCBrZXljb2RlcyB0byB0aGVpciBjb3JyZXNwb25kaW5nIGtleXNcbiAgICAgKlxuICAgICAqIGV2ZXJ5dGhpbmcgaW4gdGhpcyBkaWN0aW9uYXJ5IGNhbm5vdCB1c2Uga2V5cHJlc3MgZXZlbnRzXG4gICAgICogc28gaXQgaGFzIHRvIGJlIGhlcmUgdG8gbWFwIHRvIHRoZSBjb3JyZWN0IGtleWNvZGVzIGZvclxuICAgICAqIGtleXVwL2tleWRvd24gZXZlbnRzXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIHZhciBfTUFQID0ge1xuICAgICAgICAgICAgODogJ2JhY2tzcGFjZScsXG4gICAgICAgICAgICA5OiAndGFiJyxcbiAgICAgICAgICAgIDEzOiAnZW50ZXInLFxuICAgICAgICAgICAgMTY6ICdzaGlmdCcsXG4gICAgICAgICAgICAxNzogJ2N0cmwnLFxuICAgICAgICAgICAgMTg6ICdhbHQnLFxuICAgICAgICAgICAgMjA6ICdjYXBzbG9jaycsXG4gICAgICAgICAgICAyNzogJ2VzYycsXG4gICAgICAgICAgICAzMjogJ3NwYWNlJyxcbiAgICAgICAgICAgIDMzOiAncGFnZXVwJyxcbiAgICAgICAgICAgIDM0OiAncGFnZWRvd24nLFxuICAgICAgICAgICAgMzU6ICdlbmQnLFxuICAgICAgICAgICAgMzY6ICdob21lJyxcbiAgICAgICAgICAgIDM3OiAnbGVmdCcsXG4gICAgICAgICAgICAzODogJ3VwJyxcbiAgICAgICAgICAgIDM5OiAncmlnaHQnLFxuICAgICAgICAgICAgNDA6ICdkb3duJyxcbiAgICAgICAgICAgIDQ1OiAnaW5zJyxcbiAgICAgICAgICAgIDQ2OiAnZGVsJyxcbiAgICAgICAgICAgIDkxOiAnbWV0YScsXG4gICAgICAgICAgICA5MzogJ21ldGEnLFxuICAgICAgICAgICAgMjI0OiAnbWV0YSdcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogbWFwcGluZyBmb3Igc3BlY2lhbCBjaGFyYWN0ZXJzIHNvIHRoZXkgY2FuIHN1cHBvcnRcbiAgICAgICAgICpcbiAgICAgICAgICogdGhpcyBkaWN0aW9uYXJ5IGlzIG9ubHkgdXNlZCBpbmNhc2UgeW91IHdhbnQgdG8gYmluZCBhXG4gICAgICAgICAqIGtleXVwIG9yIGtleWRvd24gZXZlbnQgdG8gb25lIG9mIHRoZXNlIGtleXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIF9LRVlDT0RFX01BUCA9IHtcbiAgICAgICAgICAgIDEwNjogJyonLFxuICAgICAgICAgICAgMTA3OiAnKycsXG4gICAgICAgICAgICAxMDk6ICctJyxcbiAgICAgICAgICAgIDExMDogJy4nLFxuICAgICAgICAgICAgMTExIDogJy8nLFxuICAgICAgICAgICAgMTg2OiAnOycsXG4gICAgICAgICAgICAxODc6ICc9JyxcbiAgICAgICAgICAgIDE4ODogJywnLFxuICAgICAgICAgICAgMTg5OiAnLScsXG4gICAgICAgICAgICAxOTA6ICcuJyxcbiAgICAgICAgICAgIDE5MTogJy8nLFxuICAgICAgICAgICAgMTkyOiAnYCcsXG4gICAgICAgICAgICAyMTk6ICdbJyxcbiAgICAgICAgICAgIDIyMDogJ1xcXFwnLFxuICAgICAgICAgICAgMjIxOiAnXScsXG4gICAgICAgICAgICAyMjI6ICdcXCcnXG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRoaXMgaXMgYSBtYXBwaW5nIG9mIGtleXMgdGhhdCByZXF1aXJlIHNoaWZ0IG9uIGEgVVMga2V5cGFkXG4gICAgICAgICAqIGJhY2sgdG8gdGhlIG5vbiBzaGlmdCBlcXVpdmVsZW50c1xuICAgICAgICAgKlxuICAgICAgICAgKiB0aGlzIGlzIHNvIHlvdSBjYW4gdXNlIGtleXVwIGV2ZW50cyB3aXRoIHRoZXNlIGtleXNcbiAgICAgICAgICpcbiAgICAgICAgICogbm90ZSB0aGF0IHRoaXMgd2lsbCBvbmx5IHdvcmsgcmVsaWFibHkgb24gVVMga2V5Ym9hcmRzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBfU0hJRlRfTUFQID0ge1xuICAgICAgICAgICAgJ34nOiAnYCcsXG4gICAgICAgICAgICAnISc6ICcxJyxcbiAgICAgICAgICAgICdAJzogJzInLFxuICAgICAgICAgICAgJyMnOiAnMycsXG4gICAgICAgICAgICAnJCc6ICc0JyxcbiAgICAgICAgICAgICclJzogJzUnLFxuICAgICAgICAgICAgJ14nOiAnNicsXG4gICAgICAgICAgICAnJic6ICc3JyxcbiAgICAgICAgICAgICcqJzogJzgnLFxuICAgICAgICAgICAgJygnOiAnOScsXG4gICAgICAgICAgICAnKSc6ICcwJyxcbiAgICAgICAgICAgICdfJzogJy0nLFxuICAgICAgICAgICAgJysnOiAnPScsXG4gICAgICAgICAgICAnOic6ICc7JyxcbiAgICAgICAgICAgICdcXFwiJzogJ1xcJycsXG4gICAgICAgICAgICAnPCc6ICcsJyxcbiAgICAgICAgICAgICc+JzogJy4nLFxuICAgICAgICAgICAgJz8nOiAnLycsXG4gICAgICAgICAgICAnfCc6ICdcXFxcJ1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB0aGlzIGlzIGEgbGlzdCBvZiBzcGVjaWFsIHN0cmluZ3MgeW91IGNhbiB1c2UgdG8gbWFwXG4gICAgICAgICAqIHRvIG1vZGlmaWVyIGtleXMgd2hlbiB5b3Ugc3BlY2lmeSB5b3VyIGtleWJvYXJkIHNob3J0Y3V0c1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgX1NQRUNJQUxfQUxJQVNFUyA9IHtcbiAgICAgICAgICAgICdvcHRpb24nOiAnYWx0JyxcbiAgICAgICAgICAgICdjb21tYW5kJzogJ21ldGEnLFxuICAgICAgICAgICAgJ3JldHVybic6ICdlbnRlcicsXG4gICAgICAgICAgICAnZXNjYXBlJzogJ2VzYycsXG4gICAgICAgICAgICAnbW9kJzogL01hY3xpUG9kfGlQaG9uZXxpUGFkLy50ZXN0KG5hdmlnYXRvci5wbGF0Zm9ybSkgPyAnbWV0YScgOiAnY3RybCdcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdmFyaWFibGUgdG8gc3RvcmUgdGhlIGZsaXBwZWQgdmVyc2lvbiBvZiBfTUFQIGZyb20gYWJvdmVcbiAgICAgICAgICogbmVlZGVkIHRvIGNoZWNrIGlmIHdlIHNob3VsZCB1c2Uga2V5cHJlc3Mgb3Igbm90IHdoZW4gbm8gYWN0aW9uXG4gICAgICAgICAqIGlzIHNwZWNpZmllZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fHVuZGVmaW5lZH1cbiAgICAgICAgICovXG4gICAgICAgIF9SRVZFUlNFX01BUCxcblxuICAgICAgICAvKipcbiAgICAgICAgICogYSBsaXN0IG9mIGFsbCB0aGUgY2FsbGJhY2tzIHNldHVwIHZpYSBNb3VzZXRyYXAuYmluZCgpXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBfY2FsbGJhY2tzID0ge30sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRpcmVjdCBtYXAgb2Ygc3RyaW5nIGNvbWJpbmF0aW9ucyB0byBjYWxsYmFja3MgdXNlZCBmb3IgdHJpZ2dlcigpXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBfZGlyZWN0TWFwID0ge30sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGtlZXBzIHRyYWNrIG9mIHdoYXQgbGV2ZWwgZWFjaCBzZXF1ZW5jZSBpcyBhdCBzaW5jZSBtdWx0aXBsZVxuICAgICAgICAgKiBzZXF1ZW5jZXMgY2FuIHN0YXJ0IG91dCB3aXRoIHRoZSBzYW1lIHNlcXVlbmNlXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBfc2VxdWVuY2VMZXZlbHMgPSB7fSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdmFyaWFibGUgdG8gc3RvcmUgdGhlIHNldFRpbWVvdXQgY2FsbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVsbHxudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICBfcmVzZXRUaW1lcixcblxuICAgICAgICAvKipcbiAgICAgICAgICogdGVtcG9yYXJ5IHN0YXRlIHdoZXJlIHdlIHdpbGwgaWdub3JlIHRoZSBuZXh0IGtleXVwXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufHN0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIF9pZ25vcmVOZXh0S2V5dXAgPSBmYWxzZSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdGVtcG9yYXJ5IHN0YXRlIHdoZXJlIHdlIHdpbGwgaWdub3JlIHRoZSBuZXh0IGtleXByZXNzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgX2lnbm9yZU5leHRLZXlwcmVzcyA9IGZhbHNlLFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBhcmUgd2UgY3VycmVudGx5IGluc2lkZSBvZiBhIHNlcXVlbmNlP1xuICAgICAgICAgKiB0eXBlIG9mIGFjdGlvbiAoXCJrZXl1cFwiIG9yIFwia2V5ZG93blwiIG9yIFwia2V5cHJlc3NcIikgb3IgZmFsc2VcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW58c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgX25leHRFeHBlY3RlZEFjdGlvbiA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogbG9vcCB0aHJvdWdoIHRoZSBmIGtleXMsIGYxIHRvIGYxOSBhbmQgYWRkIHRoZW0gdG8gdGhlIG1hcFxuICAgICAqIHByb2dyYW1hdGljYWxseVxuICAgICAqL1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgMjA7ICsraSkge1xuICAgICAgICBfTUFQWzExMSArIGldID0gJ2YnICsgaTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBsb29wIHRocm91Z2ggdG8gbWFwIG51bWJlcnMgb24gdGhlIG51bWVyaWMga2V5cGFkXG4gICAgICovXG4gICAgZm9yIChpID0gMDsgaSA8PSA5OyArK2kpIHtcbiAgICAgICAgX01BUFtpICsgOTZdID0gaTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjcm9zcyBicm93c2VyIGFkZCBldmVudCBtZXRob2RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudHxIVE1MRG9jdW1lbnR9IG9iamVjdFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2FkZEV2ZW50KG9iamVjdCwgdHlwZSwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKG9iamVjdC5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgICAgICBvYmplY3QuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjaywgZmFsc2UpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgb2JqZWN0LmF0dGFjaEV2ZW50KCdvbicgKyB0eXBlLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdGFrZXMgdGhlIGV2ZW50IGFuZCByZXR1cm5zIHRoZSBrZXkgY2hhcmFjdGVyXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9jaGFyYWN0ZXJGcm9tRXZlbnQoZSkge1xuXG4gICAgICAgIC8vIGZvciBrZXlwcmVzcyBldmVudHMgd2Ugc2hvdWxkIHJldHVybiB0aGUgY2hhcmFjdGVyIGFzIGlzXG4gICAgICAgIGlmIChlLnR5cGUgPT0gJ2tleXByZXNzJykge1xuICAgICAgICAgICAgdmFyIGNoYXJhY3RlciA9IFN0cmluZy5mcm9tQ2hhckNvZGUoZS53aGljaCk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBzaGlmdCBrZXkgaXMgbm90IHByZXNzZWQgdGhlbiBpdCBpcyBzYWZlIHRvIGFzc3VtZVxuICAgICAgICAgICAgLy8gdGhhdCB3ZSB3YW50IHRoZSBjaGFyYWN0ZXIgdG8gYmUgbG93ZXJjYXNlLiAgdGhpcyBtZWFucyBpZlxuICAgICAgICAgICAgLy8geW91IGFjY2lkZW50YWxseSBoYXZlIGNhcHMgbG9jayBvbiB0aGVuIHlvdXIga2V5IGJpbmRpbmdzXG4gICAgICAgICAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyB0aGUgb25seSBzaWRlIGVmZmVjdCB0aGF0IG1pZ2h0IG5vdCBiZSBkZXNpcmVkIGlzIGlmIHlvdVxuICAgICAgICAgICAgLy8gYmluZCBzb21ldGhpbmcgbGlrZSAnQScgY2F1c2UgeW91IHdhbnQgdG8gdHJpZ2dlciBhblxuICAgICAgICAgICAgLy8gZXZlbnQgd2hlbiBjYXBpdGFsIEEgaXMgcHJlc3NlZCBjYXBzIGxvY2sgd2lsbCBubyBsb25nZXJcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgdGhlIGV2ZW50LiAgc2hpZnQrYSB3aWxsIHRob3VnaC5cbiAgICAgICAgICAgIGlmICghZS5zaGlmdEtleSkge1xuICAgICAgICAgICAgICAgIGNoYXJhY3RlciA9IGNoYXJhY3Rlci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY2hhcmFjdGVyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yIG5vbiBrZXlwcmVzcyBldmVudHMgdGhlIHNwZWNpYWwgbWFwcyBhcmUgbmVlZGVkXG4gICAgICAgIGlmIChfTUFQW2Uud2hpY2hdKSB7XG4gICAgICAgICAgICByZXR1cm4gX01BUFtlLndoaWNoXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfS0VZQ09ERV9NQVBbZS53aGljaF0pIHtcbiAgICAgICAgICAgIHJldHVybiBfS0VZQ09ERV9NQVBbZS53aGljaF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBpdCBpcyBub3QgaW4gdGhlIHNwZWNpYWwgbWFwXG5cbiAgICAgICAgLy8gd2l0aCBrZXlkb3duIGFuZCBrZXl1cCBldmVudHMgdGhlIGNoYXJhY3RlciBzZWVtcyB0byBhbHdheXNcbiAgICAgICAgLy8gY29tZSBpbiBhcyBhbiB1cHBlcmNhc2UgY2hhcmFjdGVyIHdoZXRoZXIgeW91IGFyZSBwcmVzc2luZyBzaGlmdFxuICAgICAgICAvLyBvciBub3QuICB3ZSBzaG91bGQgbWFrZSBzdXJlIGl0IGlzIGFsd2F5cyBsb3dlcmNhc2UgZm9yIGNvbXBhcmlzb25zXG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGUud2hpY2gpLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2hlY2tzIGlmIHR3byBhcnJheXMgYXJlIGVxdWFsXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBtb2RpZmllcnMxXG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzMlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9tb2RpZmllcnNNYXRjaChtb2RpZmllcnMxLCBtb2RpZmllcnMyKSB7XG4gICAgICAgIHJldHVybiBtb2RpZmllcnMxLnNvcnQoKS5qb2luKCcsJykgPT09IG1vZGlmaWVyczIuc29ydCgpLmpvaW4oJywnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXNldHMgYWxsIHNlcXVlbmNlIGNvdW50ZXJzIGV4Y2VwdCBmb3IgdGhlIG9uZXMgcGFzc2VkIGluXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZG9Ob3RSZXNldFxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfcmVzZXRTZXF1ZW5jZXMoZG9Ob3RSZXNldCkge1xuICAgICAgICBkb05vdFJlc2V0ID0gZG9Ob3RSZXNldCB8fCB7fTtcblxuICAgICAgICB2YXIgYWN0aXZlU2VxdWVuY2VzID0gZmFsc2UsXG4gICAgICAgICAgICBrZXk7XG5cbiAgICAgICAgZm9yIChrZXkgaW4gX3NlcXVlbmNlTGV2ZWxzKSB7XG4gICAgICAgICAgICBpZiAoZG9Ob3RSZXNldFtrZXldKSB7XG4gICAgICAgICAgICAgICAgYWN0aXZlU2VxdWVuY2VzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF9zZXF1ZW5jZUxldmVsc1trZXldID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghYWN0aXZlU2VxdWVuY2VzKSB7XG4gICAgICAgICAgICBfbmV4dEV4cGVjdGVkQWN0aW9uID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBmaW5kcyBhbGwgY2FsbGJhY2tzIHRoYXQgbWF0Y2ggYmFzZWQgb24gdGhlIGtleWNvZGUsIG1vZGlmaWVycyxcbiAgICAgKiBhbmQgYWN0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhcmFjdGVyXG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzXG4gICAgICogQHBhcmFtIHtFdmVudHxPYmplY3R9IGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZz19IHNlcXVlbmNlTmFtZSAtIG5hbWUgb2YgdGhlIHNlcXVlbmNlIHdlIGFyZSBsb29raW5nIGZvclxuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gY29tYmluYXRpb25cbiAgICAgKiBAcGFyYW0ge251bWJlcj19IGxldmVsXG4gICAgICogQHJldHVybnMge0FycmF5fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9nZXRNYXRjaGVzKGNoYXJhY3RlciwgbW9kaWZpZXJzLCBlLCBzZXF1ZW5jZU5hbWUsIGNvbWJpbmF0aW9uLCBsZXZlbCkge1xuICAgICAgICB2YXIgaSxcbiAgICAgICAgICAgIGNhbGxiYWNrLFxuICAgICAgICAgICAgbWF0Y2hlcyA9IFtdLFxuICAgICAgICAgICAgYWN0aW9uID0gZS50eXBlO1xuXG4gICAgICAgIC8vIGlmIHRoZXJlIGFyZSBubyBldmVudHMgcmVsYXRlZCB0byB0aGlzIGtleWNvZGVcbiAgICAgICAgaWYgKCFfY2FsbGJhY2tzW2NoYXJhY3Rlcl0pIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGlmIGEgbW9kaWZpZXIga2V5IGlzIGNvbWluZyB1cCBvbiBpdHMgb3duIHdlIHNob3VsZCBhbGxvdyBpdFxuICAgICAgICBpZiAoYWN0aW9uID09ICdrZXl1cCcgJiYgX2lzTW9kaWZpZXIoY2hhcmFjdGVyKSkge1xuICAgICAgICAgICAgbW9kaWZpZXJzID0gW2NoYXJhY3Rlcl07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb29wIHRocm91Z2ggYWxsIGNhbGxiYWNrcyBmb3IgdGhlIGtleSB0aGF0IHdhcyBwcmVzc2VkXG4gICAgICAgIC8vIGFuZCBzZWUgaWYgYW55IG9mIHRoZW0gbWF0Y2hcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IF9jYWxsYmFja3NbY2hhcmFjdGVyXS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY2FsbGJhY2sgPSBfY2FsbGJhY2tzW2NoYXJhY3Rlcl1baV07XG5cbiAgICAgICAgICAgIC8vIGlmIGEgc2VxdWVuY2UgbmFtZSBpcyBub3Qgc3BlY2lmaWVkLCBidXQgdGhpcyBpcyBhIHNlcXVlbmNlIGF0XG4gICAgICAgICAgICAvLyB0aGUgd3JvbmcgbGV2ZWwgdGhlbiBtb3ZlIG9udG8gdGhlIG5leHQgbWF0Y2hcbiAgICAgICAgICAgIGlmICghc2VxdWVuY2VOYW1lICYmIGNhbGxiYWNrLnNlcSAmJiBfc2VxdWVuY2VMZXZlbHNbY2FsbGJhY2suc2VxXSAhPSBjYWxsYmFjay5sZXZlbCkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGUgYWN0aW9uIHdlIGFyZSBsb29raW5nIGZvciBkb2Vzbid0IG1hdGNoIHRoZSBhY3Rpb24gd2UgZ290XG4gICAgICAgICAgICAvLyB0aGVuIHdlIHNob3VsZCBrZWVwIGdvaW5nXG4gICAgICAgICAgICBpZiAoYWN0aW9uICE9IGNhbGxiYWNrLmFjdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGEga2V5cHJlc3MgZXZlbnQgYW5kIHRoZSBtZXRhIGtleSBhbmQgY29udHJvbCBrZXlcbiAgICAgICAgICAgIC8vIGFyZSBub3QgcHJlc3NlZCB0aGF0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byBvbmx5IGxvb2sgYXQgdGhlXG4gICAgICAgICAgICAvLyBjaGFyYWN0ZXIsIG90aGVyd2lzZSBjaGVjayB0aGUgbW9kaWZpZXJzIGFzIHdlbGxcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBjaHJvbWUgd2lsbCBub3QgZmlyZSBhIGtleXByZXNzIGlmIG1ldGEgb3IgY29udHJvbCBpcyBkb3duXG4gICAgICAgICAgICAvLyBzYWZhcmkgd2lsbCBmaXJlIGEga2V5cHJlc3MgaWYgbWV0YSBvciBtZXRhK3NoaWZ0IGlzIGRvd25cbiAgICAgICAgICAgIC8vIGZpcmVmb3ggd2lsbCBmaXJlIGEga2V5cHJlc3MgaWYgbWV0YSBvciBjb250cm9sIGlzIGRvd25cbiAgICAgICAgICAgIGlmICgoYWN0aW9uID09ICdrZXlwcmVzcycgJiYgIWUubWV0YUtleSAmJiAhZS5jdHJsS2V5KSB8fCBfbW9kaWZpZXJzTWF0Y2gobW9kaWZpZXJzLCBjYWxsYmFjay5tb2RpZmllcnMpKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB3aGVuIHlvdSBiaW5kIGEgY29tYmluYXRpb24gb3Igc2VxdWVuY2UgYSBzZWNvbmQgdGltZSBpdFxuICAgICAgICAgICAgICAgIC8vIHNob3VsZCBvdmVyd3JpdGUgdGhlIGZpcnN0IG9uZS4gIGlmIGEgc2VxdWVuY2VOYW1lIG9yXG4gICAgICAgICAgICAgICAgLy8gY29tYmluYXRpb24gaXMgc3BlY2lmaWVkIGluIHRoaXMgY2FsbCBpdCBkb2VzIGp1c3QgdGhhdFxuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gQHRvZG8gbWFrZSBkZWxldGluZyBpdHMgb3duIG1ldGhvZD9cbiAgICAgICAgICAgICAgICB2YXIgZGVsZXRlQ29tYm8gPSAhc2VxdWVuY2VOYW1lICYmIGNhbGxiYWNrLmNvbWJvID09IGNvbWJpbmF0aW9uO1xuICAgICAgICAgICAgICAgIHZhciBkZWxldGVTZXF1ZW5jZSA9IHNlcXVlbmNlTmFtZSAmJiBjYWxsYmFjay5zZXEgPT0gc2VxdWVuY2VOYW1lICYmIGNhbGxiYWNrLmxldmVsID09IGxldmVsO1xuICAgICAgICAgICAgICAgIGlmIChkZWxldGVDb21ibyB8fCBkZWxldGVTZXF1ZW5jZSkge1xuICAgICAgICAgICAgICAgICAgICBfY2FsbGJhY2tzW2NoYXJhY3Rlcl0uc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1hdGNoZXMucHVzaChjYWxsYmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbWF0Y2hlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB0YWtlcyBhIGtleSBldmVudCBhbmQgZmlndXJlcyBvdXQgd2hhdCB0aGUgbW9kaWZpZXJzIGFyZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZXZlbnRNb2RpZmllcnMoZSkge1xuICAgICAgICB2YXIgbW9kaWZpZXJzID0gW107XG5cbiAgICAgICAgaWYgKGUuc2hpZnRLZXkpIHtcbiAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKCdzaGlmdCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGUuYWx0S2V5KSB7XG4gICAgICAgICAgICBtb2RpZmllcnMucHVzaCgnYWx0Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZS5jdHJsS2V5KSB7XG4gICAgICAgICAgICBtb2RpZmllcnMucHVzaCgnY3RybCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGUubWV0YUtleSkge1xuICAgICAgICAgICAgbW9kaWZpZXJzLnB1c2goJ21ldGEnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtb2RpZmllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcHJldmVudHMgZGVmYXVsdCBmb3IgdGhpcyBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfcHJldmVudERlZmF1bHQoZSkge1xuICAgICAgICBpZiAoZS5wcmV2ZW50RGVmYXVsdCkge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZS5yZXR1cm5WYWx1ZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHN0b3BzIHByb3BvZ2F0aW9uIGZvciB0aGlzIGV2ZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9zdG9wUHJvcGFnYXRpb24oZSkge1xuICAgICAgICBpZiAoZS5zdG9wUHJvcGFnYXRpb24pIHtcbiAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBlLmNhbmNlbEJ1YmJsZSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYWN0dWFsbHkgY2FsbHMgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAgICpcbiAgICAgKiBpZiB5b3VyIGNhbGxiYWNrIGZ1bmN0aW9uIHJldHVybnMgZmFsc2UgdGhpcyB3aWxsIHVzZSB0aGUganF1ZXJ5XG4gICAgICogY29udmVudGlvbiAtIHByZXZlbnQgZGVmYXVsdCBhbmQgc3RvcCBwcm9wb2dhdGlvbiBvbiB0aGUgZXZlbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZmlyZUNhbGxiYWNrKGNhbGxiYWNrLCBlLCBjb21ibywgc2VxdWVuY2UpIHtcblxuICAgICAgICAvLyBpZiB0aGlzIGV2ZW50IHNob3VsZCBub3QgaGFwcGVuIHN0b3AgaGVyZVxuICAgICAgICBpZiAoTW91c2V0cmFwLnN0b3BDYWxsYmFjayhlLCBlLnRhcmdldCB8fCBlLnNyY0VsZW1lbnQsIGNvbWJvLCBzZXF1ZW5jZSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjYWxsYmFjayhlLCBjb21ibykgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBfcHJldmVudERlZmF1bHQoZSk7XG4gICAgICAgICAgICBfc3RvcFByb3BhZ2F0aW9uKGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogaGFuZGxlcyBhIGNoYXJhY3RlciBrZXkgZXZlbnRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaGFyYWN0ZXJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBtb2RpZmllcnNcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9oYW5kbGVLZXkoY2hhcmFjdGVyLCBtb2RpZmllcnMsIGUpIHtcbiAgICAgICAgdmFyIGNhbGxiYWNrcyA9IF9nZXRNYXRjaGVzKGNoYXJhY3RlciwgbW9kaWZpZXJzLCBlKSxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICBkb05vdFJlc2V0ID0ge30sXG4gICAgICAgICAgICBtYXhMZXZlbCA9IDAsXG4gICAgICAgICAgICBwcm9jZXNzZWRTZXF1ZW5jZUNhbGxiYWNrID0gZmFsc2U7XG5cbiAgICAgICAgLy8gQ2FsY3VsYXRlIHRoZSBtYXhMZXZlbCBmb3Igc2VxdWVuY2VzIHNvIHdlIGNhbiBvbmx5IGV4ZWN1dGUgdGhlIGxvbmdlc3QgY2FsbGJhY2sgc2VxdWVuY2VcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrc1tpXS5zZXEpIHtcbiAgICAgICAgICAgICAgICBtYXhMZXZlbCA9IE1hdGgubWF4KG1heExldmVsLCBjYWxsYmFja3NbaV0ubGV2ZWwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9vcCB0aHJvdWdoIG1hdGNoaW5nIGNhbGxiYWNrcyBmb3IgdGhpcyBrZXkgZXZlbnRcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNhbGxiYWNrcy5sZW5ndGg7ICsraSkge1xuXG4gICAgICAgICAgICAvLyBmaXJlIGZvciBhbGwgc2VxdWVuY2UgY2FsbGJhY2tzXG4gICAgICAgICAgICAvLyB0aGlzIGlzIGJlY2F1c2UgaWYgZm9yIGV4YW1wbGUgeW91IGhhdmUgbXVsdGlwbGUgc2VxdWVuY2VzXG4gICAgICAgICAgICAvLyBib3VuZCBzdWNoIGFzIFwiZyBpXCIgYW5kIFwiZyB0XCIgdGhleSBib3RoIG5lZWQgdG8gZmlyZSB0aGVcbiAgICAgICAgICAgIC8vIGNhbGxiYWNrIGZvciBtYXRjaGluZyBnIGNhdXNlIG90aGVyd2lzZSB5b3UgY2FuIG9ubHkgZXZlclxuICAgICAgICAgICAgLy8gbWF0Y2ggdGhlIGZpcnN0IG9uZVxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrc1tpXS5zZXEpIHtcblxuICAgICAgICAgICAgICAgIC8vIG9ubHkgZmlyZSBjYWxsYmFja3MgZm9yIHRoZSBtYXhMZXZlbCB0byBwcmV2ZW50XG4gICAgICAgICAgICAgICAgLy8gc3Vic2VxdWVuY2VzIGZyb20gYWxzbyBmaXJpbmdcbiAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgIC8vIGZvciBleGFtcGxlICdhIG9wdGlvbiBiJyBzaG91bGQgbm90IGNhdXNlICdvcHRpb24gYicgdG8gZmlyZVxuICAgICAgICAgICAgICAgIC8vIGV2ZW4gdGhvdWdoICdvcHRpb24gYicgaXMgcGFydCBvZiB0aGUgb3RoZXIgc2VxdWVuY2VcbiAgICAgICAgICAgICAgICAvL1xuICAgICAgICAgICAgICAgIC8vIGFueSBzZXF1ZW5jZXMgdGhhdCBkbyBub3QgbWF0Y2ggaGVyZSB3aWxsIGJlIGRpc2NhcmRlZFxuICAgICAgICAgICAgICAgIC8vIGJlbG93IGJ5IHRoZSBfcmVzZXRTZXF1ZW5jZXMgY2FsbFxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFja3NbaV0ubGV2ZWwgIT0gbWF4TGV2ZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcHJvY2Vzc2VkU2VxdWVuY2VDYWxsYmFjayA9IHRydWU7XG5cbiAgICAgICAgICAgICAgICAvLyBrZWVwIGEgbGlzdCBvZiB3aGljaCBzZXF1ZW5jZXMgd2VyZSBtYXRjaGVzIGZvciBsYXRlclxuICAgICAgICAgICAgICAgIGRvTm90UmVzZXRbY2FsbGJhY2tzW2ldLnNlcV0gPSAxO1xuICAgICAgICAgICAgICAgIF9maXJlQ2FsbGJhY2soY2FsbGJhY2tzW2ldLmNhbGxiYWNrLCBlLCBjYWxsYmFja3NbaV0uY29tYm8sIGNhbGxiYWNrc1tpXS5zZXEpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGVyZSB3ZXJlIG5vIHNlcXVlbmNlIG1hdGNoZXMgYnV0IHdlIGFyZSBzdGlsbCBoZXJlXG4gICAgICAgICAgICAvLyB0aGF0IG1lYW5zIHRoaXMgaXMgYSByZWd1bGFyIG1hdGNoIHNvIHdlIHNob3VsZCBmaXJlIHRoYXRcbiAgICAgICAgICAgIGlmICghcHJvY2Vzc2VkU2VxdWVuY2VDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIF9maXJlQ2FsbGJhY2soY2FsbGJhY2tzW2ldLmNhbGxiYWNrLCBlLCBjYWxsYmFja3NbaV0uY29tYm8pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIGtleSB5b3UgcHJlc3NlZCBtYXRjaGVzIHRoZSB0eXBlIG9mIHNlcXVlbmNlIHdpdGhvdXRcbiAgICAgICAgLy8gYmVpbmcgYSBtb2RpZmllciAoaWUgXCJrZXl1cFwiIG9yIFwia2V5cHJlc3NcIikgdGhlbiB3ZSBzaG91bGRcbiAgICAgICAgLy8gcmVzZXQgYWxsIHNlcXVlbmNlcyB0aGF0IHdlcmUgbm90IG1hdGNoZWQgYnkgdGhpcyBldmVudFxuICAgICAgICAvL1xuICAgICAgICAvLyB0aGlzIGlzIHNvLCBmb3IgZXhhbXBsZSwgaWYgeW91IGhhdmUgdGhlIHNlcXVlbmNlIFwiaCBhIHRcIiBhbmQgeW91XG4gICAgICAgIC8vIHR5cGUgXCJoIGUgYSByIHRcIiBpdCBkb2VzIG5vdCBtYXRjaC4gIGluIHRoaXMgY2FzZSB0aGUgXCJlXCIgd2lsbFxuICAgICAgICAvLyBjYXVzZSB0aGUgc2VxdWVuY2UgdG8gcmVzZXRcbiAgICAgICAgLy9cbiAgICAgICAgLy8gbW9kaWZpZXIga2V5cyBhcmUgaWdub3JlZCBiZWNhdXNlIHlvdSBjYW4gaGF2ZSBhIHNlcXVlbmNlXG4gICAgICAgIC8vIHRoYXQgY29udGFpbnMgbW9kaWZpZXJzIHN1Y2ggYXMgXCJlbnRlciBjdHJsK3NwYWNlXCIgYW5kIGluIG1vc3RcbiAgICAgICAgLy8gY2FzZXMgdGhlIG1vZGlmaWVyIGtleSB3aWxsIGJlIHByZXNzZWQgYmVmb3JlIHRoZSBuZXh0IGtleVxuICAgICAgICAvL1xuICAgICAgICAvLyBhbHNvIGlmIHlvdSBoYXZlIGEgc2VxdWVuY2Ugc3VjaCBhcyBcImN0cmwrYiBhXCIgdGhlbiBwcmVzc2luZyB0aGVcbiAgICAgICAgLy8gXCJiXCIga2V5IHdpbGwgdHJpZ2dlciBhIFwia2V5cHJlc3NcIiBhbmQgYSBcImtleWRvd25cIlxuICAgICAgICAvL1xuICAgICAgICAvLyB0aGUgXCJrZXlkb3duXCIgaXMgZXhwZWN0ZWQgd2hlbiB0aGVyZSBpcyBhIG1vZGlmaWVyLCBidXQgdGhlXG4gICAgICAgIC8vIFwia2V5cHJlc3NcIiBlbmRzIHVwIG1hdGNoaW5nIHRoZSBfbmV4dEV4cGVjdGVkQWN0aW9uIHNpbmNlIGl0IG9jY3Vyc1xuICAgICAgICAvLyBhZnRlciBhbmQgdGhhdCBjYXVzZXMgdGhlIHNlcXVlbmNlIHRvIHJlc2V0XG4gICAgICAgIC8vXG4gICAgICAgIC8vIHdlIGlnbm9yZSBrZXlwcmVzc2VzIGluIGEgc2VxdWVuY2UgdGhhdCBkaXJlY3RseSBmb2xsb3cgYSBrZXlkb3duXG4gICAgICAgIC8vIGZvciB0aGUgc2FtZSBjaGFyYWN0ZXJcbiAgICAgICAgdmFyIGlnbm9yZVRoaXNLZXlwcmVzcyA9IGUudHlwZSA9PSAna2V5cHJlc3MnICYmIF9pZ25vcmVOZXh0S2V5cHJlc3M7XG4gICAgICAgIGlmIChlLnR5cGUgPT0gX25leHRFeHBlY3RlZEFjdGlvbiAmJiAhX2lzTW9kaWZpZXIoY2hhcmFjdGVyKSAmJiAhaWdub3JlVGhpc0tleXByZXNzKSB7XG4gICAgICAgICAgICBfcmVzZXRTZXF1ZW5jZXMoZG9Ob3RSZXNldCk7XG4gICAgICAgIH1cblxuICAgICAgICBfaWdub3JlTmV4dEtleXByZXNzID0gcHJvY2Vzc2VkU2VxdWVuY2VDYWxsYmFjayAmJiBlLnR5cGUgPT0gJ2tleWRvd24nO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGhhbmRsZXMgYSBrZXlkb3duIGV2ZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9oYW5kbGVLZXlFdmVudChlKSB7XG5cbiAgICAgICAgLy8gbm9ybWFsaXplIGUud2hpY2ggZm9yIGtleSBldmVudHNcbiAgICAgICAgLy8gQHNlZSBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzQyODU2MjcvamF2YXNjcmlwdC1rZXljb2RlLXZzLWNoYXJjb2RlLXV0dGVyLWNvbmZ1c2lvblxuICAgICAgICBpZiAodHlwZW9mIGUud2hpY2ggIT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBlLndoaWNoID0gZS5rZXlDb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNoYXJhY3RlciA9IF9jaGFyYWN0ZXJGcm9tRXZlbnQoZSk7XG5cbiAgICAgICAgLy8gbm8gY2hhcmFjdGVyIGZvdW5kIHRoZW4gc3RvcFxuICAgICAgICBpZiAoIWNoYXJhY3Rlcikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbmVlZCB0byB1c2UgPT09IGZvciB0aGUgY2hhcmFjdGVyIGNoZWNrIGJlY2F1c2UgdGhlIGNoYXJhY3RlciBjYW4gYmUgMFxuICAgICAgICBpZiAoZS50eXBlID09ICdrZXl1cCcgJiYgX2lnbm9yZU5leHRLZXl1cCA9PT0gY2hhcmFjdGVyKSB7XG4gICAgICAgICAgICBfaWdub3JlTmV4dEtleXVwID0gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBNb3VzZXRyYXAuaGFuZGxlS2V5KGNoYXJhY3RlciwgX2V2ZW50TW9kaWZpZXJzKGUpLCBlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBkZXRlcm1pbmVzIGlmIHRoZSBrZXljb2RlIHNwZWNpZmllZCBpcyBhIG1vZGlmaWVyIGtleSBvciBub3RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfaXNNb2RpZmllcihrZXkpIHtcbiAgICAgICAgcmV0dXJuIGtleSA9PSAnc2hpZnQnIHx8IGtleSA9PSAnY3RybCcgfHwga2V5ID09ICdhbHQnIHx8IGtleSA9PSAnbWV0YSc7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2FsbGVkIHRvIHNldCBhIDEgc2Vjb25kIHRpbWVvdXQgb24gdGhlIHNwZWNpZmllZCBzZXF1ZW5jZVxuICAgICAqXG4gICAgICogdGhpcyBpcyBzbyBhZnRlciBlYWNoIGtleSBwcmVzcyBpbiB0aGUgc2VxdWVuY2UgeW91IGhhdmUgMSBzZWNvbmRcbiAgICAgKiB0byBwcmVzcyB0aGUgbmV4dCBrZXkgYmVmb3JlIHlvdSBoYXZlIHRvIHN0YXJ0IG92ZXJcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfcmVzZXRTZXF1ZW5jZVRpbWVyKCkge1xuICAgICAgICBjbGVhclRpbWVvdXQoX3Jlc2V0VGltZXIpO1xuICAgICAgICBfcmVzZXRUaW1lciA9IHNldFRpbWVvdXQoX3Jlc2V0U2VxdWVuY2VzLCAxMDAwKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiByZXZlcnNlcyB0aGUgbWFwIGxvb2t1cCBzbyB0aGF0IHdlIGNhbiBsb29rIGZvciBzcGVjaWZpYyBrZXlzXG4gICAgICogdG8gc2VlIHdoYXQgY2FuIGFuZCBjYW4ndCB1c2Uga2V5cHJlc3NcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge09iamVjdH1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZ2V0UmV2ZXJzZU1hcCgpIHtcbiAgICAgICAgaWYgKCFfUkVWRVJTRV9NQVApIHtcbiAgICAgICAgICAgIF9SRVZFUlNFX01BUCA9IHt9O1xuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIF9NQVApIHtcblxuICAgICAgICAgICAgICAgIC8vIHB1bGwgb3V0IHRoZSBudW1lcmljIGtleXBhZCBmcm9tIGhlcmUgY2F1c2Uga2V5cHJlc3Mgc2hvdWxkXG4gICAgICAgICAgICAgICAgLy8gYmUgYWJsZSB0byBkZXRlY3QgdGhlIGtleXMgZnJvbSB0aGUgY2hhcmFjdGVyXG4gICAgICAgICAgICAgICAgaWYgKGtleSA+IDk1ICYmIGtleSA8IDExMikge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoX01BUC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgICAgIF9SRVZFUlNFX01BUFtfTUFQW2tleV1dID0ga2V5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX1JFVkVSU0VfTUFQO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHBpY2tzIHRoZSBiZXN0IGFjdGlvbiBiYXNlZCBvbiB0aGUga2V5IGNvbWJpbmF0aW9uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gY2hhcmFjdGVyIGZvciBrZXlcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBtb2RpZmllcnNcbiAgICAgKiBAcGFyYW0ge3N0cmluZz19IGFjdGlvbiBwYXNzZWQgaW5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfcGlja0Jlc3RBY3Rpb24oa2V5LCBtb2RpZmllcnMsIGFjdGlvbikge1xuXG4gICAgICAgIC8vIGlmIG5vIGFjdGlvbiB3YXMgcGlja2VkIGluIHdlIHNob3VsZCB0cnkgdG8gcGljayB0aGUgb25lXG4gICAgICAgIC8vIHRoYXQgd2UgdGhpbmsgd291bGQgd29yayBiZXN0IGZvciB0aGlzIGtleVxuICAgICAgICBpZiAoIWFjdGlvbikge1xuICAgICAgICAgICAgYWN0aW9uID0gX2dldFJldmVyc2VNYXAoKVtrZXldID8gJ2tleWRvd24nIDogJ2tleXByZXNzJztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIG1vZGlmaWVyIGtleXMgZG9uJ3Qgd29yayBhcyBleHBlY3RlZCB3aXRoIGtleXByZXNzLFxuICAgICAgICAvLyBzd2l0Y2ggdG8ga2V5ZG93blxuICAgICAgICBpZiAoYWN0aW9uID09ICdrZXlwcmVzcycgJiYgbW9kaWZpZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgYWN0aW9uID0gJ2tleWRvd24nO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBiaW5kcyBhIGtleSBzZXF1ZW5jZSB0byBhbiBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGNvbWJvIC0gY29tYm8gc3BlY2lmaWVkIGluIGJpbmQgY2FsbFxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGtleXNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gYWN0aW9uXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9iaW5kU2VxdWVuY2UoY29tYm8sIGtleXMsIGNhbGxiYWNrLCBhY3Rpb24pIHtcblxuICAgICAgICAvLyBzdGFydCBvZmYgYnkgYWRkaW5nIGEgc2VxdWVuY2UgbGV2ZWwgcmVjb3JkIGZvciB0aGlzIGNvbWJpbmF0aW9uXG4gICAgICAgIC8vIGFuZCBzZXR0aW5nIHRoZSBsZXZlbCB0byAwXG4gICAgICAgIF9zZXF1ZW5jZUxldmVsc1tjb21ib10gPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBjYWxsYmFjayB0byBpbmNyZWFzZSB0aGUgc2VxdWVuY2UgbGV2ZWwgZm9yIHRoaXMgc2VxdWVuY2UgYW5kIHJlc2V0XG4gICAgICAgICAqIGFsbCBvdGhlciBzZXF1ZW5jZXMgdGhhdCB3ZXJlIGFjdGl2ZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmV4dEFjdGlvblxuICAgICAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfaW5jcmVhc2VTZXF1ZW5jZShuZXh0QWN0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgX25leHRFeHBlY3RlZEFjdGlvbiA9IG5leHRBY3Rpb247XG4gICAgICAgICAgICAgICAgKytfc2VxdWVuY2VMZXZlbHNbY29tYm9dO1xuICAgICAgICAgICAgICAgIF9yZXNldFNlcXVlbmNlVGltZXIoKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogd3JhcHMgdGhlIHNwZWNpZmllZCBjYWxsYmFjayBpbnNpZGUgb2YgYW5vdGhlciBmdW5jdGlvbiBpbiBvcmRlclxuICAgICAgICAgKiB0byByZXNldCBhbGwgc2VxdWVuY2UgY291bnRlcnMgYXMgc29vbiBhcyB0aGlzIHNlcXVlbmNlIGlzIGRvbmVcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfY2FsbGJhY2tBbmRSZXNldChlKSB7XG4gICAgICAgICAgICBfZmlyZUNhbGxiYWNrKGNhbGxiYWNrLCBlLCBjb21ibyk7XG5cbiAgICAgICAgICAgIC8vIHdlIHNob3VsZCBpZ25vcmUgdGhlIG5leHQga2V5IHVwIGlmIHRoZSBhY3Rpb24gaXMga2V5IGRvd25cbiAgICAgICAgICAgIC8vIG9yIGtleXByZXNzLiAgdGhpcyBpcyBzbyBpZiB5b3UgZmluaXNoIGEgc2VxdWVuY2UgYW5kXG4gICAgICAgICAgICAvLyByZWxlYXNlIHRoZSBrZXkgdGhlIGZpbmFsIGtleSB3aWxsIG5vdCB0cmlnZ2VyIGEga2V5dXBcbiAgICAgICAgICAgIGlmIChhY3Rpb24gIT09ICdrZXl1cCcpIHtcbiAgICAgICAgICAgICAgICBfaWdub3JlTmV4dEtleXVwID0gX2NoYXJhY3RlckZyb21FdmVudChlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gd2VpcmQgcmFjZSBjb25kaXRpb24gaWYgYSBzZXF1ZW5jZSBlbmRzIHdpdGggdGhlIGtleVxuICAgICAgICAgICAgLy8gYW5vdGhlciBzZXF1ZW5jZSBiZWdpbnMgd2l0aFxuICAgICAgICAgICAgc2V0VGltZW91dChfcmVzZXRTZXF1ZW5jZXMsIDEwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBrZXlzIG9uZSBhdCBhIHRpbWUgYW5kIGJpbmQgdGhlIGFwcHJvcHJpYXRlIGNhbGxiYWNrXG4gICAgICAgIC8vIGZ1bmN0aW9uLiAgZm9yIGFueSBrZXkgbGVhZGluZyB1cCB0byB0aGUgZmluYWwgb25lIGl0IHNob3VsZFxuICAgICAgICAvLyBpbmNyZWFzZSB0aGUgc2VxdWVuY2UuIGFmdGVyIHRoZSBmaW5hbCwgaXQgc2hvdWxkIHJlc2V0IGFsbCBzZXF1ZW5jZXNcbiAgICAgICAgLy9cbiAgICAgICAgLy8gaWYgYW4gYWN0aW9uIGlzIHNwZWNpZmllZCBpbiB0aGUgb3JpZ2luYWwgYmluZCBjYWxsIHRoZW4gdGhhdCB3aWxsXG4gICAgICAgIC8vIGJlIHVzZWQgdGhyb3VnaG91dC4gIG90aGVyd2lzZSB3ZSB3aWxsIHBhc3MgdGhlIGFjdGlvbiB0aGF0IHRoZVxuICAgICAgICAvLyBuZXh0IGtleSBpbiB0aGUgc2VxdWVuY2Ugc2hvdWxkIG1hdGNoLiAgdGhpcyBhbGxvd3MgYSBzZXF1ZW5jZVxuICAgICAgICAvLyB0byBtaXggYW5kIG1hdGNoIGtleXByZXNzIGFuZCBrZXlkb3duIGV2ZW50cyBkZXBlbmRpbmcgb24gd2hpY2hcbiAgICAgICAgLy8gb25lcyBhcmUgYmV0dGVyIHN1aXRlZCB0byB0aGUga2V5IHByb3ZpZGVkXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdmFyIGlzRmluYWwgPSBpICsgMSA9PT0ga2V5cy5sZW5ndGg7XG4gICAgICAgICAgICB2YXIgd3JhcHBlZENhbGxiYWNrID0gaXNGaW5hbCA/IF9jYWxsYmFja0FuZFJlc2V0IDogX2luY3JlYXNlU2VxdWVuY2UoYWN0aW9uIHx8IF9nZXRLZXlJbmZvKGtleXNbaSArIDFdKS5hY3Rpb24pO1xuICAgICAgICAgICAgX2JpbmRTaW5nbGUoa2V5c1tpXSwgd3JhcHBlZENhbGxiYWNrLCBhY3Rpb24sIGNvbWJvLCBpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIGZyb20gYSBzdHJpbmcga2V5IGNvbWJpbmF0aW9uIHRvIGFuIGFycmF5XG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IGNvbWJpbmF0aW9uIGxpa2UgXCJjb21tYW5kK3NoaWZ0K2xcIlxuICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9rZXlzRnJvbVN0cmluZyhjb21iaW5hdGlvbikge1xuICAgICAgICBpZiAoY29tYmluYXRpb24gPT09ICcrJykge1xuICAgICAgICAgICAgcmV0dXJuIFsnKyddO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNvbWJpbmF0aW9uLnNwbGl0KCcrJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0cyBpbmZvIGZvciBhIHNwZWNpZmljIGtleSBjb21iaW5hdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtICB7c3RyaW5nfSBjb21iaW5hdGlvbiBrZXkgY29tYmluYXRpb24gKFwiY29tbWFuZCtzXCIgb3IgXCJhXCIgb3IgXCIqXCIpXG4gICAgICogQHBhcmFtICB7c3RyaW5nPX0gYWN0aW9uXG4gICAgICogQHJldHVybnMge09iamVjdH1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZ2V0S2V5SW5mbyhjb21iaW5hdGlvbiwgYWN0aW9uKSB7XG4gICAgICAgIHZhciBrZXlzLFxuICAgICAgICAgICAga2V5LFxuICAgICAgICAgICAgaSxcbiAgICAgICAgICAgIG1vZGlmaWVycyA9IFtdO1xuXG4gICAgICAgIC8vIHRha2UgdGhlIGtleXMgZnJvbSB0aGlzIHBhdHRlcm4gYW5kIGZpZ3VyZSBvdXQgd2hhdCB0aGUgYWN0dWFsXG4gICAgICAgIC8vIHBhdHRlcm4gaXMgYWxsIGFib3V0XG4gICAgICAgIGtleXMgPSBfa2V5c0Zyb21TdHJpbmcoY29tYmluYXRpb24pO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBrZXkgPSBrZXlzW2ldO1xuXG4gICAgICAgICAgICAvLyBub3JtYWxpemUga2V5IG5hbWVzXG4gICAgICAgICAgICBpZiAoX1NQRUNJQUxfQUxJQVNFU1trZXldKSB7XG4gICAgICAgICAgICAgICAga2V5ID0gX1NQRUNJQUxfQUxJQVNFU1trZXldO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIG5vdCBhIGtleXByZXNzIGV2ZW50IHRoZW4gd2Ugc2hvdWxkXG4gICAgICAgICAgICAvLyBiZSBzbWFydCBhYm91dCB1c2luZyBzaGlmdCBrZXlzXG4gICAgICAgICAgICAvLyB0aGlzIHdpbGwgb25seSB3b3JrIGZvciBVUyBrZXlib2FyZHMgaG93ZXZlclxuICAgICAgICAgICAgaWYgKGFjdGlvbiAmJiBhY3Rpb24gIT0gJ2tleXByZXNzJyAmJiBfU0hJRlRfTUFQW2tleV0pIHtcbiAgICAgICAgICAgICAgICBrZXkgPSBfU0hJRlRfTUFQW2tleV07XG4gICAgICAgICAgICAgICAgbW9kaWZpZXJzLnB1c2goJ3NoaWZ0Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMga2V5IGlzIGEgbW9kaWZpZXIgdGhlbiBhZGQgaXQgdG8gdGhlIGxpc3Qgb2YgbW9kaWZpZXJzXG4gICAgICAgICAgICBpZiAoX2lzTW9kaWZpZXIoa2V5KSkge1xuICAgICAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZXBlbmRpbmcgb24gd2hhdCB0aGUga2V5IGNvbWJpbmF0aW9uIGlzXG4gICAgICAgIC8vIHdlIHdpbGwgdHJ5IHRvIHBpY2sgdGhlIGJlc3QgZXZlbnQgZm9yIGl0XG4gICAgICAgIGFjdGlvbiA9IF9waWNrQmVzdEFjdGlvbihrZXksIG1vZGlmaWVycywgYWN0aW9uKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAga2V5OiBrZXksXG4gICAgICAgICAgICBtb2RpZmllcnM6IG1vZGlmaWVycyxcbiAgICAgICAgICAgIGFjdGlvbjogYWN0aW9uXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYmluZHMgYSBzaW5nbGUga2V5Ym9hcmQgY29tYmluYXRpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjb21iaW5hdGlvblxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb25cbiAgICAgKiBAcGFyYW0ge3N0cmluZz19IHNlcXVlbmNlTmFtZSAtIG5hbWUgb2Ygc2VxdWVuY2UgaWYgcGFydCBvZiBzZXF1ZW5jZVxuICAgICAqIEBwYXJhbSB7bnVtYmVyPX0gbGV2ZWwgLSB3aGF0IHBhcnQgb2YgdGhlIHNlcXVlbmNlIHRoZSBjb21tYW5kIGlzXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9iaW5kU2luZ2xlKGNvbWJpbmF0aW9uLCBjYWxsYmFjaywgYWN0aW9uLCBzZXF1ZW5jZU5hbWUsIGxldmVsKSB7XG5cbiAgICAgICAgLy8gc3RvcmUgYSBkaXJlY3QgbWFwcGVkIHJlZmVyZW5jZSBmb3IgdXNlIHdpdGggTW91c2V0cmFwLnRyaWdnZXJcbiAgICAgICAgX2RpcmVjdE1hcFtjb21iaW5hdGlvbiArICc6JyArIGFjdGlvbl0gPSBjYWxsYmFjaztcblxuICAgICAgICAvLyBtYWtlIHN1cmUgbXVsdGlwbGUgc3BhY2VzIGluIGEgcm93IGJlY29tZSBhIHNpbmdsZSBzcGFjZVxuICAgICAgICBjb21iaW5hdGlvbiA9IGNvbWJpbmF0aW9uLnJlcGxhY2UoL1xccysvZywgJyAnKTtcblxuICAgICAgICB2YXIgc2VxdWVuY2UgPSBjb21iaW5hdGlvbi5zcGxpdCgnICcpLFxuICAgICAgICAgICAgaW5mbztcblxuICAgICAgICAvLyBpZiB0aGlzIHBhdHRlcm4gaXMgYSBzZXF1ZW5jZSBvZiBrZXlzIHRoZW4gcnVuIHRocm91Z2ggdGhpcyBtZXRob2RcbiAgICAgICAgLy8gdG8gcmVwcm9jZXNzIGVhY2ggcGF0dGVybiBvbmUga2V5IGF0IGEgdGltZVxuICAgICAgICBpZiAoc2VxdWVuY2UubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgX2JpbmRTZXF1ZW5jZShjb21iaW5hdGlvbiwgc2VxdWVuY2UsIGNhbGxiYWNrLCBhY3Rpb24pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5mbyA9IF9nZXRLZXlJbmZvKGNvbWJpbmF0aW9uLCBhY3Rpb24pO1xuXG4gICAgICAgIC8vIG1ha2Ugc3VyZSB0byBpbml0aWFsaXplIGFycmF5IGlmIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWVcbiAgICAgICAgLy8gYSBjYWxsYmFjayBpcyBhZGRlZCBmb3IgdGhpcyBrZXlcbiAgICAgICAgX2NhbGxiYWNrc1tpbmZvLmtleV0gPSBfY2FsbGJhY2tzW2luZm8ua2V5XSB8fCBbXTtcblxuICAgICAgICAvLyByZW1vdmUgYW4gZXhpc3RpbmcgbWF0Y2ggaWYgdGhlcmUgaXMgb25lXG4gICAgICAgIF9nZXRNYXRjaGVzKGluZm8ua2V5LCBpbmZvLm1vZGlmaWVycywge3R5cGU6IGluZm8uYWN0aW9ufSwgc2VxdWVuY2VOYW1lLCBjb21iaW5hdGlvbiwgbGV2ZWwpO1xuXG4gICAgICAgIC8vIGFkZCB0aGlzIGNhbGwgYmFjayB0byB0aGUgYXJyYXlcbiAgICAgICAgLy8gaWYgaXQgaXMgYSBzZXF1ZW5jZSBwdXQgaXQgYXQgdGhlIGJlZ2lubmluZ1xuICAgICAgICAvLyBpZiBub3QgcHV0IGl0IGF0IHRoZSBlbmRcbiAgICAgICAgLy9cbiAgICAgICAgLy8gdGhpcyBpcyBpbXBvcnRhbnQgYmVjYXVzZSB0aGUgd2F5IHRoZXNlIGFyZSBwcm9jZXNzZWQgZXhwZWN0c1xuICAgICAgICAvLyB0aGUgc2VxdWVuY2Ugb25lcyB0byBjb21lIGZpcnN0XG4gICAgICAgIF9jYWxsYmFja3NbaW5mby5rZXldW3NlcXVlbmNlTmFtZSA/ICd1bnNoaWZ0JyA6ICdwdXNoJ10oe1xuICAgICAgICAgICAgY2FsbGJhY2s6IGNhbGxiYWNrLFxuICAgICAgICAgICAgbW9kaWZpZXJzOiBpbmZvLm1vZGlmaWVycyxcbiAgICAgICAgICAgIGFjdGlvbjogaW5mby5hY3Rpb24sXG4gICAgICAgICAgICBzZXE6IHNlcXVlbmNlTmFtZSxcbiAgICAgICAgICAgIGxldmVsOiBsZXZlbCxcbiAgICAgICAgICAgIGNvbWJvOiBjb21iaW5hdGlvblxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBiaW5kcyBtdWx0aXBsZSBjb21iaW5hdGlvbnMgdG8gdGhlIHNhbWUgY2FsbGJhY2tcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGNvbWJpbmF0aW9uc1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICogQHBhcmFtIHtzdHJpbmd8dW5kZWZpbmVkfSBhY3Rpb25cbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2JpbmRNdWx0aXBsZShjb21iaW5hdGlvbnMsIGNhbGxiYWNrLCBhY3Rpb24pIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb21iaW5hdGlvbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIF9iaW5kU2luZ2xlKGNvbWJpbmF0aW9uc1tpXSwgY2FsbGJhY2ssIGFjdGlvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzdGFydCFcbiAgICBfYWRkRXZlbnQoZG9jdW1lbnQsICdrZXlwcmVzcycsIF9oYW5kbGVLZXlFdmVudCk7XG4gICAgX2FkZEV2ZW50KGRvY3VtZW50LCAna2V5ZG93bicsIF9oYW5kbGVLZXlFdmVudCk7XG4gICAgX2FkZEV2ZW50KGRvY3VtZW50LCAna2V5dXAnLCBfaGFuZGxlS2V5RXZlbnQpO1xuXG4gICAgdmFyIE1vdXNldHJhcCA9IHtcblxuICAgICAgICAvKipcbiAgICAgICAgICogYmluZHMgYW4gZXZlbnQgdG8gbW91c2V0cmFwXG4gICAgICAgICAqXG4gICAgICAgICAqIGNhbiBiZSBhIHNpbmdsZSBrZXksIGEgY29tYmluYXRpb24gb2Yga2V5cyBzZXBhcmF0ZWQgd2l0aCArLFxuICAgICAgICAgKiBhbiBhcnJheSBvZiBrZXlzLCBvciBhIHNlcXVlbmNlIG9mIGtleXMgc2VwYXJhdGVkIGJ5IHNwYWNlc1xuICAgICAgICAgKlxuICAgICAgICAgKiBiZSBzdXJlIHRvIGxpc3QgdGhlIG1vZGlmaWVyIGtleXMgZmlyc3QgdG8gbWFrZSBzdXJlIHRoYXQgdGhlXG4gICAgICAgICAqIGNvcnJlY3Qga2V5IGVuZHMgdXAgZ2V0dGluZyBib3VuZCAodGhlIGxhc3Qga2V5IGluIHRoZSBwYXR0ZXJuKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ3xBcnJheX0ga2V5c1xuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZz19IGFjdGlvbiAtICdrZXlwcmVzcycsICdrZXlkb3duJywgb3IgJ2tleXVwJ1xuICAgICAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICBiaW5kOiBmdW5jdGlvbihrZXlzLCBjYWxsYmFjaywgYWN0aW9uKSB7XG4gICAgICAgICAgICBrZXlzID0ga2V5cyBpbnN0YW5jZW9mIEFycmF5ID8ga2V5cyA6IFtrZXlzXTtcbiAgICAgICAgICAgIF9iaW5kTXVsdGlwbGUoa2V5cywgY2FsbGJhY2ssIGFjdGlvbik7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdW5iaW5kcyBhbiBldmVudCB0byBtb3VzZXRyYXBcbiAgICAgICAgICpcbiAgICAgICAgICogdGhlIHVuYmluZGluZyBzZXRzIHRoZSBjYWxsYmFjayBmdW5jdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGtleSBjb21ib1xuICAgICAgICAgKiB0byBhbiBlbXB0eSBmdW5jdGlvbiBhbmQgZGVsZXRlcyB0aGUgY29ycmVzcG9uZGluZyBrZXkgaW4gdGhlXG4gICAgICAgICAqIF9kaXJlY3RNYXAgZGljdC5cbiAgICAgICAgICpcbiAgICAgICAgICogVE9ETzogYWN0dWFsbHkgcmVtb3ZlIHRoaXMgZnJvbSB0aGUgX2NhbGxiYWNrcyBkaWN0aW9uYXJ5IGluc3RlYWRcbiAgICAgICAgICogb2YgYmluZGluZyBhbiBlbXB0eSBmdW5jdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiB0aGUga2V5Y29tYm8rYWN0aW9uIGhhcyB0byBiZSBleGFjdGx5IHRoZSBzYW1lIGFzXG4gICAgICAgICAqIGl0IHdhcyBkZWZpbmVkIGluIHRoZSBiaW5kIG1ldGhvZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ3xBcnJheX0ga2V5c1xuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gYWN0aW9uXG4gICAgICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgICAgICovXG4gICAgICAgIHVuYmluZDogZnVuY3Rpb24oa2V5cywgYWN0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gTW91c2V0cmFwLmJpbmQoa2V5cywgZnVuY3Rpb24oKSB7fSwgYWN0aW9uKTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogdHJpZ2dlcnMgYW4gZXZlbnQgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIGJvdW5kXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlzXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gYWN0aW9uXG4gICAgICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgICAgICovXG4gICAgICAgIHRyaWdnZXI6IGZ1bmN0aW9uKGtleXMsIGFjdGlvbikge1xuICAgICAgICAgICAgaWYgKF9kaXJlY3RNYXBba2V5cyArICc6JyArIGFjdGlvbl0pIHtcbiAgICAgICAgICAgICAgICBfZGlyZWN0TWFwW2tleXMgKyAnOicgKyBhY3Rpb25dKHt9LCBrZXlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiByZXNldHMgdGhlIGxpYnJhcnkgYmFjayB0byBpdHMgaW5pdGlhbCBzdGF0ZS4gIHRoaXMgaXMgdXNlZnVsXG4gICAgICAgICAqIGlmIHlvdSB3YW50IHRvIGNsZWFyIG91dCB0aGUgY3VycmVudCBrZXlib2FyZCBzaG9ydGN1dHMgYW5kIGJpbmRcbiAgICAgICAgICogbmV3IG9uZXMgLSBmb3IgZXhhbXBsZSBpZiB5b3Ugc3dpdGNoIHRvIGFub3RoZXIgcGFnZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICByZXNldDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBfY2FsbGJhY2tzID0ge307XG4gICAgICAgICAgICBfZGlyZWN0TWFwID0ge307XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfSxcblxuICAgICAgIC8qKlxuICAgICAgICAqIHNob3VsZCB3ZSBzdG9wIHRoaXMgZXZlbnQgYmVmb3JlIGZpcmluZyBvZmYgY2FsbGJhY2tzXG4gICAgICAgICpcbiAgICAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICAgICogQHBhcmFtIHtFbGVtZW50fSBlbGVtZW50XG4gICAgICAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICAgICAgKi9cbiAgICAgICAgc3RvcENhbGxiYWNrOiBmdW5jdGlvbihlLCBlbGVtZW50KSB7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBlbGVtZW50IGhhcyB0aGUgY2xhc3MgXCJtb3VzZXRyYXBcIiB0aGVuIG5vIG5lZWQgdG8gc3RvcFxuICAgICAgICAgICAgaWYgKCgnICcgKyBlbGVtZW50LmNsYXNzTmFtZSArICcgJykuaW5kZXhPZignIG1vdXNldHJhcCAnKSA+IC0xKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzdG9wIGZvciBpbnB1dCwgc2VsZWN0LCBhbmQgdGV4dGFyZWFcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50LnRhZ05hbWUgPT0gJ0lOUFVUJyB8fCBlbGVtZW50LnRhZ05hbWUgPT0gJ1NFTEVDVCcgfHwgZWxlbWVudC50YWdOYW1lID09ICdURVhUQVJFQScgfHwgZWxlbWVudC5pc0NvbnRlbnRFZGl0YWJsZTtcbiAgICAgICAgfSxcblxuICAgICAgICAvKipcbiAgICAgICAgICogZXhwb3NlcyBfaGFuZGxlS2V5IHB1YmxpY2x5IHNvIGl0IGNhbiBiZSBvdmVyd3JpdHRlbiBieSBleHRlbnNpb25zXG4gICAgICAgICAqL1xuICAgICAgICBoYW5kbGVLZXk6IF9oYW5kbGVLZXlcbiAgICB9O1xuXG4gICAgLy8gZXhwb3NlIG1vdXNldHJhcCB0byB0aGUgZ2xvYmFsIG9iamVjdFxuICAgIHdpbmRvdy5Nb3VzZXRyYXAgPSBNb3VzZXRyYXA7XG5cbiAgICAvLyBleHBvc2UgbW91c2V0cmFwIGFzIGFuIEFNRCBtb2R1bGVcbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZShNb3VzZXRyYXApO1xuICAgIH1cbn0pICh3aW5kb3csIGRvY3VtZW50KTtcbiJdfQ==
