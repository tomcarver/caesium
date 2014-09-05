angular.module('store', ['promiseHelpers'])
	.provider('store', function() {
		var data = { migrations : [] };

		this.dbName = function(name) {
			data.dbName = name;
			return this;
		};

		this.migrations = function(migrationArray) {
			data.migrations = migrationArray;
			return this;
		};

		this.$get = function(promiseHelpers) {

			var ns = {};

	//				db.onversionchange = function(event) { // TODO: another tab just upgraded the DB; we probably have to refresh the page now...?
	//					db.close();
	//				};

			var newOpenPromise = function() {
				return promiseHelpers.newRequestPromise(function() { return indexedDB.open(data.dbName); });
			};

			// version when created but empty is v1
			// so after the first migration (index = 0) version = 2 - so version = migrationIndex + 2;
			var performUpgrade = function(migrationIndex) {
				if (migrationIndex < data.migrations.length)
					return promiseHelpers
						.newMigrationPromise(
							function() { return indexedDB.open(data.dbName, migrationIndex + 2); },
							data.migrations[migrationIndex])
						.then(
							function() { return performUpgrade(migrationIndex + 1); }
						);
			};

			ns.open = function() {
				return newOpenPromise()
					.then(function(db) {
						var nextMigrationIndex = db.version - 1;
						var upgradeRequired = nextMigrationIndex < data.migrations.length;

						if (upgradeRequired) {
							db.close(); // this connection will block the upgrade

							return performUpgrade(nextMigrationIndex).then(newOpenPromise);
						}
						else
							return db;
					});
			};

			ns.singleOperation = function(dbOperation) {
				return ns.open()
					.then(function(db) {
						return dbOperation(db)["finally"](function() { db.close(); });
					});
			};

			return ns;
		};
	});
