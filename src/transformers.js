/* @flow */

import type { Quote, Transaction } from './types';

type GfTransaction = {
  'Cash value': string,
  Commission: string,
  Date: string,
  Name: string,
  Notes: string,
  Price: string,
  Shares: string,
  Symbol: string,
  Type: 'Buy' | 'Sell',
};

type TdTransaction = {
  description: string,
  transactionDate: string,
  transactionSubType: string,
  transactionItem: {
    price: number,
    amount: number,
    instrument: {
      symbol: string,
    },
  },
  fees: Object,
};

export function transformTdToStocks(tdTransactions: Array<TdTransaction>): Array<Transaction> {
  const lookupType = {
    BY: 'Buy',
    DR: 'Buy', // Dividend Reinvest
    TC: 'Buy', // Trade Correction
    SL: 'Sell',
    CS: 'Buy to cover',
    SS: 'Sell short',
  };

  return tdTransactions.map(transaction => {
    if (transaction.transactionItem.instrument.assetType !== 'EQUITY') {
      return null;
    }

    return {
      cashValue: null,
      commission: Object.values(transaction.fees).reduce((s, v) => s + v, 0),
      date: transaction.transactionDate.split('T').shift(),
      id: -1, // A real ID is added in the reducer.
      notes: null,
      price: transaction.transactionItem.price,
      shares: transaction.transactionItem.amount,
      symbol: transaction.transactionItem.instrument.symbol,
      type: lookupType[transaction.transactionSubType] || `${transaction.transactionSubType} (${transaction.description})`,
    }
  }).filter(Boolean);
}

export function transformGfToStocks(gfTransactions: Array<GfTransaction>): Array<Transaction> {
  return gfTransactions.map(transaction => ({
    cashValue: transaction['Cash value'] === '' ? null : parseFloat(transaction['Cash value']),
    commission: parseFloat(transaction.Commission),
    date: transaction.Date,
    id: -1, // A real ID is added in the reducer.
    notes: transaction.Notes,
    price: parseFloat(transaction.Price),
    shares: parseFloat(transaction.Shares),
    symbol: transaction.Symbol,
    type: transaction.Type,
  }));
}

export function transformStocksToGf(
  stocksTransactions: Array<Transaction>,
  quotes: { [symbol: string]: Quote }
): Array<GfTransaction> {
  return stocksTransactions.map(transaction => ({
    'Cash value': transaction.cashValue == null ? '' : `${transaction.cashValue}`,
    Commission: `${transaction.commission}`,
    Date: transaction.date == null ? '' : transaction.date,
    Name: quotes[transaction.symbol] == null ? '' : quotes[transaction.symbol].companyName,
    Notes: transaction.notes == null ? '' : transaction.notes,
    Price: `${transaction.price}`,
    Shares: `${transaction.shares}`,
    Symbol: transaction.symbol,
    Type: transaction.type,
  }));
}
