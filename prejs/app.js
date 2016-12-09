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

    //broadcasting
    $scope.broadCasting = false;
    $scope.broadCast = "";

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
                    console.log(data.data);
                    broadCast("調整音量:" + value);
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
            broadCast("WELCOME TO NTU ICAN LAB!");
            try {
                PlayerFactory.loadVolume().then(function(data) {
                    console.log(data.data);
                    $scope.slider.value = data.data;
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
            broadCast("WELCOME TO NTU ICAN LAB!");
            //實驗室模式
            //讀取音量
            try {
                PlayerFactory.loadVolume().then(function(data) {
                    console.log(data.data);
                    $scope.slider.value = data.data;
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
            console.log(data.data);
            broadCast("停止音樂");
        });
    }

    $scope.labStop = function() {
        PlayerFactory.play("").then(function(data) {
            console.log(data.data);
            broadCast("暫停音樂");
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


        PlayerFactory.play(musicCard._id).then(function(data) {
            console.log(data.data);
            broadCast("實驗室播放等待中");
        });
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


    function broadCast(message) {

        $scope.broadCasting = true;

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
