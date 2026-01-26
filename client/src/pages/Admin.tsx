import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export default function Admin() {
  const [secret, setSecret] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("");

  // Filter bookings into two categories
  const activeBookings = bookings.filter(b => b.paymentStatus !== 'blocked');
  const blockedDates = bookings.filter(b => b.paymentStatus === 'blocked');

  // 1. LOGIN FUNCTION
  const checkLogin = () => {
    fetch("/api/bookings", {
      headers: { "x-admin-secret": secret }
    }).then(res => {
      if (res.ok) {
        setIsAuthenticated(true);
        res.json().then(data => setBookings(data));
        localStorage.setItem("admin_secret", secret);
      } else {
        alert("Wrong Secret Password!");
      }
    });
  };

  // Auto-login
  useEffect(() => {
    const saved = localStorage.getItem("admin_secret");
    if (saved) setSecret(saved);
  }, []);

  // 2. BLOCK DATES FUNCTION
  const handleBlockDates = async () => {
    if (!startDate || !endDate) return alert("Pick dates first");

    setStatus("Blocking...");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-admin-secret": secret 
      },
      body: JSON.stringify({
        name: "Offline Block", // This name will show in the Blocked table
        email: "admin@legacy.co.ke",
        phone: "+254000000000",
        adults: 1,
        children: 0,
        totalAmount: "0",
        checkIn: startDate,
        checkOut: endDate,
        paymentMethod: "paystack"
      })
    });

    const data = await res.json();
    if (res.ok) {
      alert("Dates Blocked Successfully!");
      refreshBookings();
      setStartDate("");
      setEndDate("");
    } else {
      alert("Error: " + data.message);
    }
    setStatus("");
  };

  // 3. DELETE BOOKING FUNCTION
  const handleDelete = async (id: string) => {
    if(!confirm("Are you sure you want to delete/unblock this?")) return;
    
    const res = await fetch(`/api/bookings/${id}`, {
      method: "DELETE",
      headers: { "x-admin-secret": secret }
    });
    
    if (res.ok) {
      refreshBookings();
    } else {
      alert("Failed to delete");
    }
  };

  const refreshBookings = () => {
    fetch("/api/bookings", { headers: { "x-admin-secret": secret } })
      .then(r => r.json())
      .then(d => setBookings(d));
  }

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow-md w-96">
          <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Legacy Admin</h1>
          <input 
            type="password" 
            placeholder="Enter Admin Secret"
            className="border p-2 w-full mb-4 rounded"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <button onClick={checkLogin} className="bg-blue-600 text-white px-4 py-2 rounded w-full font-bold hover:bg-blue-700 transition">
            Login
          </button>
        </div>
      </div>
    );
  }

  // DASHBOARD SCREEN
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-500">Manage bookings and availability</p>
          </div>
          <button onClick={() => { setIsAuthenticated(false); localStorage.removeItem("admin_secret"); }} className="text-red-500 font-medium hover:text-red-700">
            Logout
          </button>
        </div>

        {/* TOOL: BLOCK DATES */}
        <div className="bg-white p-6 rounded-lg shadow mb-8 border-l-4 border-orange-500">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Block Dates (Maintenance / Offline)</h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Start Date</label>
              <input type="date" className="border p-2 rounded w-40" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">End Date</label>
              <input type="date" className="border p-2 rounded w-40" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button onClick={handleBlockDates} className="bg-orange-600 text-white px-6 py-2 rounded font-medium hover:bg-orange-700 transition">
              {status || "Block Selected Dates"}
            </button>
          </div>
        </div>

        {/* SECTION 1: ACTIVE GUEST BOOKINGS */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
            <span className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded mr-2">{activeBookings.length}</span>
            Active Guest Bookings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-sm uppercase tracking-wider">
                  <th className="p-4">Guest Name</th>
                  <th className="p-4">Check In</th>
                  <th className="p-4">Check Out</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-medium text-gray-900">{b.name}</td>
                    <td className="p-4 text-gray-600">{new Date(b.checkIn).toDateString()}</td>
                    <td className="p-4 text-gray-600">{new Date(b.checkOut).toDateString()}</td>
                    <td className="p-4 text-gray-600 text-sm">
                      <div>{b.email}</div>
                      <div>{b.phone}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        b.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {b.paymentStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDelete(b.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-semibold border border-red-200 hover:border-red-400 px-3 py-1 rounded"
                      >
                        Cancel Booking
                      </button>
                    </td>
                  </tr>
                ))}
                {activeBookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 italic">No active guests found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: BLOCKED DATES */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
            <span className="bg-gray-200 text-gray-700 text-sm px-2 py-1 rounded mr-2">{blockedDates.length}</span>
            Blocked Dates (Unavailable)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-sm uppercase tracking-wider">
                  <th className="p-4">Reason / Name</th>
                  <th className="p-4">From</th>
                  <th className="p-4">To</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {blockedDates.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-medium text-gray-700">{b.name}</td>
                    <td className="p-4 text-gray-600">{new Date(b.checkIn).toDateString()}</td>
                    <td className="p-4 text-gray-600">{new Date(b.checkOut).toDateString()}</td>
                    <td className="p-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">
                        BLOCKED
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDelete(b.id)}
                        className="text-blue-500 hover:text-blue-700 text-sm font-semibold hover:underline"
                      >
                        Unblock Dates
                      </button>
                    </td>
                  </tr>
                ))}
                {blockedDates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400 italic">No dates are currently blocked.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}