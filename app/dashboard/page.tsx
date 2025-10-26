"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, LogOut, Search, Loader2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
// Remove this line:
// import { id } from "date-fns/locale"

// Types for API response
interface TripDetail {
  id: number
  trip_id: number
  group_id: number
  device_id: number
  type: "TAP_IN" | "TAP_OUT"
  amount: number
  status: string
  qr_content: string
  source: string
  source_timestamp: string
  created_at: string
}

interface Trip {
  id: number
  operator_id: number
  user_cpan: string
  amount: number
  status: string
  created_at: string
  tap_in_at: string
  tap_out_at: string
  trip_details: TripDetail[]
}

interface ApiResponse {
  data: Trip[]
}

type SortField = "created_at" | "amount" | "final_amount" | "id" | "user_cpan"
type SortDirection = "asc" | "desc"

interface SortConfig {
  field: SortField
  direction: SortDirection
}

export default function DashboardPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [trips, setTrips] = useState<Trip[]>([])
  const [filteredData, setFilteredData] = useState<Trip[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  // Replace the single dateFilter state with date range
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isFilterLoading, setIsFilterLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: "created_at", direction: "desc" })
  const router = useRouter()
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    const auth = localStorage.getItem("isAuthenticated")
    if (auth === "true") {
      setIsAuthenticated(true)
    } else {
      router.push("/login")
    }
  }, [router])

  // Fetch data from API
  const fetchTrips = async (isManualRefresh = false) => {
    if (!isAuthenticated) return

    try {
      if (isManualRefresh) {
        setIsInitialLoading(true)
      }
      setError("")

      const response = await fetch("https://afc-dev.ainosi.net/api/v1/transactions/trips?start_date=2025-10-27&end_date=2025-10-27&search", {
        method: "GET",
        headers: {
          "Authorization": "Basic NDI0MDUyOlpvUVFZVk1mdHJ3dVZzeWFlQ1c0c01ndjdMWjhGRmVu",
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: ApiResponse = await response.json()
      console.log(data.data)
      setTrips(data.data || [])
      setLastRefresh(new Date())
    } catch (err) {
      console.error("Error fetching trips:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch trip data")
    } finally {
      if (isManualRefresh) {
        setIsInitialLoading(false)
      }
    }
  }

  // Initial data fetch
  useEffect(() => {
    if (!isAuthenticated) return

    setIsInitialLoading(true)
    fetchTrips(true)
  }, [isAuthenticated])

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!isAuthenticated || !autoRefresh) return

    const interval = setInterval(() => {
      fetchTrips(false) // Silent refresh without loading state
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [isAuthenticated, autoRefresh])

  // Helper functions
  const getTripDetailsByType = (trip: Trip, type: "TAP_IN" | "TAP_OUT") => {
    return trip.trip_details.find((detail) => detail.type === type)
  }

  const getFinalAmount = (trip: Trip) => {
    return trip.amount
  }

  // Sorting function
  const handleSort = (field: SortField) => {
    setSortConfig((prevConfig) => ({
      field,
      direction: prevConfig.field === field && prevConfig.direction === "asc" ? "desc" : "asc",
    }))
  }

  // Sort icon component
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortConfig.field !== field) {
      return <ChevronsUpDown className="h-4 w-4 ml-1 opacity-50" />
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-4 w-4 ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-1" />
    )
  }

  // Debounced filtering and sorting with loading state
  const processedData = useMemo(() => {
    setIsFilterLoading(true)

    const processData = () => {
      let filtered = trips

      // Filter by search term (user_cpan)
      if (searchTerm) {
        filtered = filtered.filter((item) => item.user_cpan.toLowerCase().includes(searchTerm.toLowerCase()))
      }

      // Filter by date range
      if (dateRange.from || dateRange.to) {
        filtered = filtered.filter((item) => {
          const itemDate = new Date(item.created_at)
          const itemDateOnly = new Date(
            Date.UTC(itemDate.getUTCFullYear(), itemDate.getUTCMonth(), itemDate.getUTCDate()),
          )

          let matchesRange = true

          if (dateRange.from) {
            const fromDate = new Date(
              Date.UTC(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate()),
            )
            matchesRange = matchesRange && itemDateOnly >= fromDate
          }

          if (dateRange.to) {
            const toDate = new Date(
              Date.UTC(dateRange.to.getFullYear(), dateRange.to.getMonth(), dateRange.to.getDate()),
            )
            matchesRange = matchesRange && itemDateOnly <= toDate
          }

          return matchesRange
        })
      }

      // Sort data
      filtered.sort((a, b) => {
        let aValue: any
        let bValue: any

        switch (sortConfig.field) {
          case "created_at":
            aValue = new Date(a.created_at).getTime()
            bValue = new Date(b.created_at).getTime()
            break
          case "amount":
            // Sort by TAP_OUT amount if available, otherwise by saldo_potong_normal
            const aTapOut = getTripDetailsByType(a, "TAP_OUT")
            const bTapOut = getTripDetailsByType(b, "TAP_OUT")
            aValue = aTapOut?.amount || a.saldo_potong_normal
            bValue = bTapOut?.amount || b.saldo_potong_normal
            break
          case "final_amount":
            aValue = getFinalAmount(a)
            bValue = getFinalAmount(b)
            break
          case "id":
            aValue = a.id
            bValue = b.id
            break
          case "user_cpan":
            aValue = a.user_cpan
            bValue = b.user_cpan
            break
          default:
            aValue = a.created_at
            bValue = b.created_at
        }

        if (sortConfig.direction === "asc") {
          return aValue > bValue ? 1 : -1
        } else {
          return aValue < bValue ? 1 : -1
        }
      })

      return filtered
    }

    // Simulate processing time for better UX
    const timeoutId = setTimeout(() => {
      setIsFilterLoading(false)
    }, 300)

    const result = processData()

    // If no filters applied, remove loading immediately
    if (!searchTerm && !dateRange.from && !dateRange.to) {
      clearTimeout(timeoutId)
      setIsFilterLoading(false)
    }

    return result
  }, [searchTerm, dateRange, trips, sortConfig])

  // Update filtered data when computation is complete
  useEffect(() => {
    if (!isFilterLoading) {
      setFilteredData(processedData)
    }
  }, [processedData, isFilterLoading])

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated")
    router.push("/login")
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };


  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const hours = date.getHours().toString().padStart(2, "0")
    const minutes = date.getMinutes().toString().padStart(2, "0")
    const seconds = date.getSeconds().toString().padStart(2, "0")

    return `${hours}:${minutes}:${seconds}`
  }

  const handleForcePayment = async (trip: Trip) => {
    if (!trip) return;

    try {
      const response = await fetch(
        `https://afc-dev.ainosi.net/api/v1/transactions/force-payment?trip_id=${trip.id}`,
        {
          method: "GET",
          headers: {
            "Authorization": "Basic NDI0MDUyOlpvUVFZVk1mdHJ3dVZzeWFlQ1c0c01ndjdMWjhGRmVu",
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Force payment response:", data);

      alert("Force Payment berhasil!"); // atau bisa ganti toast/notification
    } catch (err) {
      console.error("Error force payment:", err);
      alert(err instanceof Error ? err.message : "Gagal melakukan Force Payment");
    }
  };

  const renderTripDetailCell = (detail?: TripDetail) => {
    if (!detail) return <span style={{ color: "rgb(120, 119, 116)" }}>-</span>

    return (
      <div className="space-y-2">
        <div className="text-sm font-medium">{formatCurrency(detail.amount)}</div>
        <div className="text-xs" style={{ color: "rgb(120, 119, 116)" }}>
          {formatTime(detail.CreatedAt)}
        </div>
        <div className="text-xs" style={{ color: "rgb(120, 119, 116)" }}>
          {detail.group.halte_id !== 0
            ? detail.group.halte_id
            : detail.group.fleet_id !== 0
              ? detail.group.fleet?.body_code
              : detail.group.halte?.name}
        </div>
        <span
          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
          style={{
            background:
              detail.status === "SUCCESS"
                ? "rgb(219, 237, 219)"
                : detail.status === "INIT"
                  ? "rgb(255, 244, 229)"
                  : "rgb(253, 235, 236)",
            color:
              detail.status === "SUCCESS"
                ? "rgb(22, 101, 52)"
                : detail.status === "INIT"
                  ? "rgb(154, 85, 0)"
                  : "rgb(155, 44, 44)",
          }}
        >
          {detail.status}
        </span>
      </div>
    )
  }

  // Loading skeleton component
  const TableSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="flex space-x-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-12"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
          <div className="h-4 bg-gray-200 rounded w-12"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </div>
      ))}
    </div>
  )

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "rgb(251, 251, 250)" }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "rgb(120, 119, 116)" }} />
          <p className="notion-text" style={{ color: "rgb(120, 119, 116)" }}>
            Authenticating...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: "rgb(251, 251, 250)" }}>
      {/* Header */}
      <header className="bg-white border-b" style={{ borderColor: "rgb(233, 233, 231)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="notion-heading text-2xl" style={{ color: "rgb(55, 53, 47)" }}>
                Trip Dashboard
              </h1>
              <p className="notion-text text-sm mt-1" style={{ color: "rgb(120, 119, 116)" }}>
                Monitor and analyze trip transactions
              </p>
            </div>
            <button onClick={handleLogout} className="notion-button flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters Card */}
        <div className="notion-card mb-8 p-6">
          <h2 className="notion-heading text-lg mb-4">Filters & Search</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Search by user_cpan */}
            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: "rgb(55, 53, 47)" }}>
                Search by User CPAN
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4"
                  style={{ color: "rgb(120, 119, 116)" }}
                />
                {isFilterLoading && searchTerm && (
                  <Loader2
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin"
                    style={{ color: "rgb(120, 119, 116)" }}
                  />
                )}
                <input
                  type="text"
                  placeholder="Enter user CPAN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="notion-input w-full pl-10 pr-10"
                />
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-2">
              <label className="block text-sm font-medium" style={{ color: "rgb(55, 53, 47)" }}>
                Filter by Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="notion-input w-full flex items-center justify-start text-left text-sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from
                          ? (() => {
                              const day = dateRange.from.getDate().toString().padStart(2, "0")
                              const month = (dateRange.from.getMonth() + 1).toString().padStart(2, "0")
                              const year = dateRange.from.getFullYear()
                              return `${day}/${month}/${year}`
                            })()
                          : "From date"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange((prev) => ({ ...prev, from: date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="relative">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="notion-input w-full flex items-center justify-start text-left text-sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.to
                          ? (() => {
                              const day = dateRange.to.getDate().toString().padStart(2, "0")
                              const month = (dateRange.to.getMonth() + 1).toString().padStart(2, "0")
                              const year = dateRange.to.getFullYear()
                              return `${day}/${month}/${year}`
                            })()
                          : "To date"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white border border-gray-200 rounded-lg shadow-lg">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => setDateRange((prev) => ({ ...prev, to: date }))}
                        initialFocus
                        disabled={(date) => (dateRange.from ? date < dateRange.from : false)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {(dateRange.from || dateRange.to) && (
                <div
                  className="text-xs mt-2 p-2 rounded"
                  style={{ background: "rgb(247, 246, 243)", color: "rgb(120, 119, 116)" }}
                >
                  {dateRange.from && dateRange.to ? (
                    <>
                      Showing data from {(() => {
                        const day = dateRange.from.getDate().toString().padStart(2, "0")
                        const month = (dateRange.from.getMonth() + 1).toString().padStart(2, "0")
                        const year = dateRange.from.getFullYear()
                        return `${day}/${month}/${year}`
                      })()} to {(() => {
                        const day = dateRange.to.getDate().toString().padStart(2, "0")
                        const month = (dateRange.to.getMonth() + 1).toString().padStart(2, "0")
                        const year = dateRange.to.getFullYear()
                        return `${day}/${month}/${year}`
                      })()}
                    </>
                  ) : dateRange.from ? (
                    <>
                      Showing data from {(() => {
                        const day = dateRange.from.getDate().toString().padStart(2, "0")
                        const month = (dateRange.from.getMonth() + 1).toString().padStart(2, "0")
                        const year = dateRange.from.getFullYear()
                        return `${day}/${month}/${year}`
                      })()} onwards
                    </>
                  ) : (
                    <>
                      Showing data up to {(() => {
                        const day = dateRange.to!.getDate().toString().padStart(2, "0")
                        const month = (dateRange.to!.getMonth() + 1).toString().padStart(2, "0")
                        const year = dateRange.to!.getFullYear()
                        return `${day}/${month}/${year}`
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Clear Filters */}
          <div className="mt-6">
            <button
              onClick={() => {
                setSearchTerm("")
                setDateRange({})
              }}
              className="notion-button"
              disabled={isFilterLoading}
            >
              {isFilterLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                "Clear Filters"
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="notion-card mb-8 p-4"
            style={{
              background: "rgb(253, 235, 236)",
              borderColor: "rgb(235, 87, 87)",
              color: "rgb(155, 44, 44)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "rgb(235, 87, 87)" }}></div>
              <span className="font-medium">Error</span>
            </div>
            <p className="mt-2 text-sm">{error}. Please check if the API server is running on https://afc-dev.ainosi.net</p>
          </div>
        )}

        {/* Trip Data Table */}
        <div className="notion-card">
          <div className="p-6 border-b" style={{ borderColor: "rgb(233, 233, 231)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="notion-heading text-lg">Trip Data</h2>
                <p className="notion-text text-sm mt-1" style={{ color: "rgb(120, 119, 116)" }}>
                  {isInitialLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading initial data...
                    </span>
                  ) : isFilterLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing data...
                    </span>
                  ) : (
                    <>
                      {filteredData.length} records found
                      {!error && (
                        <span className="ml-2 text-xs">
                          • Last updated: {formatDateTime(lastRefresh.toISOString())}
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span style={{ color: "rgb(120, 119, 116)" }}>Auto-refresh (10s)</span>
                  </label>
                </div>
                <button
                  onClick={() => fetchTrips(true)}
                  className="notion-button flex items-center gap-2"
                  disabled={isInitialLoading}
                >
                  <Loader2 className={`h-4 w-4 ${isInitialLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            {isInitialLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "rgb(120, 119, 116)" }} />
                  <p className="notion-text" style={{ color: "rgb(120, 119, 116)" }}>
                    Loading trip data...
                  </p>
                  <p className="notion-text text-xs mt-2" style={{ color: "rgb(120, 119, 116)" }}>
                    This may take a few moments
                  </p>
                </div>
              </div>
            ) : isFilterLoading ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgb(120, 119, 116)" }}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing data...
                  </div>
                </div>
                <TableSkeleton />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="notion-table w-full">
                  <thead>
                    <tr>
                      <th>
                        <button
                          onClick={() => handleSort("created_at")}
                          className="flex items-center hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                        >
                          Created At
                          <SortIcon field="created_at" />
                        </button>
                      </th>
                      <th>
                        <button
                          onClick={() => handleSort("user_cpan")}
                          className="flex items-center hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                        >
                          User CPAN
                          <SortIcon field="user_cpan" />
                        </button>
                      </th>
                      <th>Tarif</th>
                      <th>TAP IN</th>
                      <th>TAP OUT</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((trip) => {
                      return (
                        <tr key={trip.id}>
                          <td>{formatDateTime(trip.created_at)}</td>
                          <td className="font-mono text-sm">
                            {"***" + trip.user_cpan?.slice(-4)}
                          </td>
                          <td>{formatCurrency(trip.amount)}</td>
                          <td>{renderTripDetailCell(getTripDetailsByType(trip, "TAP_IN"))}</td>
                          <td>{renderTripDetailCell(getTripDetailsByType(trip, "TAP_OUT"))}</td>
                          <td>
                            <span
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                              style={{
                                background:
                                  trip.status === "COMPLETE"
                                    ? "rgb(219, 237, 219)"
                                    : trip.status === "PENDING"
                                      ? "rgb(255, 244, 229)"
                                      : "rgb(253, 235, 236)",
                                color:
                                  trip.status === "COMPLETE"
                                    ? "rgb(22, 101, 52)"
                                    : trip.status === "PENDING"
                                      ? "rgb(154, 85, 0)"
                                      : "rgb(155, 44, 44)",
                              }}
                            >
                              {trip.status}
                            </span>
                          </td>
                          <td className="text-center">
                            {getTripDetailsByType(trip, "TAP_IN")?.status == "SUCCESS" && getTripDetailsByType(trip, "TAP_OUT")?.status == "FAILED" ? (
                              <button
                                onClick={() => handleForcePayment(trip)}
                                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                              >
                                Force Payment
                              </button>
                            ) : (
                              <span style={{ color: "rgb(120, 119, 116)" }}>-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {!isInitialLoading && !isFilterLoading && filteredData.length === 0 && !error && (
                  <div className="text-center py-12">
                    <div
                      className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                      style={{ background: "rgb(247, 246, 243)" }}
                    >
                      <Search className="h-8 w-8" style={{ color: "rgb(120, 119, 116)" }} />
                    </div>
                    <h3 className="notion-heading text-lg mb-2">No data found</h3>
                    <p className="notion-text" style={{ color: "rgb(120, 119, 116)" }}>
                      {trips.length === 0 ? "No trip data available" : "No results match your filters"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
