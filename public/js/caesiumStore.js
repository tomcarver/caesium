(function() {
	var caesiumStore = angular.module('caesiumStore', ['promiseHelpers', 'caesiumLogic', 'store']);

	caesiumStore
		.config(function(storeProvider) {
			storeProvider
				.dbName('caesium')
				.migrations([
					function(db, transaction) {
						var entryStore = db.createObjectStore("entries", { keyPath: 'id', autoIncrement: true });

						entryStore.createIndex("dayNumber", "dayNumber", { unique: false });
						entryStore.createIndex("taskId", "taskId", { unique: false });
					}
				]);
		});

	caesiumStore
		.service('caesiumStore', function($q, store, promiseHelpers, $filter) {

			var entriesForDay = function(db, dayNumber) {
				return promiseHelpers.newQueryPromise(function() {
					return db
						.transaction("entries", 'readonly')
						.objectStore("entries")
						.index("dayNumber")
						.openCursor(new IDBKeyRange.only(dayNumber));
				});
			};

			var tryGetCurrentEntry = function(db) {
				var dayNumber = $filter("getDayNumber")(new Date());
				return entriesForDay(db, dayNumber)
					.then(function(todayEntries) {
						var len = todayEntries.length;
						for (var i = 0; i < len; i++) {
							var entry = todayEntries[i];

							if (!entry.finishMins)
								return entry;
						}
						return null;
					});
			};

			this.getEntriesForDay = function(dayNumber) {
				return store.usingDb(function(db) { return entriesForDay(db, dayNumber); });
			};

			this.getCurrentEntry = function() {
				return store.usingDb(tryGetCurrentEntry);
			};

			this.insertNewEntry = function(description) {
				return store.usingDb(function(db) {
					var newEntry = $filter("newEntry")(description);
					return store
						.editInTransaction(db, "entries", function(entryStore) {
							return promiseHelpers.newRequestPromise(function() {
								return entryStore.add(newEntry);
							});
						})
						.then(function(id) {
							newEntry.id = id;
							return newEntry;
						});
				});
			};

			this.replaceEntries = function(dayNumber, newEntries) {
				return store.usingDb(function(db) {
					return entriesForDay(db, dayNumber)
						.then(function(oldEntries) {

							// TODO resolve merges
							//var fromDb = $filter("buildTimesheetFromEntries")(entries, $scope.day);
							//var merged = mergeTimesheets(originalTimesheet, newTimesheet, fromDb);
							//var newEntries = $filter("buildEntriesFromTimesheet")(merged.result);
							//return merged.conflicts;

							return store
								.editInTransaction(db, "entries", function(entryStore) {
									var getNewEntry = $filter("newEntry");
									var deleteRequests = _.map(oldEntries, function(entry) {
										return promiseHelpers.newRequestPromise(function() {
											return entryStore.delete(entry.id);
										});
									});
									var insertRequests = _.map(newEntries, function(entry) {
										return promiseHelpers.newRequestPromise(function() {
											var dbEntry = getNewEntry(entry.description, dayNumber, entry.startMins, entry.finishMins);
											return entryStore.add(dbEntry);
										});
									});
									return $q.all(deleteRequests.concat(insertRequests));
								});
						});
				});
			};

			var editCurrentEntry = function(performUpdate) {
				return store.usingDb(function(db) {
					return tryGetCurrentEntry(db)
						.then(function(entry) {
							if (entry) {
								return store.editInTransaction(db, "entries", function(entryStore) {
									return performUpdate(entryStore, entry);
								});
							}
						});
				});
			};

			this.endCurrentEntry = function() {
				return editCurrentEntry(function(entryStore, entry) {
					entry.finishMins = $filter("getOffsetMinsFromDate")(new Date());
					return promiseHelpers.newRequestPromise(function() {
						return entryStore.put(entry);
					});
				});
			};

			this.updateCurrentEntry = function(newDescription) {
				return editCurrentEntry(function(entryStore, entry) {
					var promises = [];

					var currentMins = $filter("getOffsetMinsFromDate")(new Date());
					var currentEntryIsOld = currentMins > entry.startMins + 1;

					if (currentEntryIsOld) {
						var newEntry = $filter("newEntry")(newDescription, entry.dayNumber, currentMins);
						promises.push(promiseHelpers.newRequestPromise(function() { return entryStore.add(newEntry); }));

						entry.finishMins = currentMins;
					}
					else {
						entry.description = newDescription;
					}

					promises.push(promiseHelpers.newRequestPromise(function() { return entryStore.put(entry); }));

					return $q.all(promises);
				});
			};

			this.getEntriesForDayRange = function(fromDayNumber, toDayNumber) {
				return store.usingDb(function(db) {
					return promiseHelpers.newQueryPromise(function() {
						return db
							.transaction("entries", 'readonly')
							.objectStore("entries")
							.index("dayNumber")
							.openCursor(new IDBKeyRange.bound(fromDayNumber, toDayNumber));
					});
				});
			}
		});
})();
