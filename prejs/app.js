var app = angular.module("ntuApp", ['LocalStorageModule']);


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
        loadSearch();
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
        });


    }


    function loadSearch() {
        console.log("讀取上次搜尋狀態..");
        if (localStorageService.isSupported) {
            $scope.musicLists = getLocalStorge('NTU-ICAN-PLAYER-SEARCH');
            console.log("讀取成功!");
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
