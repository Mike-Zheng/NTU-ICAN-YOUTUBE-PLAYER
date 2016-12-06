var app = angular.module("RootApp", [
    'ngFileUpload',
    'angular-google-analytics',
    'angularLazyImg',
    'ngModal',
    'infinite-scroll',
    'ngDropdown',
    'ngDragDrop',
    'ngTagsInput',
    'ngVimeo',
    'ngYoutube',
    'angulike',
    'mgo-mousetrap',
    'satellizer',
    'ksSwiper',
    'dibari.angular-ellipsis',
    'perfect_scrollbar',
    'mediaPlayer',
]);

app.directive("fixedSidebar", function($window) {
    return function(scope, element, attrs) {
        angular.element($window).bind("scroll", function() {
            if ($($window).scrollTop() > attrs.fixedSidebar) {
                scope.fixed = true;
            } else {
                scope.fixed = false;
            }
            scope.$apply();
        });
    };
});

app.filter('decodeURIComponent', function() {
    return window.decodeURIComponent;
});

app.config(function($sceProvider, $locationProvider, AnalyticsProvider, $authProvider) {

        $sceProvider.enabled(false);
        // $locationProvider.html5Mode(false).hashPrefix('!');
        $locationProvider.html5Mode({
            enabled: true,
            requireBase: false,
            // rewriteLinks: false
        });

        // 設定 Google Analytics 追蹤編號
        AnalyticsProvider.setAccount([{
            tracker: 'UA-57379126-4',
            name: "tracker",
            trackEvent: true,
            enhancedLinkAttribution: true,
            displayFeatures: true,
        }]);
        AnalyticsProvider.trackUrlParams(true);

        // 如果在測試環境，就不需要監測任何事件
        // if (location.hostname === "localhost" || location.hostname === "test.jibaoviewer.com") {
        //     AnalyticsProvider.disableAnalytics(true);
        // }

        $authProvider.facebook({
            clientId: '440378442838170'
        });

        $authProvider.google({
            clientId: '176305844457-r348p1ml4dirc0m3ngehava91dko5u0m.apps.googleusercontent.com'
        });

        $authProvider.httpInterceptor = function() {
                return true;
            },
            $authProvider.withCredentials = true;
        $authProvider.tokenRoot = null;
        $authProvider.baseUrl = '/';
        $authProvider.loginUrl = '/auth/login';
        $authProvider.signupUrl = '/auth/signup';
        $authProvider.unlinkUrl = '/auth/unlink/';
        $authProvider.tokenName = 'token';
        $authProvider.tokenPrefix = 'satellizer';
        $authProvider.authHeader = 'Authorization';
        $authProvider.authToken = 'Bearer';
        $authProvider.storageType = 'localStorage';

        // Facebook
        $authProvider.facebook({
            name: 'facebook',
            url: '/auth/facebook',
            authorizationEndpoint: 'https://www.facebook.com/v2.5/dialog/oauth',
            redirectUri: (window.location.origin || window.location.protocol + '//' + window.location.host) + '/',
            requiredUrlParams: ['display', 'scope'],
            scope: ['user_friends', 'public_profile', 'email'],
            scopeDelimiter: ',',
            display: 'popup',
            type: '2.0',
            popupOptions: { width: 580, height: 400 }
        });


        // Google
        $authProvider.google({
            url: '/auth/google',
            authorizationEndpoint: 'https://accounts.google.com/o/oauth2/auth',
            redirectUri: window.location.origin || window.location.protocol + '//' + window.location.host + '/' + oauth2callback,
            requiredUrlParams: ['scope'],
            optionalUrlParams: ['display'],
            scope: ['profile', 'email'],
            scopePrefix: 'openid',
            scopeDelimiter: ' ',
            display: 'popup',
            type: '2.0',
            popupOptions: { width: 452, height: 633 }
        });

    }

);

app.directive('mousetrap', function() {
    return {
        restrict: 'A',
        controller: ['$scope', '$element', '$attrs',
            function($scope, $element, $attrs) {

                var mousetrap;

                $scope.$watch($attrs.mousetrap, function(_mousetrap) {
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

            }
        ]
    }
});

app.controller("RootController", function($rootScope, $scope, $timeout, Analytics, $location, $http, UserFactory) {

    $scope.UserFactory = UserFactory;
    $scope.searchKeyword = "";

    $scope.clearall = function() {
        $rootScope.searchKeyword = '';
        $("#search").focus();
    };

    $scope.onSearchKeyup = function(event, searchKeyword) {
        var keyCode = event.keyCode;
        if (keyCode == 13 && searchKeyword != "") {
            Analytics.trackEvent('GlobalSearch', 'Search', 'Header', searchKeyword);
            location.href = "/search?keyword=" + searchKeyword;
        }
    };

    $scope.logout = function() {
        UserFactory.logout();
    };

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
