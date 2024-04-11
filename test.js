OfflineCase_Report = class {
  static get flowActions() {
    return ["ViewReport"];
  }

  static get postProcessing() {
    return {
      SetDefaultVariant: {
        transform: this.PostSetDefaultVariant,
      },
      SaveUserVariant: {
        transform: this.PostSaveUserVariant,
        validate: this.ValidateSaveUserVariant,
      },
      DeleteVariant: {
        transform: this.PostDeleteVariant,
      },
    };
  }
  static get preProcessing() {
    return {
      SetDefaultVariant: {
        transform: this.PreSetDefaultVariant,
      },
      SaveUserVariant: {
        transform: this.PreSaveUserVariant,
      },
      DeleteVariant: {
        transform: this.PreDeleteVariant,
      },
    };
  }

  /* #region Data Transforms / Activities */

  static ValidateSaveUserVariant(primaryPage) {
    let messages = [];
    let Primary = new ClipboardPage(primaryPage);

    if (Primary.SaveAs == "" && Primary.SelectedVariantName == "") {
      messages.push({
        page: primaryPage,
        property: "SelectedVariantName",
        message: OfflineUtil.message.ValueRequired(),
      });
    }
    let regex = /[^a-zA-Z0-9 ]/;
    if (Primary.SaveAs == "" && regex.test(OfflineUtil.getPropertyValue(primaryPage, "SelectedVariantName"))) {
      messages.push({
        page: primaryPage,
        property: "SelectedVariantName",
        message: "Value must not include special characters",
      });
    }

    return messages;
  }

  static async Initialize(primaryPage) {
    /* #region 1. Remove .VisibleFields */
    OfflineUtil.removeProperty(primaryPage, "VisibleFields");
    /* #endregion 1 */

    /* #region 2. Remove .AvailableFields */
    OfflineUtil.removeProperty(primaryPage, "AvailableFields");
    /* #endregion 2 */

    /* #region 3. Remove .ImplicitFields */
    OfflineUtil.removeProperty(primaryPage, "ImplicitFields");
    /* #endregion 3 */

    /* #region 4. Remove .ImplicitFilters */
    OfflineUtil.removeProperty(primaryPage, "ImplicitFilters");
    /* #endregion 4 */

    /* #region 5. Comment: extend this further in child classes. Above is logic common to all classes. */
    /* #endregion 5 */

    await OfflineCase_Report.InitializeVariantLists(primaryPage);
  }

  static async InitializeVariantLists(primaryPage) {
    let Primary = new ClipboardPage(primaryPage);
    let D_AuthProfile = new ClipboardPage("D_AuthProfile");
    Primary.VariantsForAll = [];
    Primary.VariantsForUser = [];
    let variantsList = await OfflineUtil.runQuery("select * from D_VariantList where ReportClass = ? and (Owner = ? or Owner = ?)", [Primary.pxObjClass, D_AuthProfile.Person.PersonNumber, "ALL"]);
    variantsList.forEach((item) => {
      if (item.Owner == "ALL") {
        Primary.VariantsForAll._appendAndMapTo((appendPage) => {
          appendPage.Name = item.Name;
          appendPage.Owner = item.Owner;
          appendPage.pyLabel = item.Name;
          appendPage.pzInsKey = item.Name + "!" + item.Owner;
        });
      } else {
        Primary.VariantsForUser._appendAndMapTo((appendPage) => {
          appendPage.Name = item.Name;
          appendPage.Owner = item.Owner;
          appendPage.pyLabel = item.Name;
          appendPage.pzInsKey = item.Name + "!" + item.Owner;
        });
      }
    });
  }

  static PreCustomizeColumns(primaryPage) {
    /* #region 1. Remove ModalPrimary */
    OfflineUtil.removePage("ModalPrimary");
    /* #endregion 1 */

    /* #region 2. Set ModalPrimary.AvailableFields equal to .AvailableFields */
    OfflineUtil.setPropertyValue("ModalPrimary", "AvailableFields", OfflineUtil.getPropertyValue(primaryPage, "AvailableFields"));
    /* #endregion 2 */

    /* #region 3. Set ModalPrimary.VisibleFields equal to .VisibleFields */
    OfflineUtil.setPropertyValue("ModalPrimary", "VisibleFields", OfflineUtil.getPropertyValue(primaryPage, "VisibleFields"));
    /* #endregion 3 */
  }

  static PostCustomizeColumns(primaryPage) {
    /* #region 1. Set .AvailableFields equal to ModalPrimary.AvailableFields */
    OfflineUtil.setPropertyValue(primaryPage, "AvailableFields", OfflineUtil.getPropertyValue("ModalPrimary", "AvailableFields"));
    /* #endregion 1 */

    /* #region 2. Set .VisibleFields equal to ModalPrimary.VisibleFields */
    OfflineUtil.setPropertyValue(primaryPage, "VisibleFields", OfflineUtil.getPropertyValue("ModalPrimary", "VisibleFields"));
    /* #endregion 2 */

    /* #region 3. Remove ModalPrimary */
    OfflineUtil.removePage("ModalPrimary");
    /* #endregion 3 */

    OfflineUtil.setPropertyValue(primaryPage, "SelectedVariantName", "");
    OfflineUtil.setPropertyValue(primaryPage, "LastAppliedVariant", "");
  }

  static async AddFilterFromModal(primaryPage) {
    /* #region 1. (abort if ModalPrimary does not exist or wasn't submitted) */
    let modalPrimary = OfflineUtil.getPageJSON("ModalPrimary");
    if (!modalPrimary || !modalPrimary.ActionSubmitted) {
      return;
    }
    /* #endregion 1 */

    /* #region 2. Page-Copy (append the filter) */
    let userFilters = OfflineUtil.getPropertyValue(primaryPage, "UserFilters") || [];
    userFilters.push(OfflineUtil.getPageJSON("ModalPrimary"));
    OfflineUtil.setPropertyValue(primaryPage, "UserFilters", userFilters);
    /* #endregion 2 */

    /* #region 3. Call GenerateAndRunQuery (regenerate and re-run query) */
    await this.GenerateAndRunQuery(primaryPage);
    /* #endregion 3 */

    /* #region 4. Page-Remove (remove ModalPrimary) */
    OfflineUtil.removePage("ModalPrimary");
    /* #endregion 4 */
  }

  static async ApplySelectedVariant(primaryPage, Param = {}) {
    let Primary = new ClipboardPage(primaryPage);
    Primary.SelectedVariantName = Param.VariantName || "";

    /* #region 1. (if selected variant is empty...) */
    if (!OfflineUtil.getPropertyValue(primaryPage, "SelectedVariantName")) {
      /* #region 1.1. Property-Remove (if selected variant is empty, remove filters and fields) */
      OfflineUtil.removeProperty(primaryPage, "VisibleFields");
      OfflineUtil.removeProperty(primaryPage, "AvailableFields");
      OfflineUtil.removeProperty(primaryPage, "UserFilters");
      OfflineUtil.removeProperty(primaryPage, "ImplicitFields");
      OfflineUtil.removeProperty(primaryPage, "ImplicitFilters");
      /* #endregion 1.1 */

      /* #region 1.2. Apply-DataTransform (if selected variant is empty, do intialize) */
      await this.Initialize(primaryPage);
      /* #endregion 1.2 */

      Param.VariantName = Primary.SelectedVariantName;
    }
    /* #endregion 1 */

    /* #region 2. (otherwise...) */
    if (OfflineUtil.getPropertyValue(primaryPage, "SelectedVariantName")) {
      /* #region 2.1. Property-Set (get index of matching variant (and abort if missing)) */
      let variantName = OfflineUtil.whatComesBeforeFirst(OfflineUtil.getPropertyValue(primaryPage, "SelectedVariantName"), "!");
      let variantOwner = OfflineUtil.whatComesAfterFirst(OfflineUtil.getPropertyValue(primaryPage, "SelectedVariantName"), "!");
      if (!variantOwner) variantOwner = "ALL";
      /* #endregion 2.1 */

      /* #region 2.2. Property-Set (remember the visible fields) */
      let originalVisible = OfflineUtil.getPropertyValue(primaryPage, "VisibleFields");
      let originalAvailable = OfflineUtil.getPropertyValue(primaryPage, "AvailableFields");
      let userFilters = OfflineUtil.getPropertyValue(primaryPage, "UserFilters");
      /* #endregion 2.2 */

      /* #region 2.3. Loop .VisibleFields: Property-Set (move all visible fields to available) */
      let availableFields = [...(OfflineUtil.getPropertyValue(primaryPage, "AvailableFields") || []), ...(OfflineUtil.getPropertyValue(primaryPage, "VisibleFields") || [])];
      OfflineUtil.setPropertyValue(primaryPage, "AvailableFields", availableFields);
      /* #endregion 2.3 */

      /* #region 2.4. Property-Remove (remove filters) */
      OfflineUtil.removeProperty(primaryPage, "VisibleFields");
      OfflineUtil.removeProperty(primaryPage, "UserFilters");
      /* #endregion 2.4 */

      /* #region 2.5. Loop D_VariantFilterList[ReportClass:.pxObjClass,VariantName:local.variantName,Owner:local.variantOwner].pxResults (loop through variant fiters...) */
      let D_VariantFilterList = await OfflineUtil.runQuery("Select * from D_VariantFilterList where ReportClass = ? and variantName = ? and owner = ?", [OfflineUtil.getPropertyValue(primaryPage, "pxObjClass"), variantName, variantOwner]);
      D_VariantFilterList.forEach((filter) => {
        /* #region 2.5.1 Property-Set (find the matching field and abort if not found) */
        let fieldIndex = OfflineUtil.getPropertyValue(primaryPage, "AvailableFields").findIndex((field) => field.Label.includes(filter.Column));
        //Transition
        if (fieldIndex < 0) return;
        /* #endregion 2.5.1 */

        let newLength;

        /* #region 2.5.2 Property-Set (add filters) */
        newLength = Primary.UserFilters._appendAndMapTo((appendPage) => {
          appendPage.Comparison = filter.Comparison;
          appendPage.Value = filter.FilterValue;
          appendPage.ValueLabel = filter.FilterValue;
          appendPage.Order = filter.Sort;
          appendPage.Field = Primary.AvailableFields[fieldIndex];
          Param.DataType = Primary.AvailableFields[fieldIndex].DataType;
        });
        /* #endregion 2.5.2 */

        /* #region 2.5.3 Property-Set (add filters for today offset) */
        if (filter.FilterValue.startsWith("{") && (Param.DataType == "Date" || Param.DataType == "DateTime")) {
          let match = Primary.UserFilters[newLength - 1].Value.match(/\(([^,)]+)[,)]/);
          Primary.UserFilters[newLength - 1].DaysOffset = match ? match[1] : "";
          match = Primary.UserFilters[newLength - 1].Value.match(/,\s*([^)]+)/);
          Primary.UserFilters[newLength - 1].RelativeTime = match ? match[1] : "";
          match = Primary.UserFilters[newLength - 1].Value.match(/{([^()]+)\(/);
          Primary.UserFilters[newLength - 1].RelativeDate = match ? match[1].toUpperCase() : "";
          Primary.UserFilters[newLength - 1].Advanced = "true";

          OfflineEmbed_ReportFilter.SetRelativeValue(primaryPage + ".UserFilters(" + newLength + ")", Param);
          OfflineEmbed_ReportFilter.SetValueLabel(primaryPage + ".UserFilters(" + newLength + ")");

          Primary.UserFilters[newLength - 1].Value = `'` + Primary.UserFilters[newLength - 1].Value + `'`;
        }
        /* #endregion 2.5.3 */

        /* #region 2.5.4 Apply-DataTransform (Lookup compare operator) */
        OfflineEmbed_ReportFilter.SetComparisonType(`${primaryPage}.UserFilters(${newLength})`);
        /* #endregion 2.5.4 */

        /* #region 2.5.5 Page-Change-Class */
        //In offline version, this is handled in previous step.
        /* #endregion 2.5.5 */

        /* #region 2.5.6 */
        //No action
        /* #endregion 2.5.6 */
      });
      /* #endregion 2.5 */

      /* #region 2.6. Loop D_VariantColumnList[ReportClass:.pxObjClass,VariantName:local.variantName,Owner:local.variantOwner].pxResults (loop through the variant fields...) */
      let columns = await OfflineUtil.runQuery("Select * from D_VariantColumnList where ReportClass = ? and variantName = ? and owner = ?", [OfflineUtil.getPropertyValue(primaryPage, "pxObjClass"), variantName, "ALL"]);
      let newVisibleFields = [];
      columns.forEach((column) => {
        /* #region 2.6.1. Property-Set (find the matching field and abort if not found) */
        let fieldIndex = OfflineUtil.getPropertyValue(primaryPage, "AvailableFields").findIndex((field) => field.DatabasePath == column.Column);
        // Transition
        if (fieldIndex < 0) return;
        /* #endregion 2.6.1 */

        /* #region 2.6.2. Property-Set (move the matching field to visible) */
        newVisibleFields.push(availableFields.splice(fieldIndex, 1)[0]);
        OfflineUtil.setPropertyValue(primaryPage, "VisibleFields", newVisibleFields);
        /* #endregion 2.6.2 */

        /* #region 2.6.3. Property-Remove (remove the matching field from available) */
        //In offline version, this is handled in previous step.
        /* #endregion 2.6.3 */

        /* #region 2.6.4 */
        //No action
        /* #endregion 2.6.4 */
      });
      /* #endregion 2.6 */

      /* #region 2.7. Property-Set (if no fields, restore the remembered fields) */
      if (newVisibleFields[0]) {
        OfflineUtil.setPropertyValue(primaryPage, "AvailableFields", availableFields);
        OfflineUtil.setPropertyValue(primaryPage, "VisibleFields", newVisibleFields);
      } else {
        OfflineUtil.setPropertyValue(primaryPage, "AvailableFields", originalAvailable);
        OfflineUtil.setPropertyValue(primaryPage, "VisibleFields", originalVisible);
      }
      /* #endregion 2.7 */

      if (!D_VariantFilterList[0]) {
        console.log("ohno");
        OfflineUtil.setPropertyValue(primaryPage, "UserFilters", userFilters);
      }

      /* #region 2.8. Page-Remove (cleanup) */
      OfflineUtil.removePage("CurrentColumns");
      /* #endregion 2.8 */
    }
    /* #endregion 2 */

    /* #region 3. Call GenerateAndRunQuery (re-run query) */
    console.log(Primary.UserFilters._valueOf());
    await this.GenerateAndRunQuery(primaryPage, { VariantName: Param.VariantName });
    /* #endregion 3 */

    OfflineUtil.setPropertyValue(primaryPage, "AppliedFilter", OfflineUtil.whatComesBeforeFirst(Primary.SelectedVariantName, "!"));
  }

  static async GetNextPage(primaryPage) {
    /* #region 1. Property-Set (Set Length of Query and set it as the offset for query) */
    let queryResults = OfflineUtil.getPropertyValue(primaryPage, "QueryResults") || [];
    let offset = queryResults.length;
    /* #endregion 1 */

    /* #region 2. Call GenerateAndRunQuery (Generate Query) */
    await this.GenerateAndRunQuery(primaryPage, { Offset: offset });
    /* #endregion 2 */
  }

  static async ClearFilters(primaryPage) {
    /* #region 1. Property-Remove */
    OfflineUtil.removeProperty(primaryPage, "UserFilters");
    /* #endregion 1 */

    /* #region 2. Call GenerateAndRunQuery */
    await this.GenerateAndRunQuery(primaryPage);
    /* #endregion 2 */
  }

  static async RemoveFilter(primaryPage) {
    /* #region 1. For Each Page In .UserFilters */
    //Logic is implemented without using a loop in offline mode.
    let userFilters = OfflineUtil.getPropertyValue(primaryPage, "UserFilters") || [];
    userFilters = userFilters.filter((filter) => !filter.pyDeletedObject);
    OfflineUtil.setPropertyValue(primaryPage, "UserFilters", userFilters);

    /* #region 1.1. when .pyDeletedObject=="true" */

    /* #region 1.1.1. Remove Primary.UserFilters(<current>) */
    /* #endregion 1.1.1 */

    /* #endregion 1.1 */

    /* #endregion 1 */

    /* #region 2. Apply Data Transform GenerateAndRunQuery */
    this.GenerateAndRunQuery(primaryPage);
    /* #endregion 2 */
  }

  static async PreViewReport(primaryPage) {
    let Primary = new ClipboardPage(primaryPage);
    let D_AuthProfile = new ClipboardPage("D_AuthProfile");

    if (Primary.SelectedVariantName == "") {
      let setting = await Offline_DataPages.D_UserSetting({ PersonNumber: D_AuthProfile.Person.PersonNumber, Name: "DefaultView-" + Primary.pxObjClass });
      if (setting[0]) Primary.SelectedVariantName = setting[0].Value;
    }

    /* #region 1. Call Apply-DataTransform */
    if (OfflineUtil.getPropertyValue(primaryPage, "SelectedVariantName")) {
      await this.Initialize(primaryPage);
    }
    /* #endregion 1 */

    /* #region 2. Call ApplySelectedVariant */
    let variantName = "";
    if (Primary.SelectedVariantName != "") variantName = Primary.SelectedVariantName;
    await this.ApplySelectedVariant(primaryPage, { VariantName: variantName });
    /* #endregion 2 */
  }

  static async GenerateAndRunQuery(primaryPage, parameters = {}) {
    /* #region Initialize variables */
    let userFilters = OfflineUtil.getPropertyValue(primaryPage, "UserFilters") || [];
    let visibleFields = OfflineUtil.getPropertyValue(primaryPage, "VisibleFields") || [];
    let availableFields = OfflineUtil.getPropertyValue(primaryPage, "AvailableFields") || [];
    let implicitFields = OfflineUtil.getPropertyValue(primaryPage, "ImplicitFields") || [];
    let implicitFilters = OfflineUtil.getPropertyValue(primaryPage, "ImplicitFilters") || [];
    let quickSearchCriteria = OfflineUtil.getPropertyValue(primaryPage, "QuickSearchCriteria") || [];
    /* #endregion Initialize */

    OfflineUtil.setPropertyValue(primaryPage, "SelectedVariantName", parameters.VariantName || "");
    OfflineUtil.setPropertyValue(primaryPage, "LastAppliedVariant", parameters.VariantName || "");

    /* #region 1. Property-Set (default limit and offset) */
    if (!parameters) parameters = {};
    let limit = parameters.Limit;
    let offset = parameters.Offset;
    if (!limit) limit = 50;
    if (!offset) offset = 0;
    /* #endregion 1 */

    /* #region 2. Property-Set (set filter count) */
    OfflineUtil.setPropertyValue(primaryPage, "UserFiltersCount", userFilters.length);
    OfflineUtil.setPropertyValue(primaryPage, "ResultsCount", 0);
    /* #endregion 2 */

    /* #region 3. Property-Set (Initialize the clauses) */
    let selectTerms = "";
    let orderByTerms = "";
    let whereClause = "";
    let quickSearchClause = "";
    /* #endregion 3 */

    /* #region 4. Loop .VisibleFields: Property-Set (fields to select...) */
    visibleFields.forEach((field) => {
      selectTerms = selectTerms + field.DatabasePath + ' AS "' + field.PropertyPath + '",';
    });
    /* #endregion 4 */

    /* #region 5. Loop .AvailableFields: Property-Set (fields to select...) */
    availableFields.forEach((field) => {
      selectTerms = selectTerms + field.DatabasePath + ' AS "' + field.PropertyPath + '",';
    });
    /* #endregion 5 */

    /* #region 6. Loop ImplicitFields: Property-Set (fields to select...) */
    implicitFields.forEach((field) => {
      selectTerms = selectTerms + field.DatabasePath + ' AS "' + field.PropertyPath + '",';
    });
    /* #endregion 6 */

    /* #region 7. Loop .UserFilters (sorts to apply...) */
    userFilters.forEach((filter) => {
      if (!filter.Order) return;

      /* #region 1. Property-Map-DecisionTable (look up the Order phrase (e.g. "ASC" should be "ASC NULLS FIRST" online, because PostgreSQL is different from SQLite)) */
      //No action required offline
      /* #endregion 1 */

      /* #region 2. Property-Set */
      orderByTerms = orderByTerms == "" ? " ORDER BY " : orderByTerms;
      orderByTerms = orderByTerms + filter.Field.DatabasePath + " " + filter.Order + ", ";
      /* #endregion 2 */
    });
    /* #endregion 7 */

    /* #region 8. Loop .ImplicitFilters (sorts to apply...) */
    implicitFilters.forEach((filter) => {
      if (!filter.Order) return;

      /* #region 1. Property-Map-DecisionTable (look up the Order phrase (e.g. "ASC" should be "ASC NULLS FIRST" online, because PostgreSQL is different from SQLite)) */
      //No action required offline
      /* #endregion 1 */

      /* #region 2. Property-Set */
      orderByTerms = orderByTerms == "" ? " ORDER BY " : orderByTerms;
      orderByTerms = orderByTerms + filter.Field.DatabasePath + " " + filter.Order + ", ";
      /* #endregion 2 */
    });
    /* #endregion 8 */

    /* #region 9. (todo - avoid applying sorts if another later sort is done on the same field) */
    //No action
    /* #endregion 9 */

    /* #region 10. Loop .UserFilters (filters to apply...) */
    userFilters.forEach((filter) => {
      if (!filter.CompareOperator) return;

      /* #region 1. Property-Set (set default where clause prefix and suffix) */
      let whereClausePrefix = " LOWER(";
      let whereClauseSuffix = ") ";
      /* #endregion 1 */

      /* #region 2. Property-Set (set Date or Number where clause prefix and suffix) */
      if (filter.Field.DataType != "Text") {
        whereClausePrefix = "";
        whereClauseSuffix = " ";
      }
      /* #endregion 2 */

      /* #region 3. Property-Set (sanitize value) */
      let value = filter.Value || "";
      value = value.replace(/\\/g, "\\\\");
      value = value.replace(/\%/g, "\\%");
      value = value.replace(/\_/g, "\\_");
      if (filter.Field.DataType != "Date" && filter.Field.DataType != "DateTime") value = value.replace(/\'/g, "\\'");
      if (filter.Field.DataType != "Date" && filter.Field.DataType != "DateTime") value = value.toLowerCase();
      /* #endregion 3 */

      /* #region 4. Property-Set (append to where clause) */
      whereClause = whereClause == "" ? " WHERE " : whereClause;
      let repeatingPortion = OfflineUtil.whatComesBeforeLast(OfflineUtil.whatComesAfterFirst(filter.CompareOperator, "~"), "~");
      whereClause = whereClause + "(" + whereClausePrefix + filter.Field.DatabasePath + whereClauseSuffix + filter.CompareOperator.replace("{1}", value);
      whereClause = OfflineUtil.whatComesBeforeFirst(whereClause, "~") + OfflineUtil.whatComesAfterLast(whereClause, "~") + "~~";
      let columnName = filter.Field.DatabasePath;
      /* #endregion 4 */

      /* #region 5. Loop .AdditionalValues (Append additional values.) */
      let additionalValues = filter.AdditionalValues || [];
      additionalValues.forEach((page) => {
        /* #region 9.5.1 Property-Set (sanitize value) */
        let value = page.Value || "";
        value = value.replace(/\\/g, "\\\\");
        value = value.replace(/\%/g, "\\%");
        value = value.replace(/\_/g, "\\_");
        value = value.replace(/\'/g, "\\'");
        value = value.toLowerCase();
        /* #endregion 9.5.1 */

        /* #region 9.5.2 Property-Set */
        whereClause = OfflineUtil.whatComesBeforeLast(whereClause, "~") + repeatingPortion + OfflineUtil.whatComesAfterLast(whereClause, "~");
        whereClause = whereClause.replaceAll("{2}", page.Value);
        /* #endregion 9.5.2 */
      });
      /* #endregion 5 */

      /* #region 6. Property-Set */
      whereClause = whereClause.replaceAll("{0}", columnName);
      whereClause = OfflineUtil.whatComesBeforeFirst(whereClause, "~") + OfflineUtil.whatComesAfterLast(whereClause, "~") + ") AND ";
      /* #endregion 6 */

      /* #region 7 TODO - handle additional values */
      //No action
      /* #endregion 7 */
    });
    /* #endregion 10 */

    /* #region 11. Loop .ImplicitFilters (filters to apply...) */
    implicitFilters.forEach((filter) => {
      if (!filter.CompareOperator) return;

      /* #region 1. Property-Set (sanitize value) */
      let value = filter.Value || "";
      value = value.replace(/\\/g, "\\\\");
      value = value.replace(/\%/g, "\\%");
      value = value.replace(/\_/g, "\\_");
      value = value.replace(/\'/g, "\\'");
      /* #endregion 1 */

      /* #region 2. Property-Set (append to where clause) */
      whereClause = whereClause == "" ? " WHERE " : whereClause;
      whereClause = whereClause + "(" + filter.Field.DatabasePath + " " + filter.CompareOperator.replaceAll("{1}", value) + ") AND ";
      /* #endregion 2 */

      /* #region 3. (TODO - handle additional values) */
      //No action
      /* #endregion 3 */
    });
    /* #endregion 11 */

    /* #region 12. Loop .QuickSearchCriteria (filters to apply...) */
    quickSearchCriteria.forEach((filter) => {
      if (!OfflineUtil.getPropertyValue(primaryPage, "QuickSearchValue")) return;
      /* #region 1. Property-Set (sanitize value) */
      let value = filter.Value || "";
      value = value.replace(/\\/g, "\\\\");
      value = value.replace(/\%/g, "\\%");
      value = value.replace(/\_/g, "\\_");
      value = value.replace(/\'/g, "\\'");
      value = value.toLowerCase();
      /* #endregion 1 */

      /* #region 2. Property-Set ( open quick search clause) */
      if (!quickSearchClause) quickSearchClause = " (";
      /* #endregion 2 */

      /* #region 3. Property-Set (append to where clause) */

      quickSearchClause = quickSearchClause + filter.CompareOperator.replaceAll("{1}", value) + " OR ";
      /* #endregion 3 */
    });
    /* #endregion 12 */

    /* #region 13. Property-Set (trim the select and order) */
    selectTerms = OfflineUtil.whatComesBeforeLast(selectTerms, ",");
    orderByTerms = OfflineUtil.whatComesBeforeLast(orderByTerms, ",");
    let whereClauseLength = whereClause.length;
    let quickSearchClauseLength = quickSearchClause.length;
    /* #endregion 13 */

    /* #region 14. Property-Set (trim the quick search clause clause) */
    if (quickSearchClauseLength > 3) {
      quickSearchClause = quickSearchClause.substring(0, quickSearchClauseLength - 4);
      quickSearchClause = quickSearchClause + " )";
      whereClause = whereClause == "" ? " WHERE " : whereClause;
      whereClause = whereClause + quickSearchClause + " AND ";
      whereClauseLength = whereClause.length;
    }
    /* #endregion 14 */

    /* #region 15. Property-Set (trim the where clause) */
    if (whereClauseLength > 4) whereClause = whereClause.substring(0, whereClauseLength - 5);
    /* #endregion 15 */

    /* #region 16. Property-Set (Determine Select Clause) */
    let selectClause = "SELECT ";
    let selectDistinctRows = OfflineUtil.getPropertyValue(primaryPage, "SelectDistinctRows");
    if (selectDistinctRows && selectDistinctRows == "true") selectClause = "SELECT DISTINCT ";
    /* #endregion 16 */

    /* #region 17. Property-Set (Build query) */
    let query = selectClause + selectTerms + " FROM " + OfflineUtil.getPropertyValue(primaryPage, "QuerySource") + whereClause + (OfflineUtil.getPropertyValue(primaryPage, "GroupBy") || "") + orderByTerms + " LIMIT " + (limit + 1) + " OFFSET " + offset;
    /* #endregion 17 */

    /* #region 18. RDB-List (Run query) */
    let results = await OfflineUtil.runQuery(query, []);
    /* #endregion 18 */

    /* #region 19. Property-Set (Determine End Of Paging) */
    if (results.length > limit) {
      OfflineUtil.setPropertyValue(primaryPage, "HasMoreResults", "true");
    } else {
      OfflineUtil.setPropertyValue(primaryPage, "HasMoreResults", "false");
    }
    /* #endregion 19 */

    /* #region 20. Page-Remove (Remove last page to maintain limit count of results) */
    if (results.length > limit) {
      results.pop();
    }
    /* #endregion 20 */

    /* #region 21. Property-Remove (reset results) */
    if (!offset || offset <= 0) OfflineUtil.removeProperty(primaryPage, "QueryResults");
    /* #endregion 21 */

    /* #region 22. Loop QueryResults.pxResults (loop and append results) */
    for (let i of results) {
      /* #region 1. Property-Set (set filter count) */
      let result = OfflineUtil.replaceNestedKeys(i);
      result.pxObjClass = OfflineUtil.getPropertyValue(primaryPage, "ClassOfResults");
      /* #endregion 1 */

      /* #region 2. Property-Set (set filter count) */
      OfflineUtil.appendToPageList(primaryPage, "QueryResults", result);
      /* #endregion 2 */
    }
    /* #endregion 22 */

    /* #region 23. Property-Set */
    OfflineUtil.setPropertyValue(primaryPage, "ResultsCount", results.length);
    /* #endregion 23 */
  }

  static async PreSaveUserVariant(primaryPage, parameters = {}) {
    let Primary = new ClipboardPage(primaryPage);
    Primary.SelectedVariantName = "";
    Primary.SaveAs = "";
    Primary.IncludeInSavedVariant = "both";
    Primary.SetAsDefault = "false";
  }

  static async PreSetDefaultVariant(primaryPage, parameters = {}) {
    let Primary = new ClipboardPage(primaryPage);
    Primary.SelectedVariantName = Primary.LastAppliedVariant;
  }

  static async PreDeleteVariant(primaryPage, parameters = {}) {
    let Primary = new ClipboardPage(primaryPage);
    Primary.SelectedVariantName = Primary.LastAppliedVariant;
  }

  static async PostDeleteVariant(primaryPage, parameters = {}) {
    let Primary = new ClipboardPage(primaryPage);
    let owner = OfflineUtil.whatComesAfterFirst(Primary.LastAppliedVariant, "!");
    let name = OfflineUtil.whatComesBeforeFirst(Primary.LastAppliedVariant, "!");
    let setting = "DefaultView-" + Primary.pxObjClass;
    //delete variant
    await OfflineUtil.runQuery("delete from D_VariantList where name = ? and owner = ?", [name, owner]);
    //delete columns
    await OfflineUtil.runQuery("delete from D_VariantFilterList where variantname = ? and owner = ?", [name, owner]);
    //delete filters
    await OfflineUtil.runQuery("delete from D_VariantColumnList where name = ? and owner = ?", [name, owner]);
    //delete setting
    await OfflineUtil.runQuery("delete from D_UserSettingList where name = ? and personnumber = ? and value = ?", [setting, owner, Primary.LastAppliedVariant]);
    //call the quieue function and pass a page which has LastAppliedVariant and pxObjClass
    launchbox.PRPC.ClientStore.addAction("", "", '{"action":"callActivity","className":"GCSS-DiscOps-Work-Report","activityName":"PostDeleteVariant"}', `{"pxObjClass":"${Primary.pxObjClass}","LastAppliedVariant":"${Primary.LastAppliedVariant}"}`);
    //clear variant
    Primary.SelectedVariantName = "";
    Primary.LastAppliedVariant = "";
  }

  static async PostSaveUserVariant(primaryPage, parameters = {}) {
    let Primary = new ClipboardPage(primaryPage);
    let D_AuthProfile = new ClipboardPage("D_AuthProfile");
    if (Primary.SaveAs != "") {
      Primary.SelectedVariantName = Primary.SaveAs;
    }
    await OfflineUtil.runQuery("insert or replace into D_VariantList (softflag, Owner, Name, ReportClass) VALUES (0, ?,?,?)", [D_AuthProfile.Person.PersonNumber, Primary.SelectedVariantName, Primary.pxObjClass]);
    //delete filters
    await OfflineUtil.runQuery("delete from D_VariantFilterList where owner = ? and variantname = ? and reportclass = ?", [D_AuthProfile.Person.PersonNumber, Primary.SelectedVariantName, Primary.pxObjClass]);
    //save new filters
    if (Primary.IncludeInSavedVariant == "both" || Primary.IncludeInSavedVariant == "filters") {
      let UserFilters = OfflineUtil.getPropertyValue(primaryPage, "UserFilters") || [];
      for (let i = 0; i < UserFilters.length; i++) {
        let stepPage = OfflineUtil.getPageJSON(`${primaryPage}.UserFilters(${i + 1})`);
        let filterValue = stepPage.Value;
        if ((stepPage.Field.DataType == "Date" || stepPage.Field.DataType == "DateTime") && (stepPage.Advanced == true || stepPage.Advanced == "true")) {
          filterValue = "{" + stepPage.RelativeDate + "(" + stepPage.DaysOffset + "," + stepPage.RelativeTime + ")}";
        }
        await OfflineUtil.runQuery("insert or replace into D_VariantFilterList (softflag, Sequence, Owner, VariantName, ReportClass, Sort, FilterValue, Comparison, Column) VALUES (0,?,?,?,?,?,?,?,?)", [i + 1, D_AuthProfile.Person.PersonNumber, Primary.SelectedVariantName, Primary.pxObjClass, stepPage.Order || "", stepPage.Value, stepPage.Comparison, stepPage.Field.Label]);
      }
    }
    //delete columns
    await OfflineUtil.runQuery("delete from D_VariantColumnList where owner = ? and variantname = ? and reportclass = ?", [D_AuthProfile.Person.PersonNumber, Primary.SelectedVariantName, Primary.pxObjClass]);
    //save new columns
    if (Primary.IncludeInSavedVariant == "both" || Primary.IncludeInSavedVariant == "columns") {
      let VisibleFields = OfflineUtil.getPropertyValue(primaryPage, "VisibleFields") || [];
      for (let i = 0; i < VisibleFields.length; i++) {
        let stepPage = OfflineUtil.getPageJSON(`${primaryPage}.VisibleFields(${i + 1})`);
        await OfflineUtil.runQuery("insert or replace into D_VariantColumnList (softflag, Column, Owner, VariantName, ReportClass, Sequence) VALUES (0,?,?,?,?,?)", [stepPage.Label, D_AuthProfile.Person.PersonNumber, Primary.SelectedVariantName, Primary.pxObjClass, i + 1]);
      }
    }
    //queue activity
    let page = JSON.stringify(OfflineUtil.getPageJSON(primaryPage));
    page.SetAsDefault = false;
    launchbox.PRPC.ClientStore.addAction("", "", '{"action":"callActivity","className":"GCSS-DiscOps-Work-Report","activityName":"PostSaveUserVariant"}', page);
    //set selected variant
    Primary.LastAppliedVariant = Primary.SelectedVariantName + "!" + D_AuthProfile.Person.PersonNumber;
    Primary.SelectedVariantName = Primary.LastAppliedVariant;
    //set default if applicable
    if (Primary.SetAsDefault == true || Primary.SetAsDefault == "true") {
      await OfflineCase_Report.PostSetDefaultVariant(primaryPage);
    }
  }

  static async PostSetDefaultVariant(primaryPage, Param = {}) {
    let Primary = new ClipboardPage(primaryPage);
    let D_AuthProfile = new ClipboardPage("D_AuthProfile");

    await OfflineUtil.runQuery("insert or replace into D_UserSettingList (softflag, Name, PersonNumber, Value) VALUES (0,?,?,?)", ["DefaultView-" + Primary.pxObjClass, D_AuthProfile.Person.PersonNumber, Primary.LastAppliedVariant]);

    launchbox.PRPC.ClientStore.addAction("", "", '{"action":"callActivity","className":"GCSS-DiscOps-Work-Report","activityName":"PostSetDefaultVariant"}', `{"pxObjClass":"${Primary.pxObjClass}","LastAppliedVariant":"${Primary.LastAppliedVariant}"}`);

    Primary.SelectedVariantName = Primary.LastAppliedVariant;
  }

  /* #endregion Data Transforms */

  static async DownloadAllAsCSV(primaryPage) {
    function formatDate(inputDate, dateOnly = false) {
      let formattedDateStr = inputDate;

      if (inputDate.length === 8) {
        formattedDateStr = `${inputDate}T000000.000 GMT`;
      }

      const dateRegex = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.\d+\sGMT$/;
      const match = formattedDateStr.match(dateRegex);

      if (!match) {
        throw new Error("Invalid date format");
      }

      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      let hour = parseInt(match[4]);
      const minute = parseInt(match[5]);
      const second = parseInt(match[6]);

      if (hour === 24) {
        hour = 0;
      }

      const formattedDate = new Date(year, month - 1, day, hour, minute, second);

      if (dateOnly) {
        const options = {
          month: "numeric",
          day: "numeric",
          year: "numeric",
        };

        return formattedDate.toLocaleString("en-US", options).replace(",", "");
      } else {
        const options = {
          month: "numeric",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        };

        return formattedDate.toLocaleString("en-US", options).replace(",", "").replace(" 24:", " 00:");
      }
    }

    function getCurrentDateTime() {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      const hours = String(currentDate.getHours()).padStart(2, "0");
      const minutes = String(currentDate.getMinutes()).padStart(2, "0");

      return `${year}-${month}-${day}T${hours}-${minutes}`;
    }

    OfflineUtil.pageAdoptJSON("ResultsForDownload", OfflineUtil.getPageJSON(primaryPage));
    await this.GenerateAndRunQuery("ResultsForDownload", {
      Limit: 100000,
      Offset: 0,
    });

    let csvContent = "data:text/csv;charset=utf-8,";
    let csvArray = [[]];

    let availableFields = OfflineUtil.getPropertyValue(primaryPage, "AvailableFields") || [];
    let visibleFields = OfflineUtil.getPropertyValue(primaryPage, "VisibleFields") || [];
    let allFields = [...visibleFields, ...availableFields];
    allFields.forEach((field) => {
      csvArray[0].push(field.Label);
    });

    let results = OfflineUtil.getPropertyValue("ResultsForDownload", "QueryResults") || [];
    results.forEach((result) => {
      let newRow = [];
      allFields.forEach((field) => {
        let keys = field.PropertyPath.split(".");
        let output = result;
        for (const key of keys) {
          if (output.hasOwnProperty(key)) {
            output = output[key];
          } else {
            output = "";
            break;
          }
        }
        if (field.DataType == "DateTime" && output) {
          newRow.push(formatDate(output));
        } else if (field.DataType == "Date" && output) {
          newRow.push(formatDate(output, true));
        } else if (field.DataType == "Number" && output) {
          newRow.push(output);
        } else {
          if (output === null || output === undefined || (typeof value === "number" && isNaN(value))) output = "";
          output = '"' + String(output).replace(/"/g, '""') + '"';
          newRow.push(output);
        }
      });
      csvArray.push(newRow);
    });

    csvArray.forEach((rowArray) => {
      let row = rowArray.join(",");
      csvContent += row + "\r\n";
    });

    let title = OfflineUtil.getPropertyValue(primaryPage, "pyLabel");
    title = title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/(?:^|\s)([a-z])/g, (_, letter) => letter.toUpperCase());
    title = title + "_" + getCurrentDateTime();

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", title);
    link.click();
  }

  static async onCreateCase(primaryPage, paramString) {
    let params = OfflineUtil.convertStringMapToObject(paramString);
    if (params.VariantName) {
      OfflineUtil.setPropertyValue(primaryPage, "SelectedVariantName", params.VariantName);
    }
    await this.PreViewReport(primaryPage);
  }

  static async QuickSearch(primaryPage, Param = {}) {}

  static generateTransforms(className) {
    OfflineEmbed_ReportField.generateTransforms();
    OfflineEmbed_ReportFilter.generateTransforms();
    let dataTransforms = {
      intialize: this.Initialize,
      precustomizecolumns: this.PreCustomizeColumns,
      postcustomizecolumns: this.PostCustomizeColumns,
      addfilterfrommodal: this.AddFilterFromModal,
      getnextpage: this.GetNextPage,
      clearfilters: this.ClearFilters,
      removefilter: this.RemoveFilter,
      generateandrunquery: this.GenerateAndRunQuery,
      applyselectedvariant: this.ApplySelectedVariant,
      previewreport: this.PreViewReport,
      predeletevariant: this.PreDeleteVariant,
      presaveuservariant: this.PreSaveUserVariant,
      presetdefaultvariant: this.PreSetDefaultVariant,
      postdeletevariant: this.PostDeleteVariant,
      postsaveuservariant: this.PostSaveUserVariant,
      postsetdefaultvariant: this.PostSetDefaultVariant,
      quicksearch: this.QuickSearch,
    };
    let baseClassName = "gcss_discops_work_report";
    OfflineUtil.generateTransforms(this, dataTransforms, className, baseClassName);
  }

  static get customization() {
    return class OfflineCase_Customization {
      static moveFromListToList(page, sourceListName, destinationListName, fieldToMatch, valueToMatch) {
        let sourceList = OfflineUtil.getPropertyValue(page, sourceListName) || [];
        let destinationList = OfflineUtil.getPropertyValue(page, destinationListName) || [];
        //find row in sourceList
        let index = sourceList.findIndex((obj) => obj[fieldToMatch] == valueToMatch);
        if (index >= 0) {
          let matchedObj = sourceList.splice(index, 1)[0];
          destinationList.push(matchedObj);
          OfflineUtil.setPropertyValue(page, sourceListName, sourceList);
          OfflineUtil.setPropertyValue(page, destinationListName, destinationList);
          OfflineUtil.refreshSection("CustomizeColumns", false);
        }
      }
      static shift(page, listName, fieldToMatch, valueToMatch, offset) {
        let sourceList = OfflineUtil.getPropertyValue(page, listName) || [];
        let index = sourceList.findIndex((obj) => obj[fieldToMatch] == valueToMatch);
        if (index >= 0) {
          let newIndex = index + parseInt(offset);
          if (newIndex < 0) newIndex = 0;
          if (newIndex >= sourceList.length) newIndex = sourceList.length - 1;
          let matchedObj = sourceList.splice(index, 1)[0];
          sourceList.splice(newIndex, 0, matchedObj);
          OfflineUtil.refreshSection("CustomizeColumns", false);
        }
      }
    };
  }

  static formatPropertyPathDate(propertyPath) {
    return `strftime('%Y%m%d', datetime(${propertyPath}, 'utc'))`;
  }

  static formatPropertyPathDateTime(propertyPath) {
    return `strftime('%Y%m%dT%H%M%S.000 GMT', datetime(${propertyPath}, 'utc'))`;
  }

  static formatPropertyPathDateTimeCombined(propertyPathDate, propertyPathTime) {
    return `strftime('%Y%m%d', ${propertyPathDate}, 'utc') || 'T' || strftime('%H%M%S', ${propertyPathTime}) || '.000 GMT'`;
  }

  static async showActionMenu(eventObj) {
    const contextPage = "pyWorkPage";
    let Primary = new ClipboardPage(contextPage);
    eventObj.target.removeAttribute("data-menuid");
    var menuid = Date.now();
    var actionMenu = new OfflineUtil.navigation(menuid);

    actionMenu.addMenuItem("Hide / Reorder columns...", [`$('.CustomizeAction > span > a')[0].click()`]);
    actionMenu.addSubMenu("Apply view", (child) => {
      let userVariants = OfflineUtil.getPropertyValue(contextPage, "VariantsForUser") || [];
      let systemVariants = OfflineUtil.getPropertyValue(contextPage, "VariantsForAll") || [];
      userVariants.forEach((item) => {
        child.addMenuItem(item.Name, [`OfflineUtil.refreshSectionWithDataTransform(event, "GCSS-DiscOps-Work-Report", "ViewReport", "ApplySelectedVariant", true, "VariantName", "${item.pzInsKey}")`]);
      });
      if (userVariants[0] && systemVariants[0]) {
        child.addSeparator();
      }
      systemVariants.forEach((item) => {
        child.addMenuItem(item.Name, [`OfflineUtil.refreshSectionWithDataTransform(event, "GCSS-DiscOps-Work-Report", "ViewReport", "ApplySelectedVariant", true, "VariantName", "${item.pzInsKey}")`]);
      });
      if (!userVariants[0] && !systemVariants[0]) {
        child.addMenuItemDisabled("<No views defined>>");
      }
    });
    actionMenu.addSubMenu("Manage views", (child) => {
      child.addMenuItem("Save as...", [`$('.SaveSettingsAction > span > a')[0].click()`]);
      if (Primary.SelectedVariantName != "") {
        child.addMenuItem("Set as default...", [`$('.SetDefaultAction > span > a')[0].click()`]);
      } else {
        child.addMenuItemDisabled("Set as default...");
      }
      if (Primary.SelectedVariantName != "" && OfflineUtil.whatComesAfterLast(Primary.SelectedVariantName, "!") != "ALL") {
        child.addMenuItem("Delete selected...", [`$('.DeleteAction > span > a')[0].click()`]);
      } else {
        child.addMenuItemDisabled("Delete selected...");
      }
    });
    actionMenu.addSeparator();
    actionMenu.addMenuItem("Download as CSV...", []);

    var config = actionMenu.getBuildAndConfig({});
    pega.control.menu.showContextMenu(config, eventObj.target, eventObj);
  }
};

OfflineCase_Report_Inventory = class extends OfflineCase_Report {
  static async onCreateCase(primaryPage, paramString) {
    let params = OfflineUtil.convertStringMapToObject(paramString);
    if (params.VariantName) {
      OfflineUtil.setPropertyValue(primaryPage, "SelectedVariantName", params.VariantName);
    }
    if (params.Type) {
      OfflineUtil.setPropertyValue(primaryPage, "Type", params.Type);
    }
    await this.PreViewReport(primaryPage);
  }

  static Initialize(primaryPage) {
    let Primary = new ClipboardPage(primaryPage);
    super.Initialize(primaryPage);
    /* #region 1. Set .pyLabel equal to "Material Situation" */
    OfflineUtil.setPropertyValue(primaryPage, "pyLabel", "Material Situation (" + Primary.Type + ")");
    /* #endregion 1 */

    /* #region 2. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Type",
      PropertyPath: "InventoryType",
      DatabasePath: "MaterialOnHand.InventoryType",
      DataType: "Text",
    });
    /* #endregion 2 */

    /* #region 3. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Material Number",
      PropertyPath: "TypeID",
      DatabasePath: "MaterialOnHand.TypeID",
      DataType: "Text",
    });
    /* #endregion 3 */

    /* #region 4. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "DESC",
      PropertyPath: "pxPages.MaterialType.Description",
      DatabasePath: "MaterialType.Description",
      DataType: "Text",
    });
    /* #endregion 4 */

    /* #region 5. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Batch",
      PropertyPath: "Batch",
      DatabasePath: "MaterialOnHand.Batch",
      DataType: "Text",
    });
    /* #endregion 5 */

    /* #region 6. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Plant",
      PropertyPath: "Plant",
      DatabasePath: "MaterialOnHand.Plant",
      DataType: "Text",
    });
    /* #endregion 6 */

    /* #region 7. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "SLOC",
      PropertyPath: "StorageLocation",
      DatabasePath: "MaterialOnHand.StorageLocation",
      DataType: "Text",
    });
    /* #endregion 7 */

    /* #region 8. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Stock",
      PropertyPath: "Stock",
      DatabasePath: "MaterialOnHand.Stock",
      DataType: "Number",
    });
    /* #endregion 8 */

    /* #region 9. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "BIN",
      PropertyPath: "BIN",
      DatabasePath: "MaterialOnHand.BIN",
      DataType: "Text",
    });
    /* #endregion 9 */

    /* #region 10. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "UOM",
      PropertyPath: "pxPages.MaterialType.UnitOfMeasure",
      DatabasePath: "MaterialType.UnitOfMeasure",
      DataType: "Text",
    });
    /* #endregion 10 */

    /* #region 11. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "SN Profile",
      PropertyPath: "pxPages.MaterialType.SerialNumberProfile",
      DatabasePath: "MaterialType.SerialNumberProfile",
      DataType: "Text",
    });
    /* #endregion 11 */

    /* #region 12. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Bench Stock",
      PropertyPath: "BenchStock",
      DatabasePath: "CASE WHEN MaterialOnHand.BenchStock = 1 THEN 'TRUE' ELSE 'FALSE' END",
      DataType: "Boolean",
    });
    /* #endregion 12 */

    /* #region 13. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "FSC",
      PropertyPath: "pxPages.MaterialType.FSC",
      DatabasePath: "MaterialType.FSC",
      DataType: "Text",
    });
    /* #endregion 13 */

    /* #region 14. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Recovery Code",
      PropertyPath: "pxPages.MaterialType.RecoveryCode",
      DatabasePath: "MaterialType.RecoveryCode",
      DataType: "Text",
    });
    /* #endregion 14 */

    /* #region 15. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "UIC",
      PropertyPath: "UIC",
      DatabasePath: "MaterialOnHand.UIC",
      DataType: "Text",
    });
    /* #endregion 15 */

    /* #region 16. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "CIIC",
      PropertyPath: "pxPages.MaterialType.CIIC",
      DatabasePath: "MaterialType.CIIC",
      DataType: "Text",
    });
    /* #endregion 16 */

    /* #region 17. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "LAST MOV",
      PropertyPath: "LastMovementDate",
      DatabasePath: this.formatPropertyPathDate("MaterialOnHand.LastMovementDate"),
      DataType: "Date",
    });
    /* #endregion 17 */

    /* #region 18. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Last Receipt",
      PropertyPath: "LastReceiptDate",
      DatabasePath: this.formatPropertyPathDate("MaterialOnHand.LastReceiptDate"),
      DataType: "Date",
    });
    /* #endregion 18 */

    /* #region 19. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Last Issue",
      PropertyPath: "LastIssueDate",
      DatabasePath: this.formatPropertyPathDate("MaterialOnHand.LastIssueDate"),
      DataType: "Date",
    });
    /* #endregion 19 */

    /* #region 20. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Is serialized",
      PropertyPath: "IsSerialized",
      DatabasePath: "CASE WHEN MaterialType.SerialNumberProfile >= 'GA01' AND MaterialType.SerialNumberProfile <= 'GA10' THEN 'TRUE' ELSE 'FALSE' END",
      DataType: "Boolean",
    });
    /* #endregion 20 */

    /* #region 21. Append and Map to .ImplicitFilters */
    OfflineUtil.appendToPageList(primaryPage, "ImplicitFilters", {
      Field: {
        DatabasePath: "MaterialOnHand.InventoryType",
        DataType: "Text",
      },
      CompareOperator: " = '{1}'",
      Value: OfflineUtil.getPropertyValue(primaryPage, "Type"),
    });
    /* #endregion 21 */

    /* #region 22. Append and Map to .AvailableFields */
    OfflineUtil.appendToPageList(primaryPage, "AvailableFields", {
      Label: "LIN",
      PropertyPath: "pxPages.MaterialType.LIN",
      DatabasePath: "MaterialType.LIN",
      DataType: "Text",
    });
    /* #endregion 22 */

    /* #region 23. Append and Map to .AvailableFields */
    OfflineUtil.appendToPageList(primaryPage, "AvailableFields", {
      Label: "SCMC",
      PropertyPath: "pxPages.MaterialType.SCMC",
      DatabasePath: "MaterialType.SCMC",
      DataType: "Text",
    });
    /* #endregion 23 */

    /* #region 24. Set .QuerySource equal to "pegadata." + @pyGetTableFromClass("GCSS-DiscOps-Data-MaterialOnHand") +  " MaterialOnHand " */
    //configured in next step
    /* #endregion 24 */

    /* #region 25. Set .QuerySource equal to .QuerySource + " LEFT JOIN pegadata." +  @pyGetTableFromClass("GCSS-DiscOps-Data-MaterialType") + " MaterialType ON MaterialOnHand.TypeID=MaterialType.ID" */
    let querySource = "MaterialOnHand_ForUser MaterialOnHand " + "LEFT JOIN D_MaterialTypeList MaterialType ON MaterialOnHand.TypeID=MaterialType.ID ";
    OfflineUtil.setPropertyValue(primaryPage, "QuerySource", querySource);
    /* #endregion 25 */

    /* #region 26. Set .ClassOfResults equal to GCSS-DiscOps-Data-MaterialOnHand */
    OfflineUtil.setPropertyValue(primaryPage, "ClassOfResults", "GCSS-DiscOps-Data-MaterialOnHand");
    /* #endregion 26 */
  }

  static showRowMenu(eventObj) {
    const contextPage = HarnessUtil.locateBaseRef(eventObj.target);
    eventObj.target.removeAttribute("data-menuid");
    var menuid = Date.now();
    var actionMenu = new OfflineUtil.navigation(menuid);
    let SerialNumberProfile = OfflineUtil.getPropertyValue(contextPage, "pxPages.MaterialType.SerialNumberProfile");
    if (SerialNumberProfile >= "GA01" && SerialNumberProfile <= "GA10") {
      let TypeID = OfflineUtil.getPropertyValue(contextPage, "TypeID");
      let Batch = OfflineUtil.getPropertyValue(contextPage, "Batch");
      let StorageLocation = OfflineUtil.getPropertyValue(contextPage, "StorageLocation");
      actionMenu.addMenuItem("View equipment", [`HarnessUtil.createWork("GCSS-DiscOps-Work-Report-Equipment","pyStartCase","MaterialType=${TypeID}&Batch=${Batch}&StorageLocation=${StorageLocation}","MaterialType=${TypeID}&Batch=${Batch}&StorageLocation=${StorageLocation}")`]);
    } else {
      actionMenu.addMenuItemDisabled("View equipment");
    }
    var config = actionMenu.getBuildAndConfig({});
    pega.control.menu.showContextMenu(config, eventObj.target, eventObj);
  }
};

OfflineCase_Report_EquipmentStatus = class extends OfflineCase_Report {
  static Initialize(primaryPage) {
    /* #region Call superclass data transform */
    super.Initialize(primaryPage);
    /* #endregion */

    OfflineUtil.setPropertyValue(primaryPage, "SelectDistinctRows", "true");

    /* #region 2. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "UIC",
      PropertyPath: "UIC",
      DatabasePath: "Equipment.UIC",
      DataType: "Text",
    });
    /* #endregion 2 */

    /* #region 3. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "WO Create Date",
      PropertyPath: "pxPages.WorkOrder.CreateDate",
      DatabasePath: this.formatPropertyPathDate("WorkOrder.CreateDate"),
      DataType: "Date",
    });
    /* #endregion 3 */

    /* #region 5. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Equipment Remark",
      PropertyPath: "Remark",
      DatabasePath: "Equipment.Remark",
      DataType: "Text",
    });
    /* #endregion 5 */

    /* #region 10. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "ERC",
      PropertyPath: "ERC",
      DatabasePath: "Equipment.ERC",
      DataType: "Text",
    });
    /* #endregion 10 */

    /* #region 11. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Admin No",
      PropertyPath: "AdminNumber",
      DatabasePath: "Equipment.AdminNumber",
      DataType: "Text",
    });
    /* #endregion 11 */

    /* #region 12. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Serial No",
      PropertyPath: "SerialNumber",
      DatabasePath: "Equipment.SerialNumber",
      DataType: "Text",
    });
    /* #endregion 12 */

    /* #region 17. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Equipment ID",
      PropertyPath: "ID",
      DatabasePath: "Equipment.ID",
      DataType: "Text",
    });
    /* #endregion 17 */

    /* #region 13. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Description",
      PropertyPath: "Description",
      DatabasePath: "Equipment.Description",
      DataType: "Text",
    });
    /* #endregion 13 */

    /* #region 14 Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Model No",
      PropertyPath: "ModelNumber",
      DatabasePath: "Equipment.ModelNumber",
      DataType: "Text",
    });
    /* #endregion 14 */

    /* #region 15. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "LIN",
      PropertyPath: "LIN",
      DatabasePath: "Equipment.LIN",
      DataType: "Text",
    });
    /* #endregion 15 */

    /* #region 16. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "NIIN",
      PropertyPath: "TypeID",
      DatabasePath: "Equipment.TypeID",
      DataType: "Text",
    });
    /* #endregion 16 */

    /* #region 18. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Op Stat",
      PropertyPath: "OperationalStatus",
      DatabasePath: "Equipment.OperationalStatus",
      DataType: "Text",
    });
    /* #endregion 18 */

    /* #region 19. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Tech Status",
      PropertyPath: "TechnicalStatus",
      DatabasePath: "Maintenance.TechStatus",
      DataType: "Text",
    });
    /* #endregion 19 */

    /* #region 20. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Notification ID",
      PropertyPath: "pxPages.WorkOrder.EquipmentID",
      DatabasePath: "Maintenance.SAPDocID",
      DataType: "Text",
    });
    /* #endregion 20 */

    /* #region 21. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Notification Text",
      PropertyPath: "pxPages.WorkOrder.Description",
      DatabasePath: "WorkOrder.Description",
      DataType: "Text",
    });
    /* #endregion 21 */

    /* #region 7. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Days DL",
      PropertyPath: "DaysDL",
      DatabasePath: "ROUND(julianday('now','localtime')-julianday(Equipment.DeadlineStart),2)",
      DataType: "Number",
    });
    /* #endregion 7 */

    /* #region 22. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Deadline Start",
      PropertyPath: "DeadlineStart",
      DatabasePath: this.formatPropertyPathDate("Equipment.DeadlineStart"),
      DataType: "Date",
    });
    /* #endregion 22 */

    /* #region 23. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Order Type",
      PropertyPath: "pxPages.WorkOrder.OrderType",
      DatabasePath: "WorkOrder.OrderType",
      DataType: "Text",
    });
    /* #endregion 23 */

    /* #region 24. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Order ID",
      PropertyPath: "pxPages.WorkOrder.PegaID",
      DatabasePath: "WorkOrder.PegaID",
      DataType: "Text",
    });
    /* #endregion 24 */

    /* #region 27. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Op WorkCenter",
      PropertyPath: "pxPages.Operation.WorkCenter",
      DatabasePath: "Operation.WorkCenter",
      DataType: "Text",
    });
    /* #endregion 27 */

    /* #region 25. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "System Condition",
      PropertyPath: "pxPages.WorkOrder.SystemCondition",
      DatabasePath: "WorkOrder.SystemCondition",
      DataType: "Text",
    });
    /* #endregion 25 */

    /* #region 26. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "WO Work Center",
      PropertyPath: "pxPages.WorkOrder.WorkCenter",
      DatabasePath: "WorkOrder.WorkCenter",
      DataType: "Text",
    });
    /* #endregion 26 */

    /* #region 9. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Days in WC",
      PropertyPath: "pxPages.WorkOrder.DaysInWC",
      DatabasePath: "ROUND(julianday('now','localtime')-julianday(WorkOrder.StartTime),2)",
      DataType: "Number",
    });
    /* #endregion 9 */

    /* #region 28. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Material ID",
      PropertyPath: "pxPages.Material.ID",
      DatabasePath: "Material.ID",
      DataType: "Text",
    });
    /* #endregion 28 */

    /* #region 29. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Material Desc",
      PropertyPath: "pxPages.Material.Description",
      DatabasePath: "Material.Description",
      DataType: "Text",
    });
    /* #endregion 29 */

    /* #region 30. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "ReqmtPrio",
      PropertyPath: "pxPages.Requirement.ReqmtPrio",
      DatabasePath: "Requirement.ReqmtPrio",
      DataType: "Text",
    });
    /* #endregion 30 */

    /* #region 4. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Days Waiting",
      PropertyPath: "pxPages.Requirement.ReservationCreateDate",
      DatabasePath: this.formatPropertyPathDate("Requirement.ReservationCreateDate"),
      DataType: "Date",
    });
    /* #endregion 4 */

    /* #region 31. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Quantity Needed",
      PropertyPath: "pxPages.Component.QuantityNeeded",
      DatabasePath: "Component.QuantityNeeded",
      DataType: "Number",
    });
    /* #endregion 31 */

    /* #region 32. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Quantity Withdrawn",
      PropertyPath: "pxPages.Component.QuantityWithdrawn",
      DatabasePath: "Component.QuantityWithdrawn",
      DataType: "Number",
    });
    /* #endregion 32 */

    /* #region 33. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Next Level Qty",
      PropertyPath: "pxPages.MaterialOnHand.Stock",
      DatabasePath: "MaterialOnHand.Stock",
      DataType: "Number",
    });
    /* #endregion 33 */

    /* #region 34. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Purch Req No",
      PropertyPath: "pxPages.Requirement.PurchaseRequisitionNumber",
      DatabasePath: "Requirement.PurchaseRequisitionNumber",
      DataType: "Text",
    });
    /* #endregion 34 */

    /* #region 35. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Purch Doc",
      PropertyPath: "pxPages.Requirement.PurchDoc",
      DatabasePath: "Requirement.PurchDoc",
      DataType: "Text",
    });
    /* #endregion 35 */

    /* #region 36. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Ex DL Date",
      PropertyPath: "pxPages.Requirement.POExpDeliveryDt",
      DatabasePath: this.formatPropertyPathDate("Requirement.POExpDeliveryDt"),
      DataType: "Date",
    });
    /* #endregion 36 */

    /* #region 37. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Plan Ship Start",
      PropertyPath: "pxPages.Requirement.EstimatedShipmentDate",
      DatabasePath: this.formatPropertyPathDate("Requirement.EstimatedShipmentDate"),
      DataType: "Date",
    });
    /* #endregion 37 */

    /* #region 6. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Next Level PO",
      PropertyPath: "pxPages.Requirement.SSAPONum",
      DatabasePath: "Requirement.SSAPONum",
      DataType: "Text",
    });
    /* #endregion 6 */

    /* #region 38. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Nxt lvl DoD DocNum",
      PropertyPath: "pxPages.Requirement.PODocumentNumber",
      DatabasePath: "Requirement.PODocumentNumber",
      DataType: "Text",
    });
    /* #endregion 38 */

    /* #region 39. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Nxt lvl ExpDt",
      PropertyPath: "pxPages.Requirement.SSALevelExpDeliveryDt",
      DatabasePath: this.formatPropertyPathDate("Requirement.SSALevelExpDeliveryDt"),
      DataType: "Date",
    });
    /* #endregion 39 */

    /* #region 40. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Ship Notification",
      PropertyPath: "pxPages.Requirement.ShipmentNotification",
      DatabasePath: "Requirement.ShipmentNotification",
      DataType: "Text",
    });
    /* #endregion 40 */

    /* #region 41. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Stat Code",
      PropertyPath: "pxPages.Requirement.SSAMilstripStatusCode",
      DatabasePath: "Requirement.SSAMilstripStatusCode",
      DataType: "Text",
    });
    /* #endregion 41 */

    /* #region 5. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Notification Priority",
      PropertyPath: "pxPages.Maintenance.Priority",
      DatabasePath: "Maintenance.Priority",
      DataType: "Text",
    });
    /* #endregion 5 */

    /* #region 5. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Requirement Priority",
      PropertyPath: "pxPages.Requirement.Priority",
      DatabasePath: "Requirement.Priority",
      DataType: "Text",
    });
    /* #endregion 5 */

    /* #region 5. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "SoS",
      PropertyPath: "pxPages.Requirement.SSALevelSupplier",
      DatabasePath: "Requirement.SSALevelSupplier",
      DataType: "Text",
    });
    /* #endregion 5 */

    /* #region 5. Append and Map to .VisibleFields */
    OfflineUtil.appendToPageList(primaryPage, "VisibleFields", {
      Label: "Part Request Date",
      PropertyPath: "pxPages.Requirement.RequestDate",
      DatabasePath: "Requirement.RequestDate",
      DataType: "Text",
    });
    /* #endregion 5 */

    /* #region 8. Append and Map to .AvailableFields */
    OfflineUtil.appendToPageList(primaryPage, "AvailableFields", {
      Label: "RPT",
      PropertyPath: "IsReportable",
      DatabasePath: "CASE WHEN Equipment.IsReportable = 1 THEN 'TRUE' ELSE 'FALSE' END",
      DataType: "Boolean",
    });
    /* #endregion 8 */

    if (!OfflineUtil.getPropertyValue(primaryPage, "SelectedVariantName")) {
      OfflineUtil.setPropertyValue(primaryPage, "SelectedVariantName", "Reportable!ALL");
    }

    /* #region 42-48 Set .QuerySource equal to "pegadata." + @pyGetTableFromClass("GCSS-DiscOps-Data-Equipment") +  " Equipment " */
    //Offline configuration is deliberately different from online due to different table structure in client store
    let querySource = "KeyedEquipment_ForUser Equipment " + "LEFT JOIN D_MaintenanceList Maintenance ON Equipment.PegaID=Maintenance.EquipmentID OR Equipment.OldPegaID=Maintenance.EquipmentID " + "LEFT JOIN D_WorkOrderList WorkOrder ON Maintenance.WorkOrderID = WorkOrder.PegaID " + "LEFT JOIN D_MaterialTypeList Material ON Equipment.TypeID=Material.PegaID " + "LEFT JOIN D_RequirementList Requirement ON Equipment.TypeID=Requirement.MaterialTypeID " + "LEFT JOIN D_MaterialOnHandList MaterialOnHand ON Equipment.TypeID=MaterialOnHand.TypeID " + "LEFT JOIN D_SubOperationList Operation ON WorkOrder.PegaID=Operation.WorkOrderID " + "LEFT JOIN D_WorkOrderComponentList Component ON WorkOrder.PegaID=Component.WorkOrderID ";
    OfflineUtil.setPropertyValue(primaryPage, "QuerySource", querySource);
    /* #endregion 41-47 */

    /* #region 49. Set .ClassOfResults equal to "GCSS-DiscOps-Data-Equipment" */
    OfflineUtil.setPropertyValue(primaryPage, "ClassOfResults", "GCSS-DiscOps-Data-Equipment");
    /* #endregion 49S */
  }
};
//static-content-hash-trigger-GCC

ClassLookups["GCSS-DiscOps-Work-Report-Inventory"] = OfflineCase_Report_Inventory;
ClassLookups["GCSS-DiscOps-Work-Report-EquipmentStatus"] = OfflineCase_Report_EquipmentStatus;
