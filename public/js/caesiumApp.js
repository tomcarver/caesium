angular.module('caesiumApp', ['ngRoute', 'ngAnimate', 'caesiumControllers'])
	.config(['$routeProvider',
		function($routeProvider) {
			$routeProvider
				.when('/working', {
					templateUrl: 'templates/MainView.html',
					controller: 'CurrentEntryCtrl'
				})
				.when('/notworking', {
					templateUrl: 'templates/NotWorking.html',
					controller: 'NotWorkingCtrl'
				})
				.otherwise({
					redirectTo: '/working'
				});
		}]);
