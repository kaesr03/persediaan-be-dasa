import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import Sale from '../models/saleModel.js';
import Expense from '../models/expenseModel.js';

// Resolve category query param (accepts id or name). Returns ObjectId or null.
const resolveCategoryId = async (val) => {
  if (!val) return null;
  return new mongoose.Types.ObjectId(String(val));
};

// Build months Jan..Dec for a specific year
const makeYearMonths = (year) =>
  Array.from({ length: 12 }, (_, i) => ({ year, month: i + 1 }));

const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // queries (independent filters)
    const {
      totalStockCategory,
      totalStockSoldCategory,
      totalIncomeCategory,
      popularProductsCategory,
      year,
    } = req.query;

    // resolve category ids (if user passed name or id)
    const [totalStockCatId, soldCatId, incomeCatId, popularCatId] =
      await Promise.all([
        resolveCategoryId(totalStockCategory),
        resolveCategoryId(totalStockSoldCategory),
        resolveCategoryId(totalIncomeCategory),
        resolveCategoryId(popularProductsCategory),
      ]);

    // year for monthly numbers (default now)
    const yr = Number(year) || new Date().getFullYear();
    const monthsArray = makeYearMonths(yr);
    const startDate = new Date(yr, 0, 1);
    const endDate = new Date(yr + 1, 0, 1);

    // --- PIPELINES for each independent metric ---

    // 1) Total stock (Product) — filter by totalStockCatId if present
    const productMatch = { user: userId };
    if (totalStockCatId) productMatch.category = totalStockCatId;

    const productStockPipeline = [
      { $match: productMatch },
      {
        $group: {
          _id: null,
          totalStock: { $sum: { $ifNull: ['$quantity', 0] } },
          productCount: { $sum: 1 },
        },
      },
    ];

    // 2) Total sold (Sale) — filter by soldCatId if present
    const soldPipeline = [
      { $match: { user: userId } },
      { $unwind: '$products' },
      // lookup product to check its category if needed
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    ];
    if (soldCatId)
      soldPipeline.push({ $match: { 'prod.category': soldCatId } });
    soldPipeline.push({
      $group: {
        _id: null,
        totalProductsSold: { $sum: '$products.quantity' },
      },
    });

    // 3) Total income (Sale revenue) — filter by incomeCatId if present
    const incomePipeline = [
      { $match: { user: userId, status: 'PAID' } },
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    ];
    if (incomeCatId)
      incomePipeline.push({ $match: { 'prod.category': incomeCatId } });
    incomePipeline.push({
      $group: {
        _id: null,
        totalRevenue: {
          $sum: {
            $multiply: ['$products.quantity', '$products.sellingPrice'],
          },
        },
      },
    });

    // 4) Popular products (top N) — filter by popularCatId if present
    const popularPipeline = [
      { $match: { user: userId } },
      { $unwind: '$products' },
      {
        $lookup: {
          from: 'products',
          localField: 'products.productId',
          foreignField: '_id',
          as: 'prod',
        },
      },
      { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    ];
    if (popularCatId)
      popularPipeline.push({ $match: { 'prod.category': popularCatId } });
    popularPipeline.push(
      {
        $group: {
          _id: '$products.productId',
          name: { $first: '$prod.name' },
          totalSold: { $sum: '$products.quantity' },
          totalRevenue: {
            $sum: {
              $multiply: ['$products.quantity', '$products.sellingPrice'],
            },
          },
        },
      },
      { $sort: { totalSold: -1, name: 1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          name: 1,
          totalSold: 1,
          totalRevenue: 1,
        },
      }
    );

    // 5) Monthly sales for YEAR (no category filter as requested)
    const monthlySalesPipeline = [
      {
        $match: {
          user: userId,
          status: 'PAID',
          paidAt: { $gte: startDate, $lt: endDate },
        },
      },
      { $unwind: '$products' },
      {
        $group: {
          _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
          sold: { $sum: '$products.quantity' },
          revenue: {
            $sum: {
              $multiply: ['$products.quantity', '$products.sellingPrice'],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          sold: 1,
          revenue: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ];

    // 6) Monthly expenses for YEAR (no category filter)
    const monthlyExpensesPipeline = [
      {
        $match: {
          user: userId,
          date: { $gte: startDate, $lt: endDate },
        },
      },
      { $unwind: '$products' },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' } },
          amount: {
            $sum: {
              $multiply: ['$products.quantity', '$products.purchasePrice'],
            },
          },
        },
      },
      {
        $project: { _id: 0, year: '$_id.year', month: '$_id.month', amount: 1 },
      },
      { $sort: { year: 1, month: 1 } },
    ];

    // Run aggregations in parallel
    const [
      stockAgg,
      soldAgg,
      incomeAgg,
      popularAgg,
      monthlySalesAgg,
      monthlyExpensesAgg,
    ] = await Promise.all([
      Product.aggregate(productStockPipeline),
      Sale.aggregate(soldPipeline),
      Sale.aggregate(incomePipeline),
      Sale.aggregate(popularPipeline),
      Sale.aggregate(monthlySalesPipeline),
      Expense.aggregate(monthlyExpensesPipeline),
    ]);

    // Normalize results & defaults
    const totalStock = (stockAgg[0] && stockAgg[0].totalStock) || 0;
    const productCount = (stockAgg[0] && stockAgg[0].productCount) || 0;

    const totalProductsSold = (soldAgg[0] && soldAgg[0].totalProductsSold) || 0;
    const totalRevenue = (incomeAgg[0] && incomeAgg[0].totalRevenue) || 0;

    // Build month maps and fill Jan..Dec
    const salesMap = new Map();
    (monthlySalesAgg || []).forEach((m) => {
      salesMap.set(`${m.year}-${m.month}`, {
        sold: m.sold,
        revenue: m.revenue,
      });
    });
    const monthlySales = monthsArray.map((m) => {
      const key = `${m.year}-${m.month}`;
      const found = salesMap.get(key) || { sold: 0, revenue: 0 };
      return {
        year: m.year,
        month: m.month,
        sold: found.sold,
        revenue: found.revenue,
      };
    });

    const expMap = new Map();
    (monthlyExpensesAgg || []).forEach((m) => {
      expMap.set(`${m.year}-${m.month}`, { amount: m.amount });
    });
    const monthlyExpenses = monthsArray.map((m) => {
      const key = `${m.year}-${m.month}`;
      const found = expMap.get(key) || { amount: 0 };
      return { year: m.year, month: m.month, amount: found.amount };
    });

    const popularProducts = popularAgg || [];

    // Optionally return available years (from sales + expenses)
    const [salesYears, expenseYears] = await Promise.all([
      Sale.aggregate([
        { $match: { user: userId } },
        { $group: { _id: { $year: '$date' } } },
        { $project: { year: '$_id', _id: 0 } },
      ]),
      Expense.aggregate([
        { $match: { user: userId } },
        { $group: { _id: { $year: '$date' } } },
        { $project: { year: '$_id', _id: 0 } },
      ]),
    ]);
    const years = Array.from(
      new Set([
        ...salesYears.map((y) => y.year || new Date().getFullYear()),
        ...expenseYears.map((y) => y.year || new Date().getFullYear()),
      ])
    ).sort((a, b) => b - a);

    // Respond
    res.status(200).json({
      status: 'success',
      data: {
        years,
        summary: {
          totalStock,
          productCount,
          totalProductsSold,
          totalRevenue,
        },
        monthlySales,
        monthlyExpenses,
        popularProducts,
      },
    });
  } catch (err) {
    next(err);
  }
};

export default getDashboard;

// import mongoose from 'mongoose';
// import Product from '../models/productModel.js';
// import Sale from '../models/saleModel.js';
// import Expense from '../models/expenseModel.js';
// import Category from '../models/categoryModel.js';

// const isObjectId = (s) => /^[0-9a-fA-F]{24}$/.test(String(s));

// // helper: resolve category param (id or name) => ObjectId or null
// const resolveCategoryId = async (val) => {
//   if (!val) return null;
//   if (isObjectId(val)) return new mongoose.Types.ObjectId(String(val));
//   const cat = await Category.findOne({ name: val }).select('_id');
//   return cat ? cat._id : null;
// };

// // helper: build months Jan..Dec for a year
// const makeYearMonths = (year) => {
//   return Array.from({ length: 12 }, (_, i) => ({
//     year,
//     month: i + 1,
//   }));
// };

// const getDashboard = async (req, res, next) => {
//   const userId = req.user._id;
//   const {
//     popularProductsCategory,
//     totalStockCategory,
//     totalStockSoldCategory,
//     totalIncomeCategory,
//     year,
//   } = req.query;

//   // resolve category ids (allow name or id). If not provided -> null
//   const [popularCatId, totalStockCatId, summaryCatId] = await Promise.all([
//     resolveCategoryId(popularProductsCategory),
//     resolveCategoryId(totalStockCategory),
//     resolveCategoryId(summaryCategory),
//   ]);

//   // year for monthly stats (default current year)
//   const yr = Number(year) || new Date().getFullYear();
//   const monthsArray = makeYearMonths(yr);
//   const startDate = new Date(yr, 0, 1);
//   const endDate = new Date(yr + 1, 0, 1);

//   // build pipeline pieces where needed
//   // STOCK (Product) - consider totalStockCatId
//   const stockMatch = { user: userId };
//   if (totalStockCatId) stockMatch.category = totalStockCatId;

//   // SALES - overall (summary)
//   // We'll join product to be able to filter by product.category when summaryCatId present
//   const salesSummaryPipeline = [
//     { $match: { user: userId } },
//     { $unwind: '$products' },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'products.productId',
//         foreignField: '_id',
//         as: 'prod',
//       },
//     },
//     { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
//   ];
//   if (summaryCatId) {
//     salesSummaryPipeline.push({ $match: { 'prod.category': summaryCatId } });
//   }
//   salesSummaryPipeline.push(
//     {
//       $group: {
//         _id: null,
//         totalProductsSold: { $sum: '$products.quantity' },
//         totalRevenue: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.sellingPrice'],
//           },
//         },
//         salesDocs: { $addToSet: '$_id' },
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//         totalProductsSold: 1,
//         totalRevenue: 1,
//         salesCount: { $size: '$salesDocs' },
//       },
//     }
//   );

//   // MONTHLY SALES for year (summaryCategory used to filter if provided)
//   const monthlySalesPipeline = [
//     {
//       $match: {
//         user: userId,
//         date: { $gte: startDate, $lt: endDate },
//       },
//     },
//     { $unwind: '$products' },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'products.productId',
//         foreignField: '_id',
//         as: 'prod',
//       },
//     },
//     { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
//   ];
//   if (summaryCatId)
//     monthlySalesPipeline.push({ $match: { 'prod.category': summaryCatId } });
//   monthlySalesPipeline.push(
//     {
//       $group: {
//         _id: { year: { $year: '$date' }, month: { $month: '$date' } },
//         sold: { $sum: '$products.quantity' },
//         revenue: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.sellingPrice'],
//           },
//         },
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//         year: '$_id.year',
//         month: '$_id.month',
//         sold: 1,
//         revenue: 1,
//       },
//     },
//     { $sort: { year: 1, month: 1 } }
//   );

//   // MONTHLY EXPENSES for year (summaryCategory used to filter if provided)
//   // We compute computedAmount per expense doc either from amount or sum(products.quantity * purchasePrice)
//   const monthlyExpensesPipeline = [
//     {
//       $match: {
//         user: userId,
//         date: { $gte: startDate, $lt: endDate },
//       },
//     },
//     { $unwind: '$products' },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'products.productId',
//         foreignField: '_id',
//         as: 'prod',
//       },
//     },
//     { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
//   ];
//   if (summaryCatId)
//     monthlyExpensesPipeline.push({
//       $match: { 'prod.category': summaryCatId },
//     });
//   monthlyExpensesPipeline.push(
//     {
//       $group: {
//         _id: { year: { $year: '$date' }, month: { $month: '$date' } },
//         amount: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.purchasePrice'],
//           },
//         },
//       },
//     },
//     {
//       $project: { _id: 0, year: '$_id.year', month: '$_id.month', amount: 1 },
//     },
//     { $sort: { year: 1, month: 1 } }
//   );

//   // POPULAR PRODUCTS (top N) - uses popularCatId if provided
//   const popularPipeline = [
//     { $match: { user: userId } },
//     { $unwind: '$products' },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'products.productId',
//         foreignField: '_id',
//         as: 'prod',
//       },
//     },
//     { $unwind: '$prod' }, // HAPUS preserveNullAndEmptyArrays
//   ];

//   if (popularCatId) {
//     popularPipeline.push({
//       $match: { 'prod.category': popularCatId },
//     });
//   }

//   popularPipeline.push(
//     {
//       $group: {
//         _id: '$products.productId',
//         name: { $first: '$prod.name' },
//         totalSold: { $sum: '$products.quantity' },
//         totalRevenue: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.sellingPrice'],
//           },
//         },
//       },
//     },
//     { $sort: { totalSold: -1 } },
//     { $limit: 10 },
//     {
//       $project: {
//         _id: 0,
//         productId: '$_id',
//         name: 1,
//         totalSold: 1,
//         totalRevenue: 1,
//       },
//     }
//   );

//   // EXPENSE CATEGORIES (for pie/summary) - no category filter by default
//   const expenseCategoriesPipeline = [
//     { $match: { user: userId } },
//     { $unwind: '$products' },
//     {
//       $group: {
//         _id: '$products.name',
//         total: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.purchasePrice'],
//           },
//         },
//       },
//     },
//     { $project: { _id: 0, name: '$_id', value: '$total' } },
//     { $sort: { value: -1 } },
//   ];

//   // RUN AGGREGATIONS in parallel
//   const [
//     stockAgg,
//     salesAgg,
//     monthlySalesAgg,
//     monthlyExpensesAgg,
//     popularProductsAgg,
//     expenseCategoriesAgg,
//     yearsAgg,
//   ] = await Promise.all([
//     // stock
//     Product.aggregate([
//       { $match: stockMatch },
//       {
//         $group: {
//           _id: null,
//           totalStock: { $sum: { $ifNull: ['$quantity', 0] } },
//           productCount: { $sum: 1 },
//         },
//       },
//     ]),
//     // sales summary
//     Sale.aggregate(salesSummaryPipeline),
//     // monthly sales
//     Sale.aggregate(monthlySalesPipeline),
//     // monthly expenses
//     Expense.aggregate(monthlyExpensesPipeline),
//     // popular products
//     Sale.aggregate(popularPipeline),
//     // expense categories
//     Expense.aggregate(expenseCategoriesPipeline),
//     Promise.all([
//       Sale.aggregate([
//         { $match: { user: userId } },
//         { $group: { _id: { $year: '$date' } } },
//       ]),
//       Expense.aggregate([
//         { $match: { user: userId } },
//         { $group: { _id: { $year: '$date' } } },
//       ]),
//     ]),
//   ]);

//   // normalize outputs
//   const totalStock = (stockAgg[0] && stockAgg[0].totalStock) || 0;
//   const productCount = (stockAgg[0] && stockAgg[0].productCount) || 0;

//   const totalProductsSold = (salesAgg[0] && salesAgg[0].totalProductsSold) || 0;
//   const totalRevenue = (salesAgg[0] && salesAgg[0].totalRevenue) || 0;
//   const salesCount = (salesAgg[0] && salesAgg[0].salesCount) || 0;

//   // monthly arrays Jan..Dec for sales
//   const monthlySalesMap = new Map();
//   (monthlySalesAgg || []).forEach((m) => {
//     monthlySalesMap.set(`${m.year}-${m.month}`, {
//       sold: m.sold,
//       revenue: m.revenue,
//     });
//   });
//   const monthlySales = monthsArray.map((m) => {
//     const key = `${m.year}-${m.month}`;
//     const found = monthlySalesMap.get(key) || { sold: 0, revenue: 0 };
//     return {
//       year: m.year,
//       month: m.month,
//       sold: found.sold,
//       revenue: found.revenue,
//     };
//   });

//   // monthly expenses Jan..Dec
//   const monthlyExpensesMap = new Map();
//   (monthlyExpensesAgg || []).forEach((m) => {
//     monthlyExpensesMap.set(`${m.year}-${m.month}`, { amount: m.amount });
//   });
//   const monthlyExpenses = monthsArray.map((m) => {
//     const key = `${m.year}-${m.month}`;
//     const found = monthlyExpensesMap.get(key) || { amount: 0 };
//     return { year: m.year, month: m.month, amount: found.amount };
//   });

//   const popularProducts = popularProductsAgg || [];
//   const expenseCategories = expenseCategoriesAgg || [];
//   const years = Array.from(
//     new Set([
//       ...(yearsAgg?.[0] || []).map((y) => y._id),
//       ...(yearsAgg?.[1] || []).map((y) => y._id),
//     ])
//   ).sort((a, b) => b - a);

//   // assemble response
//   res.status(200).json({
//     status: 'success',
//     data: {
//       years,
//       summary: {
//         totalStock,
//         productCount,
//         totalProductsSold,
//         totalRevenue,
//         salesCount,
//       },
//       monthlySales,
//       monthlyExpenses,
//       popularProducts,
//       expenseCategories,
//     },
//   });
// };

// export default getDashboard;

// import mongoose from 'mongoose';
// import Product from '../models/productModel.js';
// import Sale from '../models/saleModel.js';
// import Expense from '../models/expenseModel.js';
// import Category from '../models/categoryModel.js';

// const isObjectId = (s) => /^[0-9a-fA-F]{24}$/.test(String(s));

// // helper: resolve category param (id or name) => ObjectId or null
// const resolveCategoryId = async (val) => {
//   if (!val) return null;
//   if (isObjectId(val)) return new mongoose.Types.ObjectId(String(val));
//   const cat = await Category.findOne({ name: val }).select('_id');
//   return cat ? cat._id : null;
// };

// // helper: build months Jan..Dec for a year
// const makeYearMonths = (year) => {
//   return Array.from({ length: 12 }, (_, i) => ({
//     year,
//     month: i + 1,
//   }));
// };

// const getDashboard = async (req, res, next) => {
//   const userId = req.user._id;
//   const { popularProductsCategory, totalStockCategory, summaryCategory, year } =
//     req.query;

//   // resolve category ids (allow name or id). If not provided -> null
//   const [popularCatId, totalStockCatId, summaryCatId] = await Promise.all([
//     resolveCategoryId(popularProductsCategory),
//     resolveCategoryId(totalStockCategory),
//     resolveCategoryId(summaryCategory),
//   ]);

//   // year for monthly stats (default current year)
//   const yr = Number(year) || new Date().getFullYear();
//   const monthsArray = makeYearMonths(yr);
//   const startDate = new Date(yr, 0, 1);
//   const endDate = new Date(yr + 1, 0, 1);

//   // build pipeline pieces where needed
//   // STOCK (Product) - consider totalStockCatId
//   const stockMatch = { user: userId };
//   if (totalStockCatId) stockMatch.category = totalStockCatId;

//   // SALES - overall (summary)
//   // We'll join product to be able to filter by product.category when summaryCatId present
//   const salesSummaryPipeline = [
//     { $match: { user: userId } },
//     { $unwind: '$products' },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'products.productId',
//         foreignField: '_id',
//         as: 'prod',
//       },
//     },
//     { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
//   ];
//   if (summaryCatId) {
//     salesSummaryPipeline.push({ $match: { 'prod.category': summaryCatId } });
//   }
//   salesSummaryPipeline.push(
//     {
//       $group: {
//         _id: null,
//         totalProductsSold: { $sum: '$products.quantity' },
//         totalRevenue: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.sellingPrice'],
//           },
//         },
//         salesDocs: { $addToSet: '$_id' },
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//         totalProductsSold: 1,
//         totalRevenue: 1,
//         salesCount: { $size: '$salesDocs' },
//       },
//     }
//   );

//   // MONTHLY SALES for year (summaryCategory used to filter if provided)
//   const monthlySalesPipeline = [
//     {
//       $match: {
//         user: userId,
//         date: { $gte: startDate, $lt: endDate },
//       },
//     },
//     { $unwind: '$products' },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'products.productId',
//         foreignField: '_id',
//         as: 'prod',
//       },
//     },
//     { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
//   ];
//   if (summaryCatId)
//     monthlySalesPipeline.push({ $match: { 'prod.category': summaryCatId } });
//   monthlySalesPipeline.push(
//     {
//       $group: {
//         _id: { year: { $year: '$date' }, month: { $month: '$date' } },
//         sold: { $sum: '$products.quantity' },
//         revenue: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.sellingPrice'],
//           },
//         },
//       },
//     },
//     {
//       $project: {
//         _id: 0,
//         year: '$_id.year',
//         month: '$_id.month',
//         sold: 1,
//         revenue: 1,
//       },
//     },
//     { $sort: { year: 1, month: 1 } }
//   );

//   // MONTHLY EXPENSES for year (summaryCategory used to filter if provided)
//   // We compute computedAmount per expense doc either from amount or sum(products.quantity * purchasePrice)
//   const monthlyExpensesPipeline = [
//     {
//       $match: {
//         user: userId,
//         date: { $gte: startDate, $lt: endDate },
//       },
//     },
//     { $unwind: '$products' },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'products.productId',
//         foreignField: '_id',
//         as: 'prod',
//       },
//     },
//     { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
//   ];
//   if (summaryCatId)
//     monthlyExpensesPipeline.push({
//       $match: { 'prod.category': summaryCatId },
//     });
//   monthlyExpensesPipeline.push(
//     {
//       $group: {
//         _id: { year: { $year: '$date' }, month: { $month: '$date' } },
//         amount: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.purchasePrice'],
//           },
//         },
//       },
//     },
//     {
//       $project: { _id: 0, year: '$_id.year', month: '$_id.month', amount: 1 },
//     },
//     { $sort: { year: 1, month: 1 } }
//   );

//   // POPULAR PRODUCTS (top N) - uses popularCatId if provided
//   const popularPipeline = [
//     { $match: { user: userId } },
//     { $unwind: '$products' },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'products.productId',
//         foreignField: '_id',
//         as: 'prod',
//       },
//     },
//     { $unwind: '$prod' }, // HAPUS preserveNullAndEmptyArrays
//   ];

//   if (popularCatId) {
//     popularPipeline.push({
//       $match: { 'prod.category': popularCatId },
//     });
//   }

//   popularPipeline.push(
//     {
//       $group: {
//         _id: '$products.productId',
//         name: { $first: '$prod.name' },
//         totalSold: { $sum: '$products.quantity' },
//         totalRevenue: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.sellingPrice'],
//           },
//         },
//       },
//     },
//     { $sort: { totalSold: -1 } },
//     { $limit: 10 },
//     {
//       $project: {
//         _id: 0,
//         productId: '$_id',
//         name: 1,
//         totalSold: 1,
//         totalRevenue: 1,
//       },
//     }
//   );

//   // EXPENSE CATEGORIES (for pie/summary) - no category filter by default
//   const expenseCategoriesPipeline = [
//     { $match: { user: userId } },
//     { $unwind: '$products' },
//     {
//       $group: {
//         _id: '$products.name',
//         total: {
//           $sum: {
//             $multiply: ['$products.quantity', '$products.purchasePrice'],
//           },
//         },
//       },
//     },
//     { $project: { _id: 0, name: '$_id', value: '$total' } },
//     { $sort: { value: -1 } },
//   ];

//   // RUN AGGREGATIONS in parallel
//   const [
//     stockAgg,
//     salesAgg,
//     monthlySalesAgg,
//     monthlyExpensesAgg,
//     popularProductsAgg,
//     expenseCategoriesAgg,
//     yearsAgg,
//   ] = await Promise.all([
//     // stock
//     Product.aggregate([
//       { $match: stockMatch },
//       {
//         $group: {
//           _id: null,
//           totalStock: { $sum: { $ifNull: ['$quantity', 0] } },
//           productCount: { $sum: 1 },
//         },
//       },
//     ]),
//     // sales summary
//     Sale.aggregate(salesSummaryPipeline),
//     // monthly sales
//     Sale.aggregate(monthlySalesPipeline),
//     // monthly expenses
//     Expense.aggregate(monthlyExpensesPipeline),
//     // popular products
//     Sale.aggregate(popularPipeline),
//     // expense categories
//     Expense.aggregate(expenseCategoriesPipeline),
//     Promise.all([
//       Sale.aggregate([
//         { $match: { user: userId } },
//         { $group: { _id: { $year: '$date' } } },
//       ]),
//       Expense.aggregate([
//         { $match: { user: userId } },
//         { $group: { _id: { $year: '$date' } } },
//       ]),
//     ]),
//   ]);

//   // normalize outputs
//   const totalStock = (stockAgg[0] && stockAgg[0].totalStock) || 0;
//   const productCount = (stockAgg[0] && stockAgg[0].productCount) || 0;

//   const totalProductsSold = (salesAgg[0] && salesAgg[0].totalProductsSold) || 0;
//   const totalRevenue = (salesAgg[0] && salesAgg[0].totalRevenue) || 0;
//   const salesCount = (salesAgg[0] && salesAgg[0].salesCount) || 0;

//   // monthly arrays Jan..Dec for sales
//   const monthlySalesMap = new Map();
//   (monthlySalesAgg || []).forEach((m) => {
//     monthlySalesMap.set(`${m.year}-${m.month}`, {
//       sold: m.sold,
//       revenue: m.revenue,
//     });
//   });
//   const monthlySales = monthsArray.map((m) => {
//     const key = `${m.year}-${m.month}`;
//     const found = monthlySalesMap.get(key) || { sold: 0, revenue: 0 };
//     return {
//       year: m.year,
//       month: m.month,
//       sold: found.sold,
//       revenue: found.revenue,
//     };
//   });

//   // monthly expenses Jan..Dec
//   const monthlyExpensesMap = new Map();
//   (monthlyExpensesAgg || []).forEach((m) => {
//     monthlyExpensesMap.set(`${m.year}-${m.month}`, { amount: m.amount });
//   });
//   const monthlyExpenses = monthsArray.map((m) => {
//     const key = `${m.year}-${m.month}`;
//     const found = monthlyExpensesMap.get(key) || { amount: 0 };
//     return { year: m.year, month: m.month, amount: found.amount };
//   });

//   const popularProducts = popularProductsAgg || [];
//   const expenseCategories = expenseCategoriesAgg || [];
//   const years = Array.from(
//     new Set([
//       ...(yearsAgg?.[0] || []).map((y) => y._id),
//       ...(yearsAgg?.[1] || []).map((y) => y._id),
//     ])
//   ).sort((a, b) => b - a);

//   // assemble response
//   res.status(200).json({
//     status: 'success',
//     data: {
//       years,
//       summary: {
//         totalStock,
//         productCount,
//         totalProductsSold,
//         totalRevenue,
//         salesCount,
//       },
//       monthlySales,
//       monthlyExpenses,
//       popularProducts,
//       expenseCategories,
//     },
//   });
// };

// import Product from '../models/productModel.js';
// import Sale from '../models/saleModel.js';
// import Expense from '../models/expenseModel.js';

// const makeLast12Months = () => {
//   const months = [];
//   const now = new Date();
//   now.setDate(1); // set to first day to avoid month-boundary issues
//   for (let i = 11; i >= 0; i--) {
//     const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
//     months.push({ year: d.getFullYear(), month: d.getMonth() + 1 }); // month 1..12
//   }
//   return months;
// };

// const getDashboard = async (req, res, next) => {
//   try {
//     const userId = req.user._id;
//     const {
//       popularProductsCategory,
//       totalStockCategory,
//       summaryCategory,
//       year,
//     } = req.query;

//     // range untuk 12 bulan terakhir
//     const months = makeLast12Months();
//     const firstMonth = months[0];
//     const startDate = new Date(
//       firstMonth.year,
//       firstMonth.month - 1,
//       1,
//       0,
//       0,
//       0,
//       0
//     );

//     // jalankan aggregations paralel
//     const [
//       stockAgg,
//       salesAgg,
//       monthlySalesAgg,
//       monthlyExpensesAgg,
//       popularProductsAgg,
//       expenseCategoriesAgg,
//     ] = await Promise.all([
//       // 1) total stock
//       Product.aggregate([
//         { $match: { user: userId } },
//         {
//           $group: {
//             _id: null,
//             totalStock: { $sum: { $ifNull: ['$quantity', 0] } },
//             productCount: { $sum: 1 },
//           },
//         },
//       ]),

//       // 2) total sold & total revenue (overall)
//       Sale.aggregate([
//         { $match: { user: userId } },
//         { $unwind: '$products' },
//         {
//           $group: {
//             _id: null,
//             totalProductsSold: { $sum: '$products.quantity' },
//             totalRevenue: {
//               $sum: {
//                 $multiply: ['$products.quantity', '$products.sellingPrice'],
//               },
//             },
//             salesCount: { $sum: 1 }, // counts unwinded items? if want number of sales remove unwind above
//           },
//         },
//       ]),

//       // 3) monthly sales (last 12 months) - group by year+month
//       Sale.aggregate([
//         { $match: { user: userId, date: { $gte: startDate } } },
//         { $unwind: '$products' },
//         {
//           $group: {
//             _id: {
//               year: { $year: '$date' },
//               month: { $month: '$date' },
//               // optionally productId: "$products.productId"
//             },
//             sold: { $sum: '$products.quantity' },
//             revenue: {
//               $sum: {
//                 $multiply: ['$products.quantity', '$products.sellingPrice'],
//               },
//             },
//           },
//         },
//         {
//           $project: {
//             _id: 0,
//             year: '$_id.year',
//             month: '$_id.month',
//             sold: 1,
//             revenue: 1,
//           },
//         },
//         { $sort: { year: 1, month: 1 } },
//       ]),

//       // 4) monthly expenses (last 12 months) - sum by expense.amount (if present) or compute from products
//       Expense.aggregate([
//         { $match: { user: userId, date: { $gte: startDate } } },
//         {
//           $addFields: {
//             computedAmount: {
//               $cond: [
//                 { $gt: [{ $ifNull: ['$amount', null] }, null] },
//                 '$amount',
//                 {
//                   // compute sum(products.quantity * purchasePrice)
//                   $reduce: {
//                     input: '$products',
//                     initialValue: 0,
//                     in: {
//                       $add: [
//                         '$$value',
//                         {
//                           $multiply: [
//                             '$$this.quantity',
//                             '$$this.purchasePrice',
//                           ],
//                         },
//                       ],
//                     },
//                   },
//                 },
//               ],
//             },
//           },
//         },
//         {
//           $group: {
//             _id: { year: { $year: '$date' }, month: { $month: '$date' } },
//             amount: { $sum: '$computedAmount' },
//           },
//         },
//         {
//           $project: {
//             _id: 0,
//             year: '$_id.year',
//             month: '$_id.month',
//             amount: 1,
//           },
//         },
//         { $sort: { year: 1, month: 1 } },
//       ]),

//       // 5) popular products overall (top N by qty sold)
//       Sale.aggregate([
//         { $match: { user: userId } },
//         { $unwind: '$products' },
//         {
//           $group: {
//             _id: '$products.productId',
//             name: { $first: '$products.name' },
//             totalSold: { $sum: '$products.quantity' },
//             totalRevenue: {
//               $sum: {
//                 $multiply: ['$products.quantity', '$products.sellingPrice'],
//               },
//             },
//           },
//         },
//         { $sort: { totalSold: -1 } },
//         { $limit: 4 },
//         {
//           $project: {
//             _id: 0,
//             productId: '$_id',
//             name: 1,
//             totalSold: 1,
//             totalRevenue: 1,
//           },
//         },
//       ]),

//       // 6) expense categories (group by product name across expenses)
//       Expense.aggregate([
//         { $match: { user: userId } },
//         { $unwind: '$products' },
//         {
//           $group: {
//             _id: '$products.name',
//             total: {
//               $sum: {
//                 $multiply: ['$products.quantity', '$products.purchasePrice'],
//               },
//             },
//           },
//         },
//         {
//           $project: {
//             _id: 0,
//             name: '$_id',
//             value: '$total',
//           },
//         },
//         { $sort: { value: -1 } },
//       ]),
//     ]);

//     // Normalize results & defaults
//     const totalStock = (stockAgg[0] && stockAgg[0].totalStock) || 0;
//     const productCount = (stockAgg[0] && stockAgg[0].productCount) || 0;

//     const totalProductsSold =
//       (salesAgg[0] && salesAgg[0].totalProductsSold) || 0;
//     const totalRevenue = (salesAgg[0] && salesAgg[0].totalRevenue) || 0;

//     // build monthly arrays filling months with 0 if missing
//     const monthlySalesMap = new Map();
//     (monthlySalesAgg || []).forEach((m) => {
//       monthlySalesMap.set(`${m.year}-${m.month}`, {
//         sold: m.sold,
//         revenue: m.revenue,
//       });
//     });

//     const monthlySales = months.map((m) => {
//       const key = `${m.year}-${m.month}`;
//       const found = monthlySalesMap.get(key) || { sold: 0, revenue: 0 };
//       return {
//         year: m.year,
//         month: m.month,
//         sold: found.sold,
//         revenue: found.revenue,
//       };
//     });

//     const monthlyExpensesMap = new Map();
//     (monthlyExpensesAgg || []).forEach((m) => {
//       monthlyExpensesMap.set(`${m.year}-${m.month}`, { amount: m.amount });
//     });
//     const monthlyExpenses = months.map((m) => {
//       const key = `${m.year}-${m.month}`;
//       const found = monthlyExpensesMap.get(key) || { amount: 0 };
//       return { year: m.year, month: m.month, amount: found.amount };
//     });

//     // popularProductsAgg already limited top N
//     const popularProducts = popularProductsAgg || [];

//     // expenseCategoriesAgg ready
//     const expenseCategories = expenseCategoriesAgg || [];

//     // assemble response
//     res.status(200).json({
//       status: 'success',
//       data: {
//         summary: {
//           totalStock,
//           productCount,
//           totalProductsSold,
//           totalRevenue,
//         },
//         monthlySales, // array of last 12 months {year,month,sold,revenue}
//         monthlyExpenses, // array of last 12 months {year,month,amount}
//         popularProducts, // top products { productId, name, totalSold, totalRevenue }
//         expenseCategories, // [{name, value}]
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// export default getDashboard;

// import Product from '../models/productModel.js';
// import Expense from '../models/expenseModel.js';
// // import Supplier from '../models/supplierModel.js';
// import Sale from '../models/saleModel.js';

// // import ApiFeatures from '../utils/ApiFeatures.js';
// // import AppError from '../utils/AppError.js';

// const getDashboard = async (req, res, next) => {
//   const [products, sales, expenses] = await Promise.all([
//     Product.aggregate([
//       { $match: { user: req.user._id } },
//       { $sort: { sellingPrice: 1 } },
//     ]),
//     Sale.aggregate([
//       { $match: { user: req.user._id } },
//       {
//         $group: {
//           _id: { year: { $year: '$date' } },
//           totalRevenue: { $sum: '$total' },
//           salesCount: { $sum: 1 },
//         },
//       },
//       { $sort: { '_id.year': 1 } },
//     ]),
//     Expense.find({ user: req.user._id }),
//   ]);

//   res.status(200).json({
//     status: 'success',
//     data: {
//       products: products,
//       sales: sales,
//       expenses: expenses,
//     },
//   });
// };

// export default getDashboard;
