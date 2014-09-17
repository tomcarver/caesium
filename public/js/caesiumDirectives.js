(function() {
	var caesiumDirectives = angular.module('caesiumDirectives', ['caesiumLogic']);

	caesiumDirectives.directive('time', function($filter, timePattern) {
		var formatMins = $filter("formatMins");
		return {
		    restrict: 'A', // specify directive by attribute only
		    require: 'ngModel',
		    link: function(scope, element, attr, ngModel) {
				ngModel.$parsers.push(function (text) {
					var result = timePattern.exec(text);
					ngModel.$setValidity("format", result);
					if (result) {
						var mins = (result[2] || 0) * 1;
						return (result[1] * 60) + mins;
					}
				});
				ngModel.$formatters.push(function(mins) {
					ngModel.$setValidity("format", true);
					return formatMins(mins);
				});
		    }
		};
	});

	caesiumDirectives.directive('date', function($filter, datePattern) {
		var formatDayNumber = $filter("formatDayNumber");
		var getDayNumberFromComponents = $filter("getDayNumberFromComponents");

		return {
		    restrict: 'A', // specify directive by attribute only
		    require: 'ngModel',
		    link: function(scope, element, attr, ngModel) {
				$(element).datepicker({ dateFormat: "yy-mm-dd" });

				// NB: in angular 1.3+, use ngModel.$validators.pattern = datePattern.test;

				ngModel.$parsers.push(function (text) {
					var result = datePattern.exec(text);
					ngModel.$setValidity("format", result);
					if (result) {
						return getDayNumberFromComponents(result[3]*1, result[2]*1, result[1]*1);
					}
				});
				ngModel.$formatters.push(function(dayNumber) {
					ngModel.$setValidity("format", true);
					return formatDayNumber(dayNumber);
				});
		    }
		};
	});
})();
