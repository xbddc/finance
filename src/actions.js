/* @flow */

import type { Dispatch, GetState, Transaction } from './types';
import csvParse from 'csv-parse/lib/es5/sync';
import axios from 'axios';
import querystring from 'querystring';
import { transformTdToStocks, transformGfToStocks } from './transformers';

const IEX_ROOT = 'https://cloud.iexapis.com/stable';
const IEX_TOKEN = '__YOUR_TOKEN_HERE__';

const TD_ROOT = 'https://api.tdameritrade.com/v1';
const TD_TOKEN = '__YOUR_TOKEN_HERE__';
const TD_ACCT = '__YOUR_TD_ACCOUNT_NUMBER_HERE__';
const REDIRECT_URL = 'http://localhost/'; // same as your td app's redirect url

export function addSymbol(symbol: string) {
  return { symbol, type: 'ADD_SYMBOL' };
}

export function addTransaction(transaction: Transaction) {
  return { transaction, type: 'ADD_TRANSACTION' };
}

export function addTransactions(transactions: Array<Transaction>) {
  return { transactions, type: 'ADD_TRANSACTIONS' };
}

export function changePageSize(nextPageSize: number) {
  return { pageSize: nextPageSize, type: 'CHANGE_PAGE_SIZE' };
}

export function deletePortfolio() {
  return { type: 'DELETE_PORTFOLIO' };
}

export function deleteSymbols(symbols: Array<string>) {
  return { symbols, type: 'DELETE_SYMBOLS' };
}

export function deleteTransactions(transactions: Array<Transaction>) {
  return { transactions, type: 'DELETE_TRANSACTIONS' };
}

export function downloadPortfolio() {
  return { type: 'DOWNLOAD_PORTFOLIO' };
}

// A timeout to periodically fetch new quotes.
let fetchAllQuotesTimeout: ?TimeoutID;

function clearFetchQuotesTimeout() {
  if (fetchAllQuotesTimeout != null) {
    clearTimeout(fetchAllQuotesTimeout);
    fetchAllQuotesTimeout = null;
  }
}

// Example data:
//
// {
//   date: '2018-04-09',
//   open: 169.88,
//   high: 173.09,
//   low: 169.845,
//   close: 170.05,
//   volume: 29017718,
//   unadjustedVolume: 29017718,
//   change: 1.67,
//   changePercent: 0.992,
//   vwap: 171.555,
//   label: 'Apr 9',
//   changeOverTime: 0,
// }
export function fetchSymbolData(symbol: string) {
  return function(dispatch: Dispatch) {
    dispatch({ type: 'FETCH_SYMBOL_DATA_REQUEST' });
    fetch(`${IEX_ROOT}/stock/${symbol}/batch?types=chart,quote&token=${IEX_TOKEN}&range=1y`)
      .then(response => {
        response
          .json()
          .then(symbolData => {
            dispatch({ symbol, symbolData, type: 'FETCH_SYMBOL_DATA_SUCCESS' });
          })
          .catch(error => {
            dispatch({ error, type: 'FETCH_SYMBOL_DATA_FAILURE' });
          });
      })
      .catch(error => {
        dispatch({ error, type: 'FETCH_SYMBOL_DATA_FAILURE' });
      });
  };
}

export function fetchAllQuotes() {
  return function(dispatch: Dispatch, getState: GetState) {
    function setFetchQuotesTimeout() {
      // Because more `fetchQuote` actions might be in flight, ensure the timer is empty and
      // synchronously create the next one (even though it was cleared once when this action was
      // first dispatched). This ensures no more than one timeout at a time is pending.
      clearFetchQuotesTimeout();
      setTimeout(() => {
        dispatch(fetchAllQuotes());
      }, 300000); // Fetch quotes minimally every 5 minutes. (5 * 60 * 1000)
    }

    const { symbols } = getState();
    if (symbols.length === 0) {
      // No need to do anything if there are no symbols to fetch. Restart the timer and bomb out
      // early.
      clearFetchQuotesTimeout();
      setFetchQuotesTimeout();
      return;
    }

    clearFetchQuotesTimeout();
    dispatch({ type: 'FETCH_QUOTES_REQUEST' });
    fetch(
      `${TD_ROOT}/marketdata/quotes?apikey=${TD_TOKEN}&symbol=${encodeURIComponent(
        getState().symbols.join(',')
      )}`
    )
      .then(response => {
        response
          .json()
          .then(data => {
            // Data comes back under the endpoint from which it was requested. In this case the key
            // is `quote`. Unzip the response to match the shape of the store.
            //
            // See: https://iextrading.com/developer/docs/#batch-requests
            const nextQuotes = {};
            Object.keys(data).forEach(symbol => {
              nextQuotes[symbol] = {
                change: data[symbol].netChange,
                changePercent: data[symbol].netPercentChangeInDouble / 100,
                companyName: data[symbol].description,
                high: data[symbol].highPrice,
                latestPrice: data[symbol].lastPrice,
                latestVolume: data[symbol].totalVolume,
                low: data[symbol].lowPrice,
                open: data[symbol].openPrice,
              }
            });
            dispatch({ quotes: nextQuotes, type: 'FETCH_QUOTES_SUCCESS' });
          })
          .catch(error => {
            dispatch({ error, type: 'FETCH_QUOTES_FAILURE' });
          });
      })
      .catch(error => {
        dispatch({ error, type: 'FETCH_QUOTES_FAILURE' });
      })
      .finally(() => {
        setFetchQuotesTimeout();
      });
  };
}

export function fetchAllIexSymbols() {
  return function(dispatch: Dispatch) {
    dispatch({ type: 'FETCH_ALL_IEX_SYMBOLS_REQUEST' });
    fetch(`${IEX_ROOT}/ref-data/symbols?token=${IEX_TOKEN}`)
      .then(response => {
        response
          .json()
          .then(data => {
            dispatch({ allIexSymbols: data, type: 'FETCH_ALL_IEX_SYMBOLS_SUCCESS' });
          })
          .catch(error => {
            dispatch({ error, type: 'FETCH_ALL_IEX_SYMBOLS_FAILURE' });
          });
      })
      .catch(error => {
        dispatch({ error, type: 'FETCH_ALL_IEX_SYMBOLS_FAILURE' });
      });
  };
}

export function getCodeFromTD() {
  return function(dispatch: Dispatch) {
    window.open('https://auth.tdameritrade.com/auth?' +
    querystring.stringify({
      response_type: 'code',
      redirect_uri: REDIRECT_URL,
      client_id: `${TD_TOKEN}@AMER.OAUTHAP`
    }));
    dispatch({ type: 'GET_CODE_FROM_TD_REQUEST' });
  };
}

export function getTokenFromTD(code: string) {
  return function(dispatch: Dispatch) {
    dispatch({ type: 'GET_TOKEN_FROM_TD_REQUEST' });

    axios.post(
      `${TD_ROOT}/oauth2/token`,
      querystring.stringify({
        grant_type: 'authorization_code',
        access_type: 'offline',
        client_id: `${TD_TOKEN}@AMER.OAUTHAP`,
        redirect_uri: REDIRECT_URL,
        code,
      }),
    )
    .then(r => {
      const accessToken = r.data.refresh_token;
      dispatch({ accessToken, type: 'GET_TOKEN_FROM_TD_SUCCESS' });
    })
    .catch(err => {
      alert(err);
      dispatch({ type: 'GET_TOKEN_FROM_TD_FAILURE' });
    })
  };
}

export function importFromTD() {
  return function(dispatch: Dispatch, getState: GetState) {
    dispatch({ type: 'IMPORT_FROM_TD_REQUEST' });
    const { accessToken } = getState();

    (async () => {
      let allTransactions = [];
      try {
        const r = await axios.post(
          `${TD_ROOT}/oauth2/token`,
          querystring.stringify({
            grant_type: 'refresh_token',
            refresh_token: accessToken,
            client_id: `${TD_TOKEN}@AMER.OAUTHAP`,
          }),
        );
        const newToken = r.data.access_token;

        for (let year = new Date().getFullYear(); year > 0; year -= 1) {
          const r = await axios.get(`${TD_ROOT}/accounts/${TD_ACCT}/transactions?type=TRADE&startDate=${year}-01-01&endDate=${year}-12-31`, {
            headers: { authorization: `Bearer ${newToken}`}
          });

          const transactions = transformTdToStocks(r.data);
          if (transactions.length < 1) {
            break;
          }
          transactions.reverse();
          allTransactions = [...transactions, ...allTransactions];
        }
        dispatch(addTransactions(allTransactions));
      } catch (err) {
        alert(err);
      }
    })();
  };
}

export function importTransactionsFile(file: Blob) {
  return function(dispatch: Dispatch) {
    dispatch({ type: 'IMPORT_TRANSACTIONS_FILE_REQUEST' });
    const fileReader = new FileReader();
    fileReader.onerror = () => {
      dispatch({ type: 'IMPORT_TRANSACTIONS_FILE_FAILURE' });
    };
    fileReader.onload = () => {
      const parsedCsv = csvParse(fileReader.result, { columns: true });
      dispatch(addTransactions(transformGfToStocks(parsedCsv)));
      dispatch(fetchAllQuotes());
      dispatch({ type: 'IMPORT_TRANSACTIONS_FILE_SUCCESS' });
    };
    fileReader.readAsText(file);
  };
}
