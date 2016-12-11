var app = angular.module("ntuApp", ['mgo-mousetrap', 'LocalStorageModule', 'angular-marquee', 'youtube-embed', 'rzModule']);


app.config(function(localStorageServiceProvider) {
    localStorageServiceProvider
        .setPrefix('NTU-ICAN-PLAYER');
});

app.controller("MusicPlayerController", function($scope, $timeout, $location, $http, PlayerFactory, googleService, localStorageService) {
    $scope.searching = false;
    $scope.musicLists = [];
    $scope.searchQuery = "";
    $scope.currentYoutubeVideo = undefined;
    $scope.isFavoriteMode = false;
    $scope.favoriteLists = [];
    $scope.labMode = false;

    //broadcasting
    $scope.broadCasting = false;
    $scope.broadCast = "";
    $scope.isbroadCastMarquee = false;

    //標題跑馬燈 Marquee
    $scope.duration = 10000;

    function addMarquee(musicLists) {
        if (musicLists && musicLists.length > 0)
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
                    broadCast("調整音量:" + value, false);
                });
            }
        }
    };


    $scope.init = function() {
        $scope.musicLists = loadSearch();
        var favoriteLists = loadFavorite();
        if (favoriteLists)
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
            broadCast("WELCOME TO NTU ICAN LAB!", true);
            try {
                PlayerFactory.loadVolume().then(function(data) {
                    console.log(data);
                    $scope.slider.value = data;
                });
            } catch (err) {
                console.log(err);
                alert("請連結ican-5g wifi");
            }

        }

    }


    $scope.switchLabMode = function(event) {
        event.preventDefault();

        $scope.labMode = !$scope.labMode;

        if ($scope.labMode) {
            console.log("WELCOME TO NTU ICAN LAB!");
            broadCast("WELCOME TO NTU ICAN LAB!", true);
            //實驗室模式
            //讀取音量
            try {
                PlayerFactory.loadVolume().then(function(data) {
                    console.log(data);
                    $scope.slider.value = data;
                });
            } catch (err) {
                console.log(err);
                alert("請連結ican-5g wifi");
            }

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
            broadCast("停止音樂", false);
        });
    }

    $scope.labStop = function() {
        PlayerFactory.play("").then(function(data) {
            console.log(data);
            broadCast("暫停音樂", false);
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


        playVideoInPlayer(musicCard._id);
    }


    function playVideoInPlayer(_id) {
        $scope.currentYoutubeVideo = _id;

    }

    $scope.addToMyFavorite = function(event, musicCard) {

        event.preventDefault();
        event.stopPropagation();
        musicCard.isFavorite = !musicCard.isFavorite;



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


        PlayerFactory.play(musicCard._id).then(function(data) {
            console.log(data);
            broadCast("實驗室播放等待中", true);
        });


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


    function broadCast(message, isMarquee) {

        $scope.broadCasting = true;
        $scope.isbroadCastMarquee = isMarquee;

        $scope.broadCast = message;
        $timeout(function() {
            $scope.broadCasting = false;

            $scope.broadCast = "";
        }, 3000);

    }


});

app.factory('PlayerFactory', function($q, $http) {


    var _factory = {};
    _factory.play = function(id) {
        var defer = $q.defer();
        $http.get("http://140.112.26.236:80/music?id=" + id)
            .then(function(response) {
                _factory.data = response.data;
                defer.resolve(_factory.data);
            }, function(response) {
                alert("請連結NTUI CAN LAB wifi，或是伺服器錯誤。");
                defer.reject(_factory.data);
            });
        return defer.promise;
    };



    _factory.loadVolume = function() {
        var defer = $q.defer();
        $http.get("http://140.112.26.236:80/get_volume")
            .then(function(response) {
                _factory.data = response.data;
                defer.resolve(_factory.data);
            }, function(response) {
                alert("請連結NTUI CAN LAB wifi，或是伺服器錯誤。");
                defer.reject(_factory.data);
            });
        return defer.promise;
    };

    _factory.setVolume = function(range) {
        var defer = $q.defer();
        $http.get("http://140.112.26.236:80/set_volume?volume=" + range)
            .then(function(response) {
                _factory.data = response.data;
                defer.resolve(_factory.data);
            }, function(response) {
                alert("請連結NTUI CAN LAB wifi，或是伺服器錯誤。");
                defer.reject(_factory.data);
            });
        return defer.promise;
    };
    _factory.pause = function() {
        var defer = $q.defer();
        $http.get("http://140.112.26.236:80/pause_and_play")
            .then(function(response) {
                _factory.data = response.data;
                defer.resolve(_factory.data);
            }, function(response) {
                alert("請連結NTUI CAN LAB wifi，或是伺服器錯誤。");
                defer.reject(_factory.data);
            });
        return defer.promise;
    };





    return _factory;
});

app.factory('googleService', function($q, $http) {

    var _factory = {};


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
