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
      CustomizeColumns: {
        transform: this.PostCustomizeColumns,
      },
    };
  }
  static get preProcessing() {
    return {
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

    if (Primary.SaveAs == "" && Primary.SaveAsName == "") {
      messages.push({
        page: primaryPage,
        property: "SaveAsName",
        message: OfflineUtil.message.ValueRequired(),
      });
    }
    let regex = /[^a-zA-Z0-9 ]/;
    if (Primary.SaveAs == "" && regex.test(OfflineUtil.getPropertyValue(primaryPage, "SaveAsName"))) {
      messages.push({
        page: primaryPage,
        property: "SaveAsName",
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
    console.log("in postcustomize-----------------");
    console.log(OfflineUtil.getPropertyValue("ModalPrimary", "AvailableFields"));
    console.log(OfflineUtil.getPropertyValue("ModalPrimary", "VisibleFields"));
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
    OfflineUtil.setPropertyValue(primaryPage, "AppliedFilter", "");
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
        OfflineUtil.setPropertyValue(primaryPage, "UserFilters", userFilters);
      }

      /* #region 2.8. Page-Remove (cleanup) */
      OfflineUtil.removePage("CurrentColumns");
      /* #endregion 2.8 */
    }
    /* #endregion 2 */

    /* #region 3. Call GenerateAndRunQuery (re-run query) */
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
    let Primary = new ClipboardPage(primaryPage);

    /* #region Initialize variables */
    let userFilters = OfflineUtil.getPropertyValue(primaryPage, "UserFilters") || [];
    let visibleFields = OfflineUtil.getPropertyValue(primaryPage, "VisibleFields") || [];
    let availableFields = OfflineUtil.getPropertyValue(primaryPage, "AvailableFields") || [];
    let implicitFields = OfflineUtil.getPropertyValue(primaryPage, "ImplicitFields") || [];
    let implicitFilters = OfflineUtil.getPropertyValue(primaryPage, "ImplicitFilters") || [];
    let quickSearchCriteria = OfflineUtil.getPropertyValue(primaryPage, "QuickSearchCriteria") || [];
    /* #endregion Initialize */

    OfflineUtil.setPropertyValue(primaryPage, "SelectedVariantName", parameters.VariantName || "");
    Primary.AppliedFilter = OfflineUtil.whatComesBeforeFirst(parameters.VariantName || "", "!");

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

    console.log(query);

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
      Primary.SaveAsName = Primary.SaveAs;
    }
    await OfflineUtil.runQuery("insert or replace into D_VariantList (softflag, Owner, Name, ReportClass) VALUES (0, ?,?,?)", [D_AuthProfile.Person.PersonNumber, Primary.SaveAsName, Primary.pxObjClass]);
    //delete filters
    await OfflineUtil.runQuery("delete from D_VariantFilterList where owner = ? and variantname = ? and reportclass = ?", [D_AuthProfile.Person.PersonNumber, Primary.SaveAsName, Primary.pxObjClass]);
    //save new filters
    if (Primary.IncludeInSavedVariant == "both" || Primary.IncludeInSavedVariant == "filters") {
      let UserFilters = OfflineUtil.getPropertyValue(primaryPage, "UserFilters") || [];
      for (let i = 0; i < UserFilters.length; i++) {
        let stepPage = OfflineUtil.getPageJSON(`${primaryPage}.UserFilters(${i + 1})`);
        let filterValue = stepPage.Value;
        if ((stepPage.Field.DataType == "Date" || stepPage.Field.DataType == "DateTime") && (stepPage.Advanced == true || stepPage.Advanced == "true")) {
          filterValue = "{" + stepPage.RelativeDate + "(" + stepPage.DaysOffset + "," + stepPage.RelativeTime + ")}";
        }
        await OfflineUtil.runQuery("insert or replace into D_VariantFilterList (softflag, Sequence, Owner, VariantName, ReportClass, Sort, FilterValue, Comparison, Column) VALUES (0,?,?,?,?,?,?,?,?)", [i + 1, D_AuthProfile.Person.PersonNumber, Primary.SaveAsName, Primary.pxObjClass, stepPage.Order || "", stepPage.Value, stepPage.Comparison, stepPage.Field.Label]);
      }
    }
    //delete columns
    await OfflineUtil.runQuery("delete from D_VariantColumnList where owner = ? and variantname = ? and reportclass = ?", [D_AuthProfile.Person.PersonNumber, Primary.SaveAsName, Primary.pxObjClass]);
    //save new columns
    if (Primary.IncludeInSavedVariant == "both" || Primary.IncludeInSavedVariant == "columns") {
      let VisibleFields = OfflineUtil.getPropertyValue(primaryPage, "VisibleFields") || [];
      for (let i = 0; i < VisibleFields.length; i++) {
        let stepPage = OfflineUtil.getPageJSON(`${primaryPage}.VisibleFields(${i + 1})`);
        await OfflineUtil.runQuery("insert or replace into D_VariantColumnList (softflag, Column, Owner, VariantName, ReportClass, Sequence) VALUES (0,?,?,?,?,?)", [stepPage.Label, D_AuthProfile.Person.PersonNumber, Primary.SaveAsName, Primary.pxObjClass, i + 1]);
      }
    }
    //queue activity
    //let page = OfflineUtil.getPageJSON(primaryPage);
    //page.SetAsDefault = false;
    //page = JSON.stringify(page);
    //launchbox.PRPC.ClientStore.addAction("", "", '{"action":"callActivity","className":"GCSS-DiscOps-Work-Report","activityName":"PostSaveUserVariant"}', page);
    //set selected variant
    Primary.LastAppliedVariant = Primary.SelectedVariantName + "!" + D_AuthProfile.Person.PersonNumber;
    Primary.SelectedVariantName = Primary.LastAppliedVariant;
    //set default if applicable
    if (Primary.SetAsDefault == true || Primary.SetAsDefault == "true") {
      await OfflineCase_Report.PostSetDefaultVariant(primaryPage);
    }
    await OfflineCase_Report.InitializeVariantLists(primaryPage);
  }

  static async PostSetDefaultVariant(primaryPage, Param = {}) {
    let Primary = new ClipboardPage(primaryPage);
    let D_AuthProfile = new ClipboardPage("D_AuthProfile");

    await OfflineUtil.runQuery("insert or replace into D_UserSettingList (softflag, Name, PersonNumber, Value) VALUES (0,?,?,?)", ["DefaultView-" + Primary.pxObjClass, D_AuthProfile.Person.PersonNumber, Primary.SelectedVariantName]);

    launchbox.PRPC.ClientStore.addAction("", "", '{"action":"callActivity","className":"GCSS-DiscOps-Work-Report","activityName":"PostSetDefaultVariant"}', `{"PersonNumber":"${D_AuthProfile.Person.PersonNumber}","pxObjClass":"${Primary.pxObjClass}","SelectedVariantName":"${Primary.SelectedVariantName}"}`);
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
        child.addMenuItemDisabled("&lt;No views defined&gt;");
      }
    });
    actionMenu.addSubMenu("Manage views", (child) => {
      child.addMenuItem("Save as...", [`HarnessUtil.localActionPre("${Primary.pxObjClass}","SaveUserVariant",event)`, `$('.SaveSettingsAction > span > a')[0].click()`]);
      if (Primary.SelectedVariantName != "") {
        child.addMenuItem("Set as default...", [`HarnessUtil.localActionPre("${Primary.pxObjClass}","SetDefaultVariant",event)`, `$('.SetDefaultAction > span > a')[0].click()`]);
      } else {
        child.addMenuItemDisabled("Set as default...");
      }
      if (Primary.SelectedVariantName != "" && OfflineUtil.whatComesAfterLast(Primary.SelectedVariantName, "!") != "ALL") {
        child.addMenuItem("Delete selected...", [`HarnessUtil.localActionPre("${Primary.pxObjClass}","DeleteVariant",event)`, `$('.DeleteAction > span > a')[0].click()`]);
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

OfflineUtilType = class extends HarnessUtilType {
  constructor(reference) {
    super();
    this.reference = reference;
  }
  async performTileAction(Action, ActionClass, ActionKey, paramString, event, ...args) {
    if (this.isRunning("performTileAction")) return;
    this.pushCallStack("performTileAction");
    if (Action != "ShowTileGroupFromMenu" && !(this.getPropertyValue("pyWorkPage", "pxObjClass") || "").includes("-Report")) {
      this.recordPageAsBreadcrumb("pyDisplayHarness", "Dashboard");
    }
    if (Action === "OpenAssignment") {
      this.openAssignment(ActionClass, ActionKey);
    } else if (Action === "ShowHarness") {
      this.showHarness(ActionKey, ActionClass);
    } else if (Action === "CreateWork") {
      await this.createWork(ActionClass, ActionKey, paramString, ...args);
    } else if (Action === "ShowTileGroup") {
      pega.datatransform.gcss_discops_uipages_settilegroup = (primaryPage, params) => {
        this.setPropertyValue("pyDisplayHarness", "TileGroup", params.TileGroup);
        this.setPropertyValue("D_DisplayHarness", "TileGroup", params.TileGroup);
      };
      this.refreshSection("MyDashboardHeader");
      this.refreshSectionWithDataTransform(event, "GCSS-DiscOps-UIPages", "MyDashboardContent", "SetTileGroup", false, "TileGroup=" + ActionKey);
    } else if (Action === "ShowTileGroupFromMenu") {
      this.setPropertyValue("pyDisplayHarness", "TileGroup", ActionKey);
      this.setPropertyValue("D_DisplayHarness", "TileGroup", ActionKey);
    }
    this.popCallStack("performTileAction");
  }

  async openAssignment(className, assignKey, caseJSON, ...args) {
    pega.u.d.areInputsValid = function () {
      return true;
    };
    pega.u.d.isFormDirty = function () {
      return false;
    };
    if ((this.getPropertyValue("pyWorkPage", "pxObjClass") || "").includes("-Report")) {
      this.recordPageAsBreadcrumb("pyWorkPage", "Report");
    }
    this.pageAdoptJSON("PrepopulateCase", caseJSON);
    await this.setupForClass("Open", className, ...args);
    openAssignment(assignKey);
  }

  async createWork(className, flowName = "pyStartCase", ...args) {
    //If there are four or more arguments, we will parse pairs 3-4, 5-6, etc. If there are three or fewer args, the 3rd arg must already be a param string.
    let paramString = args[0] || "";
    if (args[1]) {
      const parameterPairs = [];
      for (let i = 0; i < args.length; i += 2) {
        if (args[i + 1]) {
          parameterPairs.push(`${args[i]}=${args[i + 1]}`);
        }
      }
      paramString = parameterPairs.join("&");
    }
    if (this.isRunning("createWork")) return;
    this.pushCallStack("createWork");
    pega.u.d.areInputsValid = function () {
      return true;
    };
    pega.u.d.isFormDirty = function () {
      return false;
    };
    if ((this.getPropertyValue("pyWorkPage", "pxObjClass") || "").includes("-Report")) this.recordPageAsBreadcrumb("pyWorkPage", "Report");

    this.removePage("PrepopulateCase");
    await this.setupForClass("Create", className, paramString);
    await new Promise((resolve) =>
      setTimeout(() => {
        createNewWork(className, "", flowName, paramString);
        this.popCallStack("createWork");
        resolve();
      }, 100)
    );
  }

  prepopulateCase() {
    let prePopPage = this.getPageJSON("PrepopulateCase");
    if (!prePopPage) return;
    let workPage = this.getPageJSON("pyWorkPage");
    let prePopPageFiltered = {};
    Object.keys(prePopPage).forEach((key) => {
      if (key == "pyLabel" || key == "pyStatusWork" || (!key.startsWith("px") && !key.startsWith("py") && !key.startsWith("pz"))) {
        prePopPageFiltered[key] = prePopPage[key];
      }
    });
    if (prePopPage && workPage) {
      let newPage = Object.assign({}, workPage, prePopPageFiltered);
      this.pageAdoptJSON("pyWorkPage", newPage);
      this.removePage("PrepopulateCase");
    }
  }

  async cancelButtonPost() {
    if (this.actionSubmitted) {
      let Primary = new ClipboardPage("pyWorkPage");
      if (Primary.ActionTaken == "DeleteDraft" && Primary.Data.PersistStatus == "Draft") {
        Primary.Data.PersistStatus = "Persistable";
      } else if (Primary.ActionTaken == "Save" && Primary.Data.PersistStatus == "Persistable") {
        Primary.Data.PersistStatus = "Draft";
      }
      if (Primary.ActionTaken == "DeleteDraft" || Primary.ActionTaken == "Save") {
        let actionAreaElement = $(`[id="FlowActionHTML"]`)[0];
        if (actionAreaElement) this.traverseAndSetProperties(actionAreaElement);
        await this.performOnSaveProcess();
      }
      this.breadcrumbGoBack();
    }
  }

  traverseAndSetProperties(element) {
    function transformDatePickerValue(value) {
      // Split the date string into date and time parts
      const parts = value.split(" ");

      if (parts.length === 1) {
        // Handle date-only format (e.g., "9/13/2023")
        const dateParts = parts[0].split("/");
        if (dateParts.length === 3) {
          const month = dateParts[0].padStart(2, "0");
          const day = dateParts[1].padStart(2, "0");
          const year = dateParts[2];

          return `${year}${month}${day}`;
        }
      } else if (parts.length === 3) {
        const datePart = parts[0]; // e.g., "9/13/2023"
        const timePart = parts[1] + " " + parts[2]; // e.g., "2:05 PM"

        // Split the date part into day, month, and year
        const dateParts = datePart.split("/");
        if (dateParts.length === 3) {
          const month = dateParts[0].padStart(2, "0"); // Ensure two-digit month
          const day = dateParts[1].padStart(2, "0"); // Ensure two-digit day
          const year = dateParts[2];

          // Split the time part into hours and minutes
          const timeParts = timePart.split(":");
          if (timeParts.length === 2) {
            let hours = timeParts[0];
            const minutes = timeParts[1].split(" ")[0]; // Get minutes and remove "AM" or "PM"

            // Convert hours to 24-hour format
            if (timePart.toLowerCase().includes("pm")) {
              hours = (parseInt(hours, 10) + 12).toString().padStart(2, "0");
            } else {
              hours = hours.padStart(2, "0");
            }

            // Create the transformed date-time string
            const transformedValue = `${year}${month}${day}T${hours}${minutes}00.000 GMT`;

            return transformedValue;
          }
        }
      }

      // Return the original value if the transformation fails
      return value;
    }
    function transformTimePickerValue(timeString) {
      const [hour, minute, period] = timeString.split(/:| /);
      let hours = parseInt(hour, 10);
      const minutes = parseInt(minute, 10);
      if (period === "PM" && hours !== 12) {
        hours += 12;
      } else if (period === "AM" && hours === 12) {
        hours = 0;
      }
      return `${hours.toString().padStart(2, "0")}${minute.padStart(2, "0")}00`;
    }
    const validationType = element.getAttribute("validationtype");
    if ((element.tagName === "INPUT" || element.tagName == "SELECT" || element.tagName == "TEXTAREA") && element.name && element.name.startsWith("$P")) {
      if (element.type === "radio" && !element.checked) {
        return; // Skip if it's a radio input and it's not checked
      }
      const matches = element.name.match(/\$P([^$]+)\$p(.+)/);
      if (matches && matches.length === 3) {
        const firstArgument = matches[1];
        let secondArgument = matches[2].replace(/\$p/g, ".");
        secondArgument = secondArgument.replace(/\$l(\d+)/g, "($1)");
        let transformedValue = element.value;
        if (element.type === "checkbox") {
          transformedValue = element.checked;
        } else if (validationType == "integer") {
          transformedValue = transformedValue.replace(/,/g, "");
        }
        const dataCtl = element.getAttribute("data-ctl");
        if (dataCtl && dataCtl.includes("DatePicker")) {
          if (validationType == "timeofday") {
            transformedValue = transformTimePickerValue(element.value);
          } else {
            transformedValue = transformDatePickerValue(element.value);
          }
        }

        this.setPropertyValue(firstArgument, secondArgument, transformedValue);
      }
    }

    for (let i = 0; i < element.children.length; i++) {
      this.traverseAndSetProperties(element.children[i]);
    }
  }

  async performOnSaveProcess(primaryPage, className) {
    if (!primaryPage) {
      primaryPage = "pyWorkPage";
    }
    if (!className) {
      className = this.getPropertyValue(primaryPage, "pxObjClass");
    }
    let classInstance = ClassLookups[className];
    if (typeof classInstance == "function") {
      if (typeof classInstance.performOnSaveProcess == "function") {
        return classInstance.performOnSaveProcess(primaryPage);
      }
    }
  }

  async submitFlowAction(event, element, primaryPage, className, actionName, fromSaveButton) {
    let innerElement = $('[name="$PpyWorkPage$pTransactionStatus$pTimePerformed"]')[0];
    if (innerElement) {
      innerElement.value = this.today(0, true);
    }
    innerElement = $('[name="$PpyWorkPage$pTransactionStatus$pPerformer"]')[0];
    if (innerElement) {
      innerElement.value = this.getPropertyValue("D_AuthProfile", "Person.DoDID");
    }
    let postProcessing = null;
    if (!primaryPage) {
      primaryPage = "pyWorkPage";
    }
    if (!className) {
      className = this.getPropertyValue(primaryPage, "pxObjClass");
    }
    if (!actionName) {
      actionName = this.getPropertyValue("newAssignPage", "pyDefaultTaskStatus");
    }
    let classInstance = ClassLookups[className];

    if (classInstance.postProcessing && classInstance.postProcessing[actionName]) {
      postProcessing = classInstance.postProcessing[actionName];
    }

    if (postProcessing) {
      let validationErrors = [];
      let actionAreaElement = $(`[id="FlowActionHTML"]`)[0];
      if (actionAreaElement) this.traverseAndSetProperties(actionAreaElement);
      this.pageAdoptJSON("PrepopulateCase", this.getPageJSON(primaryPage));
      if (!fromSaveButton && postProcessing.validate) {
        validationErrors = await postProcessing.validate("PrepopulateCase");
      }
      if (validationErrors.length < 1 && fromSaveButton) {
        this.setPropertyValue("PrepopulateCase", "pyStatusWork", "Pending-Processing");
        if (this.getPropertyValue("PrepopulateCase.Data", "PersistStatus") == "Persistable") this.setPropertyValue("PrepopulateCase.Data", "PersistStatus", "Draft");
      }
      if (postProcessing.transform && validationErrors.length < 1) {
        await postProcessing.transform("PrepopulateCase");
        //TODO - Add error handling here.
      }
      if (validationErrors.length < 1) {
        await this.performOnSaveProcess("PrepopulateCase", className);
        //TODO - Add error handling here.
      }
      this.setPropertyValue("ValidationErrors", "pxResults", validationErrors);
      this.prepopulateCase();
      let modifiedClassName = className.toLowerCase();
      modifiedClassName = modifiedClassName.replace(/-/g, "_");
      let modifiedFlowActionName = actionName.toLowerCase();
      pega.datatransform[modifiedClassName + "_post" + modifiedFlowActionName] = (primaryPage) => {
        let errors = this.getPropertyValue("ValidationErrors", "pxResults") || [];
        if (errors[0]) {
          errors.forEach((item) => {
            this.addPropertyMessage(primaryPage, item.property, item.message);
          });
        }
      };
      doFormSubmit("pyActivity=FinishAssignment", element, "", event);
    } else {
      doFormSubmit("pyActivity=FinishAssignment", element, "", event);
      await this.performOnSaveProcess();
    }
  }

  async refreshSectionWithDataTransform(event, className, sectionName, dataTransform, submitOnRefresh = true, ...args) {
    function queryStringToObject(queryString) {
      const obj = {};
      const pairs = queryString.split("&");

      pairs.forEach((pair) => {
        const [key, value] = pair.split("=");
        obj[key] = decodeURIComponent(value);
      });

      return obj;
    }
    function findClosestParentWithAttribute(element, attributeName) {
      let currentElement = element;

      while (currentElement && !currentElement.hasAttribute(attributeName)) {
        currentElement = currentElement.parentElement;
      }

      return currentElement;
    }
    let parameters = args[0] || "";
    if (args[1]) {
      const parameterPairs = [];
      for (let i = 0; i < args.length; i += 2) {
        if (args[i + 1]) {
          parameterPairs.push(`${args[i]}=${args[i + 1]}`);
        }
      }
      parameters = parameterPairs.join("&");
    }
    let modifiedClassName = className.toLowerCase();
    modifiedClassName = modifiedClassName.replace(/-/g, "_");
    let modifiedDataTransformName = dataTransform.toLowerCase();
    let targetPage;
    if (dataTransform && !sectionName) {
      let eventTarget = event.target;
      targetPage = this.locateBaseRef(eventTarget);
    } else if (dataTransform) {
      let sectionElement = $(`[node_name="${sectionName}"]`)[0];
      if (sectionElement) {
        targetPage = this.locateBaseRef(sectionElement);
      }
    }
    let dtFunc = pega.datatransform[modifiedClassName + "_" + modifiedDataTransformName];
    if (dtFunc) {
      let sectionElement;
      if (sectionName) {
        sectionElement = $(`[node_name="${sectionName}"]`)[0];
      } else {
        sectionElement = findClosestParentWithAttribute(event.target, "node_name");
      }
      if (submitOnRefresh && submitOnRefresh != "false" && sectionElement) {
        this.traverseAndSetProperties(sectionElement);
      }
      await dtFunc(targetPage, queryStringToObject(parameters));
      let options = {
        event: event,
        section: sectionName,
        submitOnRefresh: false,
      };
      pega.api.ui.actions.refreshSection(options);
    } else {
      let options = {
        event: event,
        section: sectionName,
        submitOnRefresh: submitOnRefresh,
      };
      if (dataTransform)
        options.dataTransform = {
          name: dataTransform,
          parameters: parameters,
          submitOnRefresh: submitOnRefresh,
        };
      pega.api.ui.actions.refreshSection(options);
    }
    this.actionSubmitted = false;
  }

  async openOrCreateCaseFromData(pegaID, className, assignKey, caseStatus) {
    function determineSubClassFromStatus(className, caseStatus) {
      if (className == "GCSS-DiscOps-Work-Equipment-Notification-Dispatch") {
        if (caseStatus == "Open") return className + "-Close";
        if (caseStatus == "Draft") return className + "-Open";
        return null;
      }
      if (className == "GCSS-DiscOps-Work-Equipment-Notification-Maintenance") {
        if (caseStatus == "Open") return className + "-Cls";
        if (caseStatus == "Draft") return className + "-Opn";
        return null;
      }
      if (className == "GCSS-DiscOps-Work-Equipment-WorkOrder") {
        if (caseStatus == "Open") return className + "-Edit";
        return className;
      } else {
        return className;
      }
    }
    className = determineSubClassFromStatus(className, caseStatus);
    if (!className) return;
    let cases = await launchbox.PRPC.ClientStore.getItems("WORKITEM", "GCSS-DISCOPS-WORK-%");
    let assignments = this.getPageJSON("D_pyUserWorkList").pxResults;
    let found = cases.some((obj) => {
      let objJSON = JSON.parse(obj.content);
      if (objJSON.DataCaseID == pegaID) {
        let assign = assignments.find((assignment) => assignment.pxRefObjectKey == objJSON.pzInsKey && (!assignment.pyCompletedOffline || assignment.pyCompletedOffline == "false"));
        if (assign) {
          this.openAssignment(objJSON.pxObjClass, assign.pzInsKey, objJSON);
          return true;
        }
      }
    });
    if (found) return;
    this.createWork(className, "pyStartCase", "&DataID=" + pegaID, "&DataID=" + pegaID);
  }

  setSaveVisibility(primaryPage, classInstance, action) {
    let saveAction = false;
    if (classInstance.saveButtonAction) saveAction = classInstance.saveButtonAction(action);
    this.setPropertyValue(primaryPage, "ShowSave", saveAction);
  }

  async setupForClass(action, className, paramString) {
    if (ScannerUtil) ScannerUtil.initialize();
    let classInstance = ClassLookups[className];
    this.setPropertyValue("PrepopulateCase", "pxObjClass", className);
    if (typeof classInstance.generateTransforms == "function") classInstance.generateTransforms(className);
    if (typeof classInstance.onOpenCase == "function" && action != "Create") await classInstance.onOpenCase("PrepopulateCase", paramString);
    //possible to do flow action pre processing?
    if (typeof classInstance.onCreateCase == "function" && action == "Create") await classInstance.onCreateCase("PrepopulateCase", paramString);
    /* #region this is legacy code. The "reloadEmbeddedPages" call should be in the onOpen and/or onCreate scripts. This code adds reverse compatibility to classes which don't have them */
    if (!classInstance.onOpenCase && typeof classInstance.reloadEmbeddedPages == "function") await classInstance.reloadEmbeddedPages("PrepopulateCase");
    /* #endregion */
    // for each flow action defined, create a pre processing
    if (typeof classInstance.flowActions == "object") {
      for (let action of classInstance.flowActions) {
        if (classInstance.preProcessing && classInstance.preProcessing[action] && classInstance.preProcessing[action].transform) {
          let modifiedClassName = className.toLowerCase();
          modifiedClassName = modifiedClassName.replace(/-/g, "_");
          let modifiedFlowActionName = action.toLowerCase();
          pega.datatransform[modifiedClassName + "_pre" + modifiedFlowActionName] = (primaryPage) => {
            this.prepopulateCase();
            //set stage and step if approps
            this.setPropertyValue(primaryPage, "ShowContinue", "false");
            this.setSaveVisibility(primaryPage, classInstance, action);
            if (classInstance.screenFlows) {
              let screenFlow = classInstance.screenFlows.find((flow) => flow.some((step) => step.pyFlowAction == action));
              if (screenFlow) {
                let status = "Past";
                screenFlow.forEach((step) => {
                  if (step.pyFlowAction == action) {
                    step.pyStatus = "Present";
                    status = "Future";
                  } else {
                    step.pyStatus = status;
                  }
                });
                if (screenFlow && screenFlow.find((step) => step.pyStatus == "Future")) this.setPropertyValue(primaryPage, "ShowContinue", "true");
              }
              this.setPropertyValue(primaryPage, "FlowSteps", screenFlow);
            }
            //end
            classInstance.preProcessing[action].transform(primaryPage);
          };
        } else {
          window["preFlowAction$" + action] = () => {
            this.prepopulateCase();
            //set stage and step if approps
            this.setPropertyValue("pyWorkPage", "ShowContinue", "false");
            this.setSaveVisibility("pyWorkPage", classInstance, action);
            if (classInstance.screenFlows) {
              let screenFlow = classInstance.screenFlows.find((flow) => flow.some((step) => step.pyFlowAction == action));
              if (screenFlow) {
                let status = "Past";
                screenFlow.forEach((step) => {
                  if (step.pyFlowAction == action) {
                    step.pyStatus = "Present";
                    status = "Future";
                  } else {
                    step.pyStatus = status;
                  }
                });
              }
              this.setPropertyValue("pyWorkPage", "FlowSteps", screenFlow);
              if (screenFlow && screenFlow.find((step) => step.pyStatus == "Future")) this.setPropertyValue("pyWorkPage", "ShowContinue", "true");
            }
            //end
          };
        }
      }
    }
  }

  localActionPre(className, flowAction, evt) {
    function setModalErrorMessages(errors) {
      function setModalErrorInline(elementName, messages) {
        var targetElement = $('[name="' + elementName + '"]');

        if (targetElement.length > 0) {
          var errorElementId = elementName + "Error";
          var errorElement = $("#" + $.escapeSelector(errorElementId));

          if (errorElement.length > 0) {
            errorElement.remove();
          }

          messages.forEach(function (message) {
            var newErrorElement = $('<div class="iconErrorDiv dynamic-icon-error-div" id="' + errorElementId + '" style=""><span class="iconError dynamic-icon-error" title="" errid="" aria-live="assertive" aria-relevant="text" aria-atomic="true" role="alert">' + message + "</span></div>");
            targetElement.parent().append(newErrorElement);
          });

          return true;
        }

        return false;
      }
      function setModalErrorHeader(messages) {
        var modalDialogHd = $("#modaldialog_hd");

        if (modalDialogHd.length > 0) {
          var errorTable = $("#ERRORTABLEMODAL");

          if (errorTable.length > 0) {
            errorTable.remove();
          }

          if (messages.length > 0) {
            var newErrorTable = $('<div class="error-table offlineerror" id="ERRORTABLEMODAL" role="alert">' + '<div id="EXPAND" style="display: block;"> <b>Errors:</b><br>' + '<span class="errorText" id="ERRORMESSAGES_ALL">' + '<ul class="pageErrorList"></ul>' + "</span>" + "</div>" + "</div>");

            var errorList = newErrorTable.find(".pageErrorList");
            messages.forEach(function (message) {
              errorList.append("<li>" + message + "</li>");
            });

            modalDialogHd.after(newErrorTable);
          }
        }
      }
      var failedInlineErrors = [];
      var combinedErrors = {};

      errors.forEach(function (error) {
        var page = error.page || "";
        var property = error.property || "";
        var field = page + (property.startsWith(".") ? "" : ".") + property;

        if (!combinedErrors[field]) {
          combinedErrors[field] = [];
        }

        if (!setModalErrorInline("$P" + field.replace(/\./g, "$p").replace(/\((\d+)\)/g, "$l$1"), [error.message])) {
          failedInlineErrors.push(error.message);
        }

        combinedErrors[field].push(error.message);
      });

      setModalErrorHeader(failedInlineErrors);

      Object.keys(combinedErrors).forEach(function (field) {
        var messages = combinedErrors[field];
        setModalErrorInline("$P" + field.replace(/\./g, "$p").replace(/\((\d+)\)/g, "$l$1"), messages);
      });
    }
    function extractNameFromAnchor(element) {
      if (element.tagName === "A") {
        const name = element.name;
        if (name) {
          const startIndex = name.indexOf("_") + 1;
          const lastIndex = name.lastIndexOf("_");
          if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
            return name.substring(startIndex, lastIndex);
          }
        }
      } else if (element.tagName === "BUTTON") {
        let inputString = element.name;
        const firstUnderscoreIndex = inputString.indexOf("_");
        const lastUnderscoreIndex = inputString.lastIndexOf("_");
        if (firstUnderscoreIndex === -1) {
          return inputString;
        } else if (firstUnderscoreIndex === lastUnderscoreIndex) {
          return inputString.substring(firstUnderscoreIndex + 1);
        } else {
          return inputString.substring(firstUnderscoreIndex + 1, lastUnderscoreIndex);
        }
      }
      const childElements = element.children;
      for (let i = 0; i < childElements.length; i++) {
        const result = extractNameFromAnchor(childElements[i]);
        if (result) {
          return result;
        }
      }
      return null;
    }
    let modifiedClassName = className.toLowerCase();
    modifiedClassName = modifiedClassName.replace(/-/g, "_");
    let modifiedFlowActionName = flowAction.toLowerCase();
    let targetPage = extractNameFromAnchor(evt.target);
    if (!targetPage || targetPage == "") {
      targetPage = this.locateBaseRef();
    }
    let classInstance = ClassLookups[className];
    if (classInstance) {
      if (classInstance.preProcessing && classInstance.preProcessing[flowAction] && classInstance.preProcessing[flowAction].transform) {
        //pega.datatransform[modifiedClassName + "_pre" + modifiedFlowActionName] = classInstance.preProcessing[flowAction].transform;
      }
      if (classInstance.postProcessing && classInstance.postProcessing[flowAction] && classInstance.postProcessing[flowAction].transform) {
        //pega.datatransform[modifiedClassName + "_post" + modifiedFlowActionName] = classInstance.postProcessing[flowAction].transform;
      }
    }
    if (pega.datatransform[modifiedClassName + "_pre" + modifiedFlowActionName]) {
      pega.datatransform[modifiedClassName + "_pre" + modifiedFlowActionName](targetPage);
    }
    console.log(classInstance);
    console.log(flowAction);
    this.actionSubmitted = false;
    doModalAction = async (a, b) => {
      if (a && a.taskStatus && a.taskStatus != "") {
        let messages = [];
        let actionAreaElement = $("[id^='FlowActionHTML_LA_']")[0];
        if (actionAreaElement) this.traverseAndSetProperties(actionAreaElement);
        if (classInstance && classInstance.postProcessing && classInstance.postProcessing[flowAction] && classInstance.postProcessing[flowAction].validate) {
          messages = await classInstance.postProcessing[flowAction].validate(targetPage);
        }
        setModalErrorMessages(messages);
        if (!messages || messages.length == 0) {
          if (classInstance && classInstance.postProcessing && classInstance.postProcessing[flowAction] && classInstance.postProcessing[flowAction].transform) {
            await classInstance.postProcessing[flowAction].transform(targetPage);
          } else if (pega.datatransform[modifiedClassName + "_post" + modifiedFlowActionName]) {
            await pega.datatransform[modifiedClassName + "_post" + modifiedFlowActionName](targetPage);
          }
          this.actionSubmitted = true;
          pega.u.d.doModalAction(a, b);
        }
      } else {
        pega.u.d.doModalAction(a, b);
      }
    };
  }

  formatDateFromEpoch(epochTime) {
    const date = new Date(epochTime * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }
  get message() {
    return {
      CannotBePast: function () {
        return "Cannot be in the past";
      },
      CannotBeFuture: function () {
        return "Cannot be in the future";
      },
      ValueMustBeLessOrEqual: function (p1) {
        return `Cannot exceed ${p1}`;
      },
      ValueMustEqual: function (p1) {
        return `Must equal ${p1}`;
      },
      NotAuthorized: function (p1) {
        return `Not authorized${p1}`;
      },
      ValueMustBeGreater: function (p1) {
        return `Must be greater than ${p1}`;
      },
      MustEnterNewValue: function (p1) {
        return `Must enter new value for ${p1}`;
      },
      DuplicateValue: function (p1) {
        return `Can not have a duplicate ${p1}`;
      },
      ValueMustBeGreaterOrEqual: function (p1) {
        return `Must be ${p1} or greater`;
      },
      ValueMustBeInteger: function (p1) {
        return `Must be an integer ${p1}`;
      },
      ValueRequired: function () {
        return `Value cannot be blank`;
      },
      AlreadyExists: function (p1) {
        return `${p1} already exists`;
      },
      MustBeLaterThan: function (p1) {
        return `Must be later than ${p1}`;
      },
      ValueCannotEqual: function (p1) {
        return `Cannot equal ${p1}`;
      },
      MustBeApproved: function () {
        return `Must be approved`;
      },
      MustHaveOnePrimaryOperator: function () {
        return `Exactly one operator must be identified as primary.`;
      },
      MustHaveOneSelectedEquipment: function () {
        return `Exactly one piece of equipment must be selected.`;
      },
      PrimaryOperatorOnOpenDispatch: function () {
        return `The primary operator selected is already a primary operator on another open dispatch. They can be changed to an alternate operator and a new primary operator needs to be selected.`;
      },
      AlreadyDispatched: function () {
        return `The Equipment chosen is already dispatched. The Dispatch cannot be created.`;
      },
      NotDispatchable: function () {
        return `The Equipment chosen is not dispatchable. The Dispatch cannot be created.`;
      },
      MustSelectInstallEquipmentOrDismantleOnly: function () {
        return `Must select equipment to install or indicate dismantle only`;
      },
      MustSelectInstallEquipment: function () {
        return `Must select equipment to install`;
      },
      AllComponentsMustBeIssued: function () {
        return `All components must have goods issued against them. Please verify that they have been issued or remove the components from the Work Order if they were no longer needed.`;
      },
      MustSelectDelivery: function () {
        return `No delivery selected. Please select a delivery to continue.`;
      },
    };
  }
  get navigation() {
    return class NavigationBuilder {
      constructor(handle = "pyNavigationCustom") {
        this.navigation = {
          $pxPageSize$pyElements: 0,
        };
        this.handle = "pyNavigationCustom" + handle;
        this.entryHanlde = "$" + handle;
      }
      addMenuItem(caption, actionFunction, ...args) {
        var itemConfig = {
          pyBadgeFormat: "standard (label)",
          pyDeferLoad: "false",
          pyHidden: "false",
        };
        itemConfig["pyCaption"] = caption;
        if (actionFunction) {
          itemConfig["pyBehaviors"] = this.__generateBehaviour(actionFunction, ...args);
        }
        this.navigation["pyElements"] = this.navigation["pyElements"] || [];
        this.navigation["pyElements"].push(itemConfig);
        this.navigation["$pxPageSize$pyElements"] = this.navigation["$pxPageSize$pyElements"] + 1;
        return this;
      }
      addMenuItemDisabled(caption) {
        var itemConfig = {
          pyBadgeFormat: "standard (label)",
          pyDeferLoad: "false",
          pyHidden: "false",
          pyDisabled: "true",
        };
        itemConfig["pyCaption"] = caption;
        this.navigation["pyElements"] = this.navigation["pyElements"] || [];
        this.navigation["pyElements"].push(itemConfig);
        this.navigation["$pxPageSize$pyElements"] = this.navigation["$pxPageSize$pyElements"] + 1;
        return this;
      }
      addSeparator() {
        var itemConfig = {
          pyBadgeFormat: "standard (label)",
          pyDeferLoad: "false",
          pyHidden: "false",
          pyCaption: "------------------",
          pyType: "Separator",
        };
        this.navigation["pyElements"].push(itemConfig);
        return this;
      }
      addSubMenu(caption, child) {
        var childElements = new NavigationBuilder();
        childElements.entryHanlde = this.entryHanlde + "$ppyElements$l" + this.navigation["$pxPageSize$pyElements"] + 1;
        childElements.build = function () {
          throw "build is not supported for inner submenu";
        };
        childElements.navigation = Object.assign(
          {
            pyBadgeFormat: "standard (label)",
            pyDeferLoad: "false",
            pyHidden: "false",
            pyCaption: caption,
            pxEntryHandle: childElements.entryHanlde,
          },
          childElements.navigation
        );
        this.navigation["pyElements"] = this.navigation["pyElements"] || [];
        this.navigation["pyElements"].push(childElements.navigation);
        child(childElements);
        return childElements;
      }
      build() {
        this.navigation["pyNoItemsMessage"] = "No Items";
        for (const key in pega.ui.ClientDataProvider.getTracker().trackedPropertiesList) {
          if (key.startsWith("pyNavigationCustom")) {
            delete pega.ui.ClientDataProvider.getTracker().trackedPropertiesList[key];
          }
        }
        for (const key in pega.u.ChangeTrackerMap.getTracker().trackedPropertiesList) {
          if (key.startsWith("pyNavigationCustom")) {
            delete pega.u.ChangeTrackerMap.getTracker().trackedPropertiesList[key];
          }
        }

        if (pega.u.d.ServerProxy.isDestinationRemote()) {
          pega.ui.ClientDataProvider.getTracker().trackedPropertiesList[this.handle] = this.navigation;
        } else {
          pega.u.ChangeTrackerMap.getTracker().trackedPropertiesList[this.handle] = this.navigation;
        }
        return this.handle;
      }
      getBuildAndConfig(config) {
        this.build();
        return Object.assign(
          {
            isNavNLDeferLoaded: "false",
            isNavTypeCustom: "false",
            UITemplatingStatus: "Y",
            menuAlign: "left",
            format: "menu-format-standard",
            loadBehavior: "screenload",
            ellipsisAfter: "45",
            usingPage: "pyWorkPage",
            useNewMenu: "true",
            isMobile: pega.u.d.ServerProxy.isDestinationRemote() ? "false" : "true",
            navPageName: this.handle,
            ContextPage: "",
          },
          config
        );
      }
      __generateBehaviour(actions) {
        const wrappedArgs = [];
        for (let i = 0; i < actions.length; i++) {
          let arg = ["runScript", [actions[i]]];
          wrappedArgs.push({ pyActionString: JSON.stringify(arg) });
        }
        return wrappedArgs;
      }
    };
  }
  showUserMenu(eventObj) {
    eventObj.target.removeAttribute("data-menuid");
    const D_AuthProfile = this.getPageJSON("D_AuthProfile");
    var menuid = Date.now();
    var actionMenu = new this.navigation(menuid);
    actionMenu.addSubMenu("UI theme", (child) => {
      child.addMenuItem("Light mode", [`${this.reference}.toggleTheme("light")`]);
      child.addMenuItem("Dark mode", [`${this.reference}.toggleTheme("dark")`]);
    });
    actionMenu.addSeparator();
    if (D_AuthProfile && D_AuthProfile.Positions && D_AuthProfile.Positions.length > 0) {
      actionMenu.addSubMenu("Switch position", (child) => {
        let i = 0;
        D_AuthProfile.Positions.forEach((position) => {
          if (position.PositionID == this.getPropertyValue("D_AuthProfile", "ActivePosition.PositionID")) {
            child.addMenuItem("* " + position.Label + " *", [`${this.reference}.setActivePosition(${i})`]);
          } else {
            child.addMenuItem(position.Label, [`${this.reference}.setActivePosition(${i})`]);
          }
          i++;
        });
      });
    }
    if (D_AuthProfile && D_AuthProfile.ForceElements && D_AuthProfile.ForceElements.length > 0) {
      actionMenu.addSubMenu("Switch unit", (child) => {
        let i = 0;
        D_AuthProfile.ForceElements.forEach((forceElement) => {
          if (forceElement.ID == D_AuthProfile.ActiveForceElement.ID) {
            child.addMenuItem("* " + forceElement.Name + " *", [`${this.reference}.setActiveForceElement(${i})`]);
          } else {
            child.addMenuItem(forceElement.Name, [`${this.reference}.setActiveForceElement(${i})`]);
          }

          i++;
        });
      });
    }
    actionMenu.addMenuItem("Log out", [`${this.reference}.setAuthProfile("")`]);

    var config = actionMenu.getBuildAndConfig({});

    pega.control.menu.showContextMenu(config, eventObj.target, eventObj);
  }

  get clientStore() {
    return launchbox.PRPC.ClientStore;
  }
  get clientCache() {
    return pega.ui.ClientCache;
  }
  async runQuery(queryString, preparedValues, dateColumns = [], dateTimeColumns = [], booleanColumns = []) {
    let results = await this.clientStore.runQuery(queryString, preparedValues);
    const transformedResults = [];

    results.forEach((obj) => {
      const transformedObj = {};

      for (const key in obj) {
        let value = obj[key];
        if (dateColumns.includes(key)) value = this.formatQueriedDate(value, true);
        else if (dateTimeColumns.includes(key)) value = this.formatQueriedDate(value, false);
        else if (booleanColumns.includes(key)) value = this.formatQueriedBoolean(value);
        else if (typeof value == "number") value = String(value);
        const keyParts = key.split(".");
        let tempObj = transformedObj;

        for (let i = 0; i < keyParts.length; i++) {
          const part = keyParts[i];

          if (!tempObj[part]) {
            tempObj[part] = i === keyParts.length - 1 ? value : {};
          }

          tempObj = tempObj[part];
        }
      }

      transformedResults.push(transformedObj);
    });

    return transformedResults;
  }
  registerLargeDatapage(dataPage, populatorFunction) {
    this.clientCache.registerLargeDatapage(dataPage, populatorFunction);
  }
  getPage(pageName) {
    const page = this.clientCache.find(pageName);
    if (!page) return null;
    return page;
  }
  setPropertyValue(pageName, propertyName, value) {
    if (value && value._asJSON) value = value._asJSON();
    if (pageName.charAt(0) == ".") pageName = pageName.substring(1);
    if (propertyName.charAt(0) == ".") propertyName = propertyName.substring(1);
    let splitPageName = pageName.split(".");
    pageName = splitPageName.shift();
    let splitPropertyName = splitPageName.concat(propertyName.split("."));
    let finalPropertyName = splitPropertyName.pop();
    let page = this.getPage(pageName) || this.clientCache.createPage(pageName);
    splitPropertyName.forEach((property) => {
      if (this.getPropertyValue(pageName, property) == null) this.setPropertyValue(pageName, property, {});
      pageName = pageName + "." + property;
    });
    this.getPage(pageName).put(finalPropertyName, value);
  }
  appendToPageList(pageName, pageList, pageValue) {
    let page = this.getPage(pageName) || this.clientCache.createPage(pageName);
    let length = 0;
    if (page.get(pageList) && page.get(pageList).pxResults) {
      length = page.get(pageList).pxResults.length;
    }
    page.put(`${pageList}(${length + 1})`, pageValue);
    return length + 1;
  }
  prependToPageList(pageName, pageList, pageValue) {
    let page = this.getPage(pageName) || this.clientCache.createPage(pageName);
    let pageListArray = this.getPropertyValue(pageName, pageList) || [];
    pageListArray.unshift(pageValue);
    this.setPropertyValue(pageName, pageList, pageListArray);
    return pageListArray.length;
  }
  removeProperty(pageName, propertyName) {
    let page = this.getPage(pageName);
    if (page) {
      page.remove(propertyName);
    }
  }
  getPropertyValue(pageName, propertyName) {
    const page = this.getPage(pageName);
    if (!page) return null;
    const property = page.get(propertyName);
    if (!property) return null;
    if (property.getValue) return property.getValue();
    if (property.pxResults) return property.pxResults;
    if (property.getJSONObject) return property.getJSONObject();
    return null;
  }
  refreshSection(section, submitOnRefresh) {
    pega.api.ui.actions.refreshSection({
      section: section,
      submitOnRefresh: submitOnRefresh,
    });
  }
  whatComesBeforeLast(str, char) {
    const lastIndex = str.lastIndexOf(char);
    if (lastIndex === -1) {
      return str;
    }
    return str.substring(0, lastIndex);
  }
  whatComesAfterLast(str, char) {
    const lastIndex = str.lastIndexOf(char);
    if (lastIndex === -1 || lastIndex === str.length - 1) {
      return "";
    }
    return str.substring(lastIndex + 1);
  }
  whatComesBeforeFirst(str, char) {
    const firstIndex = str.indexOf(char);
    if (firstIndex === -1) {
      return str;
    }
    return str.substring(0, firstIndex);
  }
  whatComesAfterFirst(str, char) {
    const firstIndex = str.indexOf(char);
    if (firstIndex === -1 || firstIndex === str.length - 1) {
      return "";
    }
    return str.substring(firstIndex + 1);
  }
  replaceNestedKeys(obj) {
    let result = {};
    for (let key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        let value = obj[key];
        if (value == "19700101T000000.000 GMT") continue;
        if (key.charAt(0) == ".") key = key.substring(1);
        let keys = key.split(".");
        let nestedObj = result;

        for (let i = 0; i < keys.length - 1; i++) {
          let nestedKey = keys[i];
          if (!nestedObj.hasOwnProperty(nestedKey)) {
            nestedObj[nestedKey] = {};
          }
          nestedObj = nestedObj[nestedKey];
        }

        let lastKey = keys[keys.length - 1];
        nestedObj[lastKey] = value;
      }
    }
    return result;
  }
  pageHasMessages(pageName) {
    if (!this.clientCache.find(pageName)) return false;
    return this.clientCache.find(pageName).hasMessages();
  }
  removePage(pageName) {
    const page = this.getPage(pageName);
    if (!page) return false;
    page.remove();
    return true;
  }
  getPageJSON(pageName) {
    const page = this.getPage(pageName);
    if (!page) return null;
    return page.getJSONObject();
  }
  addPropertyMessage(page, property, message) {
    if (!this.getPage(page).get(property)) {
      this.setPropertyValue(page, property, "");
    }
    this.getPage(page).get(property).addMessage(message);
  }
  today(offset = 0, includeTime = false) {
    const date = new Date();
    date.setDate(date.getDate() + parseInt(offset));
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    if (!includeTime) return yyyy + mm + dd;
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mi = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}T${hh}${mi}${ss}.000 GMT`;
  }
  generatePegaID(primaryPage) {
    let suffix = new Date().valueOf();
    let newID = this.getPropertyValue("OperatorID", "pyUserIdentifier") + "_" + suffix;
    let tempDocID = "TEMP-" + suffix;
    this.setPropertyValue(primaryPage, "PegaID", newID);
    let currentDocID = this.getPropertyValue(primaryPage, "SAPDocID");
    if (!currentDocID || currentDocID == "") {
      this.setPropertyValue(primaryPage, "SAPDocID", tempDocID);
    }
  }
  pageAdoptJSON(pageName, jsonValue) {
    const page = this.getPage(pageName) || this.clientCache.createPage(pageName);
    if (typeof jsonValue === "object") jsonValue = JSON.stringify(jsonValue);
    page.adoptJSON(jsonValue);
  }
  async setupSyncID(pageName) {
    if (this.getPropertyValue(pageName, "TransactionStatus.ID")) return;
    let suffix = new Date().valueOf();
    let newID = this.getPropertyValue("OperatorID", "pyUserIdentifier") + "_" + suffix;
    this.setPropertyValue(pageName, "TransactionStatus.pxObjClass", "GCSS-DiscOps-Data-SyncStatus");
    this.setPropertyValue(pageName, "TransactionStatus.ID", newID);
    this.setPropertyValue(pageName, "TransactionStatus.IDLabel", this.getPropertyValue(pageName, "Data.PegaID"));
    this.setPropertyValue(pageName, "TransactionStatus.RefPegaID", this.getPropertyValue(pageName, "Data.PegaID"));
  }
  async setupSyncStatus(pageName, description) {
    //DEPRECATED
    this.setPropertyValue(pageName, "TransactionStatus.Status", "Pending-Upload");
    this.setPropertyValue(pageName, "TransactionStatus.RefPegaID", this.getPropertyValue(pageName, "Data.PegaID"));
    this.setPropertyValue(pageName, "TransactionStatus.TimePerformed", this.today(0, true));
    this.setPropertyValue(pageName, "TransactionStatus.Description", description);
    let query = "INSERT INTO D_SyncStatusList (ID, IDLabel, Status, RefPegaID, TimePerformed, Description, softflag) VALUES (?, ?, ?, ?, ?, ?, ?)";
    let dateString = this.formatDateForInsert(this.getPropertyValue(pageName, "TransactionStatus.TimePerformed"), true);
    let preparedValues = [this.getPropertyValue(pageName, "TransactionStatus.ID"), this.getPropertyValue(pageName, "TransactionStatus.IDLabel"), this.getPropertyValue(pageName, "TransactionStatus.Status"), this.getPropertyValue(pageName, "TransactionStatus.RefPegaID"), dateString, this.getPropertyValue(pageName, "TransactionStatus.Description"), 0];
    return this.runQuery(query, preparedValues);
  }
  CreateSAPTransaction(primaryPage, params = {}) {
    this.appendToPageList(primaryPage, "TransactionStatusList", {
      ID: this.getPropertyValue(primaryPage, "TransactionStatus.ID") + (params.IDSuffix || ""),
      IDLabel: this.getPropertyValue(primaryPage, "Data.PegaID"),
      Performer: this.getPropertyValue("D_AuthProfile", "Person.DoDID"),
      RefPegaID: this.getPropertyValue(primaryPage, "Data.PegaID"),
      Description: params.Description || "",
      Status: "Pending-Upload",
      OperationName: params.OperationName || "",
      TimePerformed: this.today(0, true),
      pxObjClass: "GCSS-DiscOps-Data-SyncStatus",
      RelatedRecordID: params.RelatedRecordID,
    });
  }
  async SaveSyncStatus(pageName) {
    let TransactionStatusList = this.getPropertyValue(pageName, "TransactionStatusList") || [];
    for (let i = 0; i < TransactionStatusList.length; i++) {
      let query = "INSERT OR REPLACE INTO D_SyncStatusList (ID, IDLabel, Status, RefPegaID, TimePerformed, Description, softflag) VALUES (?, ?, ?, ?, ?, ?, ?)";
      let dateString = this.formatDateForInsert(TransactionStatusList[i].TimePerformed, true);
      let preparedValues = [TransactionStatusList[i].ID, TransactionStatusList[i].IDLabel, TransactionStatusList[i].Status, TransactionStatusList[i].RefPegaID, dateString, TransactionStatusList[i].Description, 0];
      return this.runQuery(query, preparedValues);
    }
  }
  formatDateForInsert(dateString, alreadyGMT) {
    if (!dateString || typeof dateString.slice != "function") return "";
    // Extract date and time components
    const year = dateString.slice(0, 4);
    const month = dateString.slice(4, 6);
    const day = dateString.slice(6, 8);
    const hours = dateString.slice(9, 11) || "00";
    const minutes = dateString.slice(11, 13) || "00";
    const seconds = dateString.slice(13, 15) || "00";

    // Create a new date object

    const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`);
    if (!alreadyGMT) {
      // Adjust time based on local offset
      const offset = date.getTimezoneOffset();
      date.setMinutes(date.getMinutes() + offset);
    }
    // Format the date and time
    const formattedDate = date.toISOString();

    // Return the formatted date and time
    return formattedDate;
  }
  formatBooleanForInsert(boolean) {
    if (boolean && boolean != "false" && !boolean._) return 1;
    return 0;
  }
  formatQueriedBoolean(value) {
    if (value && value != "0") return true;
    return false;
  }
  formatQueriedDate(inputString, dateOnly) {
    if (!inputString) return "";
    const date = new Date(inputString);

    // Check if the input is January 1, 1970 or earlier
    if (date.toISOString().slice(0, 10) <= "1970-01-01") {
      return "";
    }

    let year = date.getUTCFullYear();
    let month = date.getUTCMonth() + 1;
    let day = date.getUTCDate();
    let hours = date.getUTCHours();
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");

    // Handle rollover for hours
    if (hours >= 24) {
      hours -= 24;
      day += 1;

      // Check if the day exceeds the maximum days in the current month
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      if (day > lastDayOfMonth) {
        day = 1;
        month += 1;

        // Check if the month exceeds December
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    }

    let monthstr = String(month).padStart(2, "0");
    let daystr = String(day).padStart(2, "0");
    let hoursstr = String(hours).padStart(2, "0");
    if (dateOnly) return `${year}${monthstr}${daystr}`;
    return `${year}${monthstr}${daystr}T${hoursstr}${minutes}${seconds}.000 GMT`;
  }
  dateTimeDifference(earlierTime, laterTime, unit) {
    return pega.functions.DateTimeLibrary.DateTimeDifference(earlierTime, laterTime, unit);
  }
  invalidateDataPage(pageName) {
    this.clientCache.invalidateLargeDatapages([pageName]);
  }
  resetPersonData() {
    this.setPropertyValue("D_AuthProfile", "Person", {});
  }
  async setAuthWithCertificate(personNumber, serialNumber, bypassAuth) {
    if (bypassAuth) {
      await this.setAuthProfile(personNumber);
      return;
    }
    let certs = await Offline_DataPages.getClientSSLCertificateList();
    let certToAuthorize = certs.find((cert) => cert.serialNumber == serialNumber);
    if (!certToAuthorize) {
      alert("Invalid certificate");
      return;
    }
    let authPromise = launchbox.Container.userCanUseClientSSLCertificate(certToAuthorize);
    let timeout = new Promise((res) => setTimeout(() => res(false), 120000));
    let result = await Promise.race([authPromise, timeout]);
    if (result) {
      await this.setAuthProfile(personNumber);
    }
  }
  async setAuthProfile(personNumber) {
    pega.u.d.isFormDirty = function () {
      return false;
    };
    this.resetBreadcrumbs();
    if (personNumber) {
      let positions = await this.runQuery(
        "SELECT pos.PositionID as PositionID, pos.Abbreviation as Abbreviation, pos.Name as Name, fe.UIC FROM D_PositionList pos JOIN D_PositionRelationList rel1 ON pos.PositionID = rel1.PositionID and rel1.RelatedID = ? and rel1.RelatedType = ? JOIN D_PositionRelationList rel2 ON pos.PositionID = rel2.PositionID and rel2.relationtype = ? JOIN D_ForceElementList fe ON fe.id = rel2.relatedID WHERE (rel1.BeginDate IS NULL OR rel1.BeginDate = '' OR rel1.BeginDate <= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) AND (rel1.EndDate IS NULL OR rel1.EndDate = '' OR rel1.EndDate >= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) AND (rel2.BeginDate IS NULL OR rel2.BeginDate = '' OR rel2.BeginDate <= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) AND (rel2.EndDate IS NULL OR rel2.EndDate = '' OR rel2.EndDate >= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) order by rel1.RelationType",
        [personNumber, "P", "003"]
      );
      positions.forEach((item) => {
        item.Label = item.Name + ": " + item.D_ForceElementList.UIC;
      });
      let person = await this.runQuery("Select * from D_PersonList where personnumber = ?", [personNumber]);
      if (positions[0] && person[0] && person[0].DoDID && person[0].Lock != "1") {
        this.setPropertyValue("D_AuthProfile", "Person", person[0]);
        this.setPropertyValue("D_AuthProfile", "Positions", positions);
        //this.setPropertyValue("D_AuthProfile", "ActivePosition", positions[0]);
        this.setActivePosition(0);
      } else {
        alert("Not authorized to use this device");
        this.setPropertyValue("D_AuthProfile", "Person.PersonNumber", "");
      }
    } else {
      this.setPropertyValue("D_AuthProfile", "Person.PersonNumber", "");
      this.setActivePosition(-1);
    }
    let csResult = await launchbox.PRPC.ClientStore.getItem("APP-RESOURCE", "webwb/py-calendar-icon.svg");
    document.documentElement.style.setProperty("--url-calendar-icon", `url(${csResult.url})`);
    csResult = await launchbox.PRPC.ClientStore.getItem("APP-RESOURCE", "webwb/pz-autocomplete-angle.svg");
    document.documentElement.style.setProperty("--url-autocomplete-angle", `url(${csResult.url})`);
  }
  async setActivePosition(positionIndex) {
    if (positionIndex > -1) {
      const availablePositions = this.getPropertyValue("D_AuthProfile", "Positions");
      this.setPropertyValue("D_AuthProfile", "ActivePosition", availablePositions[positionIndex]);
      //Set the unit type
      if (Offline_DataPages.roleIsMaintenance()) {
        this.setPropertyValue("D_AuthProfile", "ActivePosition.UnitType", "910");
      } else if (Offline_DataPages.roleIsUnitSupply()) {
        this.setPropertyValue("D_AuthProfile", "ActivePosition.UnitType", "950");
      } else if (Offline_DataPages.roleIsPropertyBook()) {
        this.setPropertyValue("D_AuthProfile", "ActivePosition.UnitType", "920");
      } else if (Offline_DataPages.roleIsSSA()) {
        this.setPropertyValue("D_AuthProfile", "ActivePosition.UnitType", "930");
      }
    }
    let forceElements = await this.runQuery(
      "WITH RECURSIVE current_fes(ID,UIC,Name,RelationType) AS (SELECT FE.ID, FE.UIC, FE.Name, Rel.RelationType FROM D_ForceElementList FE JOIN D_PositionRelationList Rel ON FE.ID = Rel.RelatedID AND (Rel.RelationType = ? OR Rel.RelationType = ?) AND Rel.PositionID = ? AND (Rel.BeginDate IS NULL OR Rel.BeginDate = '' OR Rel.BeginDate <= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) AND (Rel.EndDate IS NULL OR Rel.EndDate = '' OR Rel.EndDate >= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) UNION SELECT FE2.ID, FE2.UIC, FE2.Name, 0 FROM D_ForceElementList FE2 JOIN D_PositionRelationList Rel2 ON FE2.ID = Rel2.RelatedID AND Rel2.RelationType = ? JOIN current_fes ON Rel2.PositionID = current_fes.ID WHERE (Rel2.BeginDate IS NULL OR Rel2.BeginDate = '' OR Rel2.BeginDate <= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) AND (Rel2.EndDate IS NULL OR Rel2.EndDate = '' OR Rel2.EndDate >= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) AND length(FE2.Name) < 7) SELECT ID as 'ID',UIC as 'UIC' ,Name as 'Name' ,MAX(RelationType) as 'RelationType' FROM current_fes group by ID,UIC,Name order by Name ",
      ["003", "290", this.getPropertyValue("D_AuthProfile", "ActivePosition.PositionID"), "002"]
    );
    this.setPropertyValue("D_AuthProfile", "ForceElements", forceElements);
    // figure out which force element is 003
    let indexOf003 = 0;
    indexOf003 = forceElements.findIndex((FE) => FE.RelationType == "003");
    this.setActiveForceElement(indexOf003);
  }
  async setActiveForceElement(forceElementIndex) {
    if (forceElementIndex > -1) {
      const availableForceElements = this.getPropertyValue("D_AuthProfile", "ForceElements");

      let activeForceElement = availableForceElements[forceElementIndex];

      let FEID = activeForceElement.ID;
      let FE = [];
      FE = await this.runQuery("SELECT * FROM D_ForceElementList WHERE ID = ?", [FEID]);
      activeForceElement.RIC = FE[0].RIC;

      this.setPropertyValue("D_AuthProfile", "ActiveForceElement", activeForceElement);

      /*
      this.setPropertyValue(
        "D_AuthProfile",
        "ActiveForceElement",
        availableForceElements[forceElementIndex]
      );
      */
      this.setPropertyValue("D_AuthProfile", "ActivePosition.Label", this.whatComesBeforeFirst(this.getPropertyValue("D_AuthProfile", "ActivePosition.Label"), ":") + ": " + this.getPropertyValue("D_AuthProfile", "ActiveForceElement.Name"));
      await this.createUserScopedViews(this.getPropertyValue("D_AuthProfile", "ActivePosition.PositionID"), availableForceElements[forceElementIndex].ID);
    }
    this.invalidateDataPage("D_DashboardTiles");
    this.invalidateDataPage("D_PositionList");
    this.refreshSection("pyPortalHeader");
    this.setPropertyValue("pyDisplayHarness", "TileGroup", "Dashboard");
    this.refreshSection("pyWorkerPortalNavigation");
    this.resetBreadcrumbs();
    pega.api.ui.actions.launchHarness({
      harness: "MyDashboard",
      harnessClass: "GCSS-DiscOps-UIPages",
      doSubmit: false,
    });
  }
  async createUserScopedViews(positionID, forceElement) {
    let query;
    await this.runQuery("Drop View if exists relations_active");
    await this.runQuery(`Create View relations_active AS Select * from D_PositionRelationList where (BeginDate IS NULL OR BeginDate = '' OR BeginDate <= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) AND (EndDate IS NULL OR EndDate = '' OR EndDate >= strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now')) `);
    await this.runQuery("Drop View if exists relations_active_StoP");
    await this.runQuery(`Create View relations_active_StoP AS Select PositionID, RelatedID, Relation, Status, RelationType from relations_active where type = 'S' and relatedtype = 'P' UNION Select PositionID as RelatedID, RelatedID as PositionID, Relation, Status, RelationType from relations_active where type = 'P' and relatedtype = 'S'`);
    await this.runQuery("Drop View if exists relations_active_StoO");
    await this.runQuery(`Create View relations_active_StoO AS Select PositionID, RelatedID, Relation, Status, RelationType from relations_active where type = 'S' and relatedtype = 'O' UNION Select PositionID as RelatedID, RelatedID as PositionID, Relation, Status, RelationType from relations_active where type = 'O' and relatedtype = 'S'`);
    await this.runQuery("Drop View if exists relations_active_OtoO");
    await this.runQuery(`Create View relations_active_OtoO AS Select PositionID, RelatedID, Relation, Status, RelationType from relations_active where type = 'O' and relatedtype = 'O'`);
    await this.runQuery("Drop View if exists relations_active_StoS");
    await this.runQuery(`Create View relations_active_StoS AS Select PositionID, RelatedID, Relation, Status, RelationType from relations_active where type = 'S' and relatedtype = 'S'`);
    //Force element
    query = `CREATE VIEW ForceElement_ForUser AS WITH RECURSIVE includedFE(ID, MRPAreaProv, UIC, RIC) AS ( SELECT FE.ID, FE.MRPAreaProv, FE.UIC, FE.RIC FROM D_ForceElementList FE WHERE FE.ID = '${forceElement}' UNION SELECT FE2.ID, FE2.MRPAreaProv, FE2.UIC, FE2.RIC FROM includedFE JOIN relations_active_OtoO Rel ON includedFE.ID = Rel.PositionID JOIN D_ForceElementList FE2 ON FE2.ID = Rel.RelatedID) SELECT * FROM includedFE;`;
    await this.runQuery("DROP VIEW IF EXISTS ForceElement_ForUser");
    await this.runQuery(query);
    //Position
    query = `CREATE VIEW Position_ForUser AS SELECT DISTINCT Pos.PositionID FROM D_PositionList Pos LEFT JOIN relations_active Rel ON Pos.PositionID = Rel.RelatedID AND Rel.RelationType = 'ZA3' WHERE Pos.PositionID = '${positionID}' OR Rel.PositionID = '${positionID}'`;
    await this.runQuery("DROP VIEW IF EXISTS Position_ForUser");
    await this.runQuery(query);
    //Person by Unit (for user admin, use the next. for personnel position report, use the brigade level data. this is for all other usage, such as dispatch operators and work order confirmations)
    query = `CREATE VIEW Person_ForUser AS select distinct person.* from forceelement_foruser FE join relations_active_StoO StoO on StoO.relatedid = FE.ID JOIN relations_active_StoP StoP on StoO.positionID = StoP.positionID join D_personlist Person on person.personnumber = StoP.relatedid`;
    await this.runQuery("DROP VIEW IF EXISTS Person_ForUser");
    await this.runQuery(query);
    //Person under admin (this is for user admin tile. above view with the additional rule that the user's positon has to have a ZA3 relation)
    query = `CREATE VIEW PersonAdmin_ForUser AS select distinct * from Person_ForUser person JOIN relations_active_StoP rel on rel.relatedid = person.personnumber JOIN relations_active_StoS Rel2 ON Rel2.RelatedID = rel.PositionID AND Rel2.RelationType = 'ZA3' JOIN position_foruser Pos ON Pos.PositionID = rel2.PositionID`;
    await this.runQuery("DROP VIEW IF EXISTS PersonAdmin_ForUser");
    await this.runQuery(query);
    //SLOC
    query = `CREATE VIEW SLOC_ForUser AS SELECT SLOC.* FROM D_StorageLocationList SLOC JOIN ForceElement_ForUser FE ON SLOC.MRPArea = FE.MRPAreaProv`;
    await this.runQuery("DROP VIEW IF EXISTS SLOC_ForUser");
    await this.runQuery(query);
    //Inventory
    query = `CREATE VIEW MaterialOnHand_ForUser AS SELECT Material.* FROM D_MaterialOnHandList Material JOIN SLOC_ForUser SLOC ON SLOC.StorageLocation = Material.StorageLocation`;
    await this.runQuery("DROP VIEW IF EXISTS MaterialOnHand_ForUser");
    await this.runQuery(query);
    //Equipment
    query = `CREATE VIEW Equipment_ForUser AS SELECT Equip.* FROM D_EquipmentList Equip LEFT JOIN D_PegaSAPReference PegaKey on Equip.PegaID = PegaKey.PegaID WHERE PegaKey.SAPDocID IS NULL AND Equip.PegaID in (SELECT Eq.PegaID FROM D_EquipmentList Eq JOIN SLOC_ForUser SLOC ON SLOC.StorageLocation = Eq.StorageLocation UNION SELECT Eq.PegaID FROM D_EquipmentList Eq JOIN ForceElement_ForUser FE ON FE.UIC = Eq.UIC OR FE.UIC = Eq.WorkCenter) `;
    await this.runQuery("DROP VIEW IF EXISTS Equipment_ForUser");
    await this.runQuery(query);
    //Maint PLan
    query = `CREATE VIEW MaintenancePlan_ForUser AS SELECT Plan.* FROM D_MaintenancePlanList Plan JOIN Equipment_ForUser Eq on Plan.EQUNR = Eq.ID`;
    await this.runQuery("DROP VIEW IF EXISTS MaintenancePlan_ForUser");
    await this.runQuery(query);
    //Labor Confirmation
    query = `CREATE VIEW LaborConfirmation_ForUser AS select Conf.* from D_LaborConfirmationList Conf JOIN Person_ForUser Person ON Conf.PERNR = Person.PersonNumber`;
    await this.runQuery("DROP VIEW IF EXISTS LaborConfirmation_ForUser");
    await this.runQuery(query);
    //Returns
    query = `CREATE VIEW Returns_ForUser AS select Returns.* from D_ReturnsList Returns JOIN SLOC_ForUser SLOC ON Returns.Reslo = SLOC.StorageLocation`;
    await this.runQuery("DROP VIEW IF EXISTS Returns_ForUser");
    await this.runQuery(query);
    //Warehouse Stock
    query = `CREATE VIEW WarehouseStock_ForUser AS select Warehouse.* from D_WarehouseStockList Warehouse JOIN ForceElement_ForUser FE ON Warehouse.Warehouse = FE.RIC`;
    await this.runQuery("DROP VIEW IF EXISTS WarehouseStock_ForUser");
    await this.runQuery(query);
    //Requirement
    query = `CREATE VIEW Requirement_ForUser AS select Req.* from D_RequirementList Req JOIN SLOC_ForUser SLOC ON Req.StorageLocation = SLOC.StorageLocation LEFT JOIN D_PegaSAPReference PegaKey on Req.PegaID = PegaKey.PegaID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS Requirement_ForUser");
    await this.runQuery(query);
    //CFC
    query = `CREATE VIEW CFC_ForUser AS select CFC.* from D_CFCList CFC JOIN SLOC_ForUser SLOC ON CFC.StorageLocation = SLOC.StorageLocation`;
    await this.runQuery("DROP VIEW IF EXISTS CFC_ForUser");
    await this.runQuery(query);
    //Dispatch fix the scripts from below
    query = `CREATE VIEW Dispatch_ForUser AS select Dispatch.* from D_DispatchList Dispatch JOIN Equipment_ForUser Equip ON Dispatch.EquipmentID = Equip.PegaID LEFT JOIN D_PegaSAPReference PegaKey on Dispatch.PegaID = PegaKey.PegaID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS Dispatch_ForUser");
    await this.runQuery(query);
    //Maintenance
    query = `CREATE VIEW Maintenance_ForUser AS select Maintenance.* from D_MaintenanceList Maintenance JOIN Equipment_ForUser Equip ON Maintenance.EquipmentID = Equip.PegaID LEFT JOIN D_PegaSAPReference PegaKey on Maintenance.PegaID = PegaKey.PegaID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS Maintenance_ForUser");
    await this.runQuery(query);
    //Work Order
    query = `CREATE VIEW WorkOrder_ForUser AS select WorkOrder.* from D_WorkOrderList WorkOrder JOIN Equipment_ForUser Equip ON WorkOrder.EquipmentID = Equip.PegaID LEFT JOIN D_PegaSAPReference PegaKey on WorkOrder.PegaID = PegaKey.PegaID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS WorkOrder_ForUser");
    await this.runQuery(query);
    //Material type
    query = `CREATE VIEW MaterialType_ForUser AS SELECT MT.* FROM D_MaterialTypeList MT LEFT JOIN D_PegaSAPReference PegaKey on MT.PegaID = PegaKey.PegaID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS MaterialType_ForUser");
    await this.runQuery(query);
    //Keyed views (for old Pega ID lookup)
    query = `CREATE VIEW KeyedWorkOrder_ForUser AS select SAPKey.PegaID AS 'OldPegaID', WorkOrder.* from D_WorkOrderList WorkOrder JOIN Equipment_ForUser Equip ON WorkOrder.EquipmentID = Equip.PegaID LEFT JOIN D_PegaSAPReference PegaKey on WorkOrder.PegaID = PegaKey.PegaID LEFT JOIN D_PegaSAPReference SAPKey on WorkOrder.PegaID = SAPKey.SAPDocID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS KeyedWorkOrder_ForUser");
    await this.runQuery(query);
    query = `CREATE VIEW KeyedDispatch_ForUser AS select SAPKey.PegaID AS 'OldPegaID', Dispatch.* from D_DispatchList Dispatch JOIN Equipment_ForUser Equip ON Dispatch.EquipmentID = Equip.PegaID LEFT JOIN D_PegaSAPReference PegaKey on Dispatch.PegaID = PegaKey.PegaID LEFT JOIN D_PegaSAPReference SAPKey on Dispatch.PegaID = SAPKey.SAPDocID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS KeyedDispatch_ForUser");
    await this.runQuery(query);
    query = `CREATE VIEW KeyedMaintenance_ForUser AS select SAPKey.PegaID AS 'OldPegaID', Maintenance.* from D_MaintenanceList Maintenance JOIN Equipment_ForUser Equip ON Maintenance.EquipmentID = Equip.PegaID LEFT JOIN D_PegaSAPReference PegaKey on Maintenance.PegaID = PegaKey.PegaID LEFT JOIN D_PegaSAPReference SAPKey on Maintenance.PegaID = SAPKey.SAPDocID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS KeyedMaintenance_ForUser");
    await this.runQuery(query);
    query = `CREATE VIEW KeyedEquipment_ForUser AS SELECT SAPKey.PegaID AS 'OldPegaID', Equip.* FROM D_EquipmentList Equip LEFT JOIN D_PegaSAPReference PegaKey on Equip.PegaID = PegaKey.PegaID LEFT JOIN D_PegaSAPReference SAPKey on Equip.PegaID = SAPKey.SAPDocID WHERE PegaKey.SAPDocID IS NULL AND Equip.pegaID in (SELECT Eq.PegaID FROM D_EquipmentList Eq JOIN SLOC_ForUser SLOC ON SLOC.StorageLocation = Eq.StorageLocation UNION SELECT Eq.PegaID FROM D_EquipmentList Eq JOIN ForceElement_ForUser FE ON FE.UIC = Eq.UIC OR FE.UIC = Eq.WorkCenter) `;
    await this.runQuery("DROP VIEW IF EXISTS KeyedEquipment_ForUser");
    await this.runQuery(query);
    query = `CREATE VIEW KeyedRequirement_ForUser AS select SAPKey.PegaID AS 'OldPegaID', Req.* from D_RequirementList Req JOIN SLOC_ForUser SLOC ON Req.StorageLocation = SLOC.StorageLocation LEFT JOIN D_PegaSAPReference PegaKey on Req.PegaID = PegaKey.PegaID LEFT JOIN D_PegaSAPReference SAPKey on Req.PegaID = SAPKey.SAPDocID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS KeyedRequirement_ForUser");
    await this.runQuery(query);
    query = `CREATE VIEW KeyedMaterialType_ForUser AS SELECT SAPKey.PegaID AS 'OldPegaID', MT.* FROM D_MaterialTypeList MT LEFT JOIN D_PegaSAPReference PegaKey on MT.PegaID = PegaKey.PegaID LEFT JOIN D_PegaSAPReference SAPKey on MT.PegaID = SAPKey.SAPDocID WHERE PegaKey.SAPDocID IS NULL`;
    await this.runQuery("DROP VIEW IF EXISTS KeyedMaterialType_ForUser");
    await this.runQuery(query);
  }
  removePageMessages(pageName) {
    if (!this.getPage(pageName)) {
      this.getPage(pageName).clearMessages();
    }
  }
  generateTransforms(context, dataTransforms, className = "", baseClassName = "") {
    let modifiedClassName = className.toLowerCase().replace(/-/g, "_");
    if (modifiedClassName == baseClassName) modifiedClassName == "";
    for (const key in dataTransforms) {
      if (dataTransforms.hasOwnProperty(key)) {
        const value = dataTransforms[key];
        if (baseClassName) {
          pega.datatransform[baseClassName + "_" + key] = async function (...args) {
            await value.call(context, ...args);
          };
        }
        if (modifiedClassName) {
          pega.datatransform[modifiedClassName + "_" + key] = async function (...args) {
            await value.call(context, ...args);
          };
        }
      }
    }
  }
  convertStringMapToObject(inputString) {
    if (!inputString) return {};

    const parsedData = {};

    const pairs = inputString.split("&");
    for (const pair of pairs) {
      const [key, value] = pair.split("=");
      if (key && value) {
        parsedData[key] = decodeURIComponent(value);
      }
    }

    return parsedData;
  }
  pzRound(numericArg, places) {
    const multiplier = Math.pow(10, places);
    return Math.round(numericArg * multiplier) / multiplier;
  }
  LengthOfPageList(pageList) {
    //Assumes pageList is a proxy
    let value = pageList._valueOf();
    if (!Array.isArray(value)) return 0;
    return value.length;
  }
  breadcrumbGoBack(index = -1) {
    let Breadcrumbs = new ClipboardPage("Breadcrumbs");
    let bcCases = this.getPropertyValue("Breadcrumbs", "pxResults");
    if (bcCases && bcCases.length > 0) {
      index = ((index % bcCases.length) + bcCases.length) % bcCases.length;
      let steps = bcCases.length - index;
      let lastCase = bcCases[bcCases.length - steps];
      bcCases.splice(-1 * steps, steps);
      Breadcrumbs.pxResultCount = Breadcrumbs.pxResultCount - steps;
      this.setPropertyValue("Breadcrumbs", "pxResults", bcCases);
      if (bcCases.length > 0) {
        this.setPropertyValue("Breadcrumbs", "pyLabel", bcCases.pop().pyLabel);
      }
      if (lastCase.Type == "Report") {
        this.pageAdoptJSON("PrepopulateCase", lastCase.Case);
        createNewWork(lastCase.Case.pxObjClass, "", "pyStartCase", "&=", "", "", "", {});
      } else if (lastCase.Type == "Dashboard") {
        this.performTileAction("ShowTileGroupFromMenu", "", lastCase.Case.TileGroup);
        pega.control.UIElement.Actions.showHarnessWrapper("newDocument", "GCSS-DiscOps-UIPages", "MyDashboard", "", "", "pyPortalHarness", "My Dashboard", "", "Yes", "");
      }
    }
  }
  resetBreadcrumbs(includeHome = false) {
    this.removePage("Breadcrumbs");
    if (includeHome) {
      this.pageAdoptJSON("Breadcrumbs", {
        pxResultCount: 1,
        pxResults: [
          {
            Type: "Dashboard",
            pyLabel: "Dashboard",
            Case: {
              TileGroup: "Dashboard",
            },
          },
        ],
      });
    } else {
      this.setPropertyValue("D_DisplayHarness", "TileGroup", "Dashboard");
    }
  }
  recordPageAsBreadcrumb(casePage, type = "Report", label = "Dashboard") {
    let Breadcrumbs = new ClipboardPage("Breadcrumbs");
    let bcCasesArr = this.getPropertyValue("Breadcrumbs", "pxResults") || [];
    let newCase = this.getPageJSON(casePage);
    if (type == "Report") {
      label = newCase.pyLabel;
      try {
        newCase.ScrollTop = document.querySelector('[node_name="ViewReport"]').scrollTop;
        newCase.ScrollLeft = document.querySelector('[node_name="ViewReport"]').scrollLeft;
      } catch (error) {}
    } else if (type == "Dashboard") {
      label = newCase.TileGroup || "Dashboard";
    }
    bcCasesArr.push({
      Type: type,
      Case: newCase,
      pyLabel: label,
      PageIndex: bcCasesArr.length,
    });
    Breadcrumbs.pxResults = bcCasesArr;
    Breadcrumbs.pxResultCount = bcCasesArr.length;
    Breadcrumbs.pyLabel = "Back to " + label;
  }
  static manuallySyncAndCallback(qualifiedFunctionName, ...args) {
    const [className, functionName] = qualifiedFunctionName.split(".");
    let callbackFunc = () => {};
    if (window[className] && typeof window[className][functionName] === "function") {
      callbackFunc = window[className][functionName];
    }
    pega.offline.DataSync.addListener({
      onStart: () => {},
      onStatusUpdate: (status) => {
        if (status.event == 3) {
          callbackFunc(...args);
          pega.offline.DataSync.dataSyncListenerList.pop();
        }
      },
    });
    window.datasyncStart();
  }
  IsInPageList(lookFor, lookAt, lookIn) {
    if (!Array.isArray(lookIn)) return false;
    return lookIn.some((element) => element[lookAt] == lookFor);
  }
  countInPageList(lookFor, lookAt, lookIn) {
    if (!Array.isArray(lookIn)) return 0;
    let count = 0;
    lookIn.forEach((element, i) => {
      if (element[lookAt] == lookFor) count++;
    });
    return count;
  }
  IndexInPageList(lookFor, lookAt, lookIn) {
    if (!Array.isArray(lookIn)) return -1;
    let index = lookIn.findIndex((element) => element[lookAt] == lookFor);
    if (index >= 0) index++;
    return index;
  }
  IsInPageListWhen(func, array) {
    return array.findIndex(func) >= 0;
  }
  IndexInPageListWhen(func, array) {
    return array.findIndex(func);
  }
  textToBase64Barcode(text) {
    if (text !== "" && text !== null) {
      var canvas = document.createElement("canvas");
      JsBarcode(canvas, text, { displayValue: false, width: 10 });
      var dataURL = canvas.toDataURL("image/jpg");
      return dataURL.replace("data:", "").replace(/^.+,/, "");
    } else {
      return text;
    }
  }

  async getUrlForBinaryFile(binaryFile) {
    let results = await launchbox.PRPC.ClientStore.getItems("APP-RESOURCE", binaryFile);
    if (!results[0]) return "";
    return results[0].url;
  }
  async openBinaryFile(binaryFile) {
    let url = await this.getUrlForBinaryFile(binaryFile);
    if (url) {
      launchbox.DocumentViewer.open(url);
    } else {
      alert("Invalid file name: " + binaryFile);
    }
  }
};

HarnessUtil = new OfflineUtilType("HarnessUtil");
OfflineUtil = new OfflineUtilType("HarnessUtil");

ClassLookups["GCSS-DiscOps-Work-Report-Inventory"] = OfflineCase_Report_Inventory;
ClassLookups["GCSS-DiscOps-Work-Report-EquipmentStatus"] = OfflineCase_Report_EquipmentStatus;
