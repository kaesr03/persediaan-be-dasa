class ApiFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludeFields = ['page', 'sort', 'limit', 'fields'];
    excludeFields.forEach((el) => delete queryObj[el]);

    if (queryObj.buyerName) {
      queryObj.buyerName = { $regex: queryObj.buyerName, $options: 'i' };
    }
    if (queryObj.name) {
      queryObj.name = { $regex: queryObj.name, $options: 'i' };
    }
    if (queryObj.productName) {
      queryObj['products.name'] = {
        $regex: queryObj.productName,
        $options: 'i',
      };
      delete queryObj.productName;
    }
    if (queryObj.category) {
      queryObj.category = queryObj.category;
    }
    if (queryObj.brand) {
      queryObj.brand = queryObj.brand;
    }
    if (queryObj.status) {
      queryObj.status = queryObj.status;
    }

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-date');
    }
    return this;
  }

  limitField() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

export default ApiFeatures;
