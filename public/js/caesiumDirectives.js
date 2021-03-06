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

	caesiumDirectives.directive('timeGraph', function($parse, $filter) {
		var formatDuration = $filter("formatDuration");
		var formatDayNumber = $filter("formatDayNumber");
		var getColor = $filter("getColor");

		var getLabel = function(entryGroup) {
			return (entryGroup.dayNumber ? formatDayNumber(entryGroup.dayNumber) + ": " : "")
				+ (entryGroup.description ? entryGroup.description + ": " : "")
				+ formatDuration(entryGroup.duration);
		};

		var drawPieChart = function(ctx, entryGroups, options) {

			var data = _.chain(entryGroups)
				.sortBy(function(e) { return -e.duration; })
				.map(function(entryGroup, index) {
					return {
						value: entryGroup.duration,
						color: getColor(120, 60, index),
						highlight: getColor(150, 60, index),
						label: getLabel(entryGroup)
					};
				})
				.value();

			return new Chart(ctx).Pie(data, options);
		};

		var drawBarChart = function(ctx, entryGroups, options) {

			entryGroups = _.sortBy(entryGroups, "dayNumber");

			var data = {
				labels: _.map(entryGroups, getLabel),
				datasets: [{
					data: _.map(entryGroups, "duration"),
					fillColor: getColor(120, 60, 0),
					highlightFill: getColor(150, 60, 0),
					label: ""
				}]
			};

			return new Chart(ctx).Bar(data, options);
		};

		return {
		    restrict: 'A', // specify directive by attribute only
		    link: function(scope, element, attr) {
				var expr = $parse(attr.timeGraph);

				var lastChart = null;

				scope.$watch(expr, function(entryGroups) {

					var splitByDay = _.uniq(_.map(entryGroups, "dayNumber")).length > 1;
					var splitByTask = _.uniq(_.map(entryGroups, "description")).length > 1;

					var options = {
						animation: false,
						tooltipTemplate: "<%= label %>",
						showScale: false,
						barShowStroke: false
					};

					if (lastChart)
						lastChart.destroy();

					var ctx = element[0].getContext("2d");

					// TODO stacked bar would be better for split by both
					var chartToDraw = splitByTask
						? drawPieChart
						: (splitByDay ? drawBarChart : null);

					if (chartToDraw)
						lastChart = chartToDraw(ctx, entryGroups, options);
				});
		    }
		};
	});
})();
